"""
Training Loop for WavLM + AASIST Liveness Detection

Implements training with:
- Mixed precision training
- Learning rate scheduling
- Early stopping
- EER and t-DCF metrics
- Checkpointing
"""

import os
from pathlib import Path
from typing import Dict, Tuple, Optional
import json

import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR, ReduceLROnPlateau
from torch.cuda.amp import GradScaler, autocast
from torch.utils.data import DataLoader
from tqdm import tqdm
import numpy as np

from .config import Config, TrainingConfig, ModelConfig
from .metrics import compute_eer, compute_min_tdcf


class Trainer:
    """
    Trainer for voice liveness detection models
    """

    def __init__(
        self,
        model: nn.Module,
        config: Config,
        train_loader: DataLoader,
        dev_loader: DataLoader,
        eval_loader: Optional[DataLoader] = None,
    ):
        self.model = model
        self.config = config
        self.train_config = config.training
        self.train_loader = train_loader
        self.dev_loader = dev_loader
        self.eval_loader = eval_loader
        
        # Setup device
        self.device = torch.device(self.train_config.device)
        self.model = self.model.to(self.device)
        
        # Loss function
        self.criterion = nn.CrossEntropyLoss()
        
        # Optimizer
        self.optimizer = AdamW(
            self.model.parameters(),
            lr=self.train_config.learning_rate,
            weight_decay=self.train_config.weight_decay,
        )
        
        # Learning rate scheduler
        self.scheduler = self._create_scheduler()
        
        # Mixed precision scaler
        self.scaler = GradScaler() if self.train_config.use_amp else None
        
        # Training state
        self.current_epoch = 0
        self.best_eer = float("inf")
        self.patience_counter = 0
        self.train_losses = []
        self.dev_eers = []
        
        # Create output directories
        self._create_directories()

    def _create_scheduler(self):
        """Create learning rate scheduler"""
        if self.train_config.scheduler == "cosine":
            return CosineAnnealingLR(
                self.optimizer,
                T_max=self.train_config.num_epochs - self.train_config.warmup_epochs,
                eta_min=self.train_config.min_lr,
            )
        elif self.train_config.scheduler == "plateau":
            return ReduceLROnPlateau(
                self.optimizer,
                mode="min",
                factor=0.5,
                patience=5,
                min_lr=self.train_config.min_lr,
            )
        else:
            return None

    def _create_directories(self):
        """Create output directories"""
        Path(self.config.output_dir).mkdir(parents=True, exist_ok=True)
        Path(self.config.checkpoint_dir).mkdir(parents=True, exist_ok=True)
        Path(self.config.log_dir).mkdir(parents=True, exist_ok=True)

    def train_epoch(self) -> float:
        """Train for one epoch"""
        self.model.train()
        total_loss = 0.0
        num_batches = 0
        
        pbar = tqdm(self.train_loader, desc=f"Epoch {self.current_epoch}")
        
        for batch_idx, (waveforms, labels) in enumerate(pbar):
            waveforms = waveforms.to(self.device)
            labels = labels.to(self.device)
            
            self.optimizer.zero_grad()
            
            # Forward pass with mixed precision
            if self.train_config.use_amp:
                with autocast():
                    logits = self.model(waveforms)
                    loss = self.criterion(logits, labels)
                
                # Backward pass
                self.scaler.scale(loss).backward()
                
                # Gradient clipping
                self.scaler.unscale_(self.optimizer)
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(),
                    self.train_config.max_grad_norm,
                )
                
                self.scaler.step(self.optimizer)
                self.scaler.update()
            else:
                logits = self.model(waveforms)
                loss = self.criterion(logits, labels)
                
                loss.backward()
                torch.nn.utils.clip_grad_norm_(
                    self.model.parameters(),
                    self.train_config.max_grad_norm,
                )
                self.optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
            
            # Update progress bar
            pbar.set_postfix({"loss": f"{loss.item():.4f}"})
            
            # Logging
            if batch_idx % self.config.log_every_n_steps == 0:
                self._log_step(batch_idx, loss.item())
        
        return total_loss / num_batches

    @torch.no_grad()
    def evaluate(self, loader: DataLoader) -> Tuple[float, float, float]:
        """
        Evaluate model on given dataloader
        
        Returns:
            loss: Average loss
            eer: Equal Error Rate
            tdcf: Minimum tandem DCF
        """
        self.model.eval()
        total_loss = 0.0
        all_scores = []
        all_labels = []
        
        for waveforms, labels in tqdm(loader, desc="Evaluating"):
            waveforms = waveforms.to(self.device)
            labels = labels.to(self.device)
            
            if self.train_config.use_amp:
                with autocast():
                    logits = self.model(waveforms)
                    loss = self.criterion(logits, labels)
            else:
                logits = self.model(waveforms)
                loss = self.criterion(logits, labels)
            
            total_loss += loss.item()
            
            # Get spoof scores (probability of being spoof)
            probs = torch.softmax(logits, dim=1)
            spoof_scores = probs[:, 1].cpu().numpy()
            
            all_scores.extend(spoof_scores.tolist())
            all_labels.extend(labels.cpu().numpy().tolist())
        
        # Compute metrics
        all_scores = np.array(all_scores)
        all_labels = np.array(all_labels)
        
        eer = compute_eer(all_scores, all_labels)
        tdcf = compute_min_tdcf(all_scores, all_labels)
        avg_loss = total_loss / len(loader)
        
        return avg_loss, eer, tdcf

    def train(self) -> Dict:
        """
        Full training loop
        
        Returns:
            Dictionary with training history and best metrics
        """
        print(f"Starting training on {self.device}")
        print(f"Training samples: {len(self.train_loader.dataset)}")
        print(f"Development samples: {len(self.dev_loader.dataset)}")
        
        for epoch in range(self.train_config.num_epochs):
            self.current_epoch = epoch
            
            # Warmup learning rate
            if epoch < self.train_config.warmup_epochs:
                warmup_lr = self.train_config.learning_rate * (
                    epoch + 1
                ) / self.train_config.warmup_epochs
                for param_group in self.optimizer.param_groups:
                    param_group["lr"] = warmup_lr
            
            # Train epoch
            train_loss = self.train_epoch()
            self.train_losses.append(train_loss)
            
            # Evaluate
            if epoch % self.config.eval_every_n_epochs == 0:
                dev_loss, dev_eer, dev_tdcf = self.evaluate(self.dev_loader)
                self.dev_eers.append(dev_eer)
                
                print(
                    f"Epoch {epoch}: "
                    f"Train Loss={train_loss:.4f}, "
                    f"Dev Loss={dev_loss:.4f}, "
                    f"Dev EER={dev_eer:.4f}, "
                    f"Dev t-DCF={dev_tdcf:.4f}"
                )
                
                # Check for improvement
                if dev_eer < self.best_eer - self.train_config.min_delta:
                    self.best_eer = dev_eer
                    self.patience_counter = 0
                    self.save_checkpoint("best_model.pt", is_best=True)
                else:
                    self.patience_counter += 1
                
                # Early stopping
                if self.patience_counter >= self.train_config.patience:
                    print(f"Early stopping at epoch {epoch}")
                    break
            
            # Update scheduler
            if epoch >= self.train_config.warmup_epochs and self.scheduler:
                if isinstance(self.scheduler, ReduceLROnPlateau):
                    self.scheduler.step(dev_eer)
                else:
                    self.scheduler.step()
            
            # Save periodic checkpoint
            if epoch % self.config.save_every_n_epochs == 0:
                self.save_checkpoint(f"checkpoint_epoch_{epoch}.pt")
        
        # Final evaluation on eval set
        final_results = {"best_dev_eer": self.best_eer}
        
        if self.eval_loader:
            # Load best model
            self.load_checkpoint("best_model.pt")
            eval_loss, eval_eer, eval_tdcf = self.evaluate(self.eval_loader)
            final_results.update({
                "eval_loss": eval_loss,
                "eval_eer": eval_eer,
                "eval_tdcf": eval_tdcf,
            })
            print(f"Final Eval: EER={eval_eer:.4f}, t-DCF={eval_tdcf:.4f}")
        
        # Save training history
        self._save_history()
        
        return final_results

    def save_checkpoint(self, filename: str, is_best: bool = False):
        """Save model checkpoint"""
        checkpoint_path = Path(self.config.checkpoint_dir) / filename
        
        checkpoint = {
            "epoch": self.current_epoch,
            "model_state_dict": self.model.state_dict(),
            "optimizer_state_dict": self.optimizer.state_dict(),
            "scheduler_state_dict": self.scheduler.state_dict() if self.scheduler else None,
            "best_eer": self.best_eer,
            "config": {
                "model": vars(self.config.model),
                "training": vars(self.config.training),
            },
        }
        
        torch.save(checkpoint, checkpoint_path)
        
        if is_best:
            print(f"Saved best model with EER={self.best_eer:.4f}")

    def load_checkpoint(self, filename: str):
        """Load model checkpoint"""
        checkpoint_path = Path(self.config.checkpoint_dir) / filename
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
        
        if self.scheduler and checkpoint.get("scheduler_state_dict"):
            self.scheduler.load_state_dict(checkpoint["scheduler_state_dict"])
        
        self.current_epoch = checkpoint.get("epoch", 0)
        self.best_eer = checkpoint.get("best_eer", float("inf"))

    def _log_step(self, batch_idx: int, loss: float):
        """Log training step"""
        # Could integrate with wandb, tensorboard, etc.
        pass

    def _save_history(self):
        """Save training history"""
        history = {
            "train_losses": self.train_losses,
            "dev_eers": self.dev_eers,
            "best_eer": self.best_eer,
        }
        
        history_path = Path(self.config.output_dir) / "training_history.json"
        with open(history_path, "w") as f:
            json.dump(history, f, indent=2)
