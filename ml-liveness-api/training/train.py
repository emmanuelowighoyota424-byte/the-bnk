#!/usr/bin/env python3
"""
Training Script for WavLM + AASIST Liveness Detection

Usage:
    python train.py --config base
    python train.py --config large --epochs 100 --batch_size 8
    python train.py --protocol /path/to/asvspoof --output ./my_output
"""

import argparse
import os
import sys
import random

import torch
import numpy as np

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from training.config import (
    Config,
    get_default_config,
    get_large_model_config,
)
from training.dataset import create_dataloaders
from training.trainer import Trainer
from models.ml_models import WavLMLivenessModel


def set_seed(seed: int):
    """Set random seeds for reproducibility"""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Train WavLM + AASIST liveness detection model"
    )
    
    # Config preset
    parser.add_argument(
        "--config",
        type=str,
        default="base",
        choices=["base", "large"],
        help="Configuration preset (base or large model)",
    )
    
    # Data paths
    parser.add_argument(
        "--protocol",
        type=str,
        default=None,
        help="Path to ASVspoof protocol directory",
    )
    parser.add_argument(
        "--audio_dir",
        type=str,
        default=None,
        help="Path to audio files directory",
    )
    
    # Training overrides
    parser.add_argument(
        "--epochs",
        type=int,
        default=None,
        help="Number of training epochs",
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=None,
        help="Batch size",
    )
    parser.add_argument(
        "--learning_rate",
        type=float,
        default=None,
        help="Learning rate",
    )
    
    # Output
    parser.add_argument(
        "--output",
        type=str,
        default="outputs",
        help="Output directory",
    )
    parser.add_argument(
        "--checkpoint",
        type=str,
        default="checkpoints",
        help="Checkpoint directory",
    )
    
    # Misc
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed",
    )
    parser.add_argument(
        "--resume",
        type=str,
        default=None,
        help="Path to checkpoint to resume from",
    )
    parser.add_argument(
        "--wandb",
        action="store_true",
        help="Enable Weights & Biases logging",
    )
    
    return parser.parse_args()


def main():
    """Main training function"""
    args = parse_args()
    
    # Load config preset
    if args.config == "large":
        config = get_large_model_config()
    else:
        config = get_default_config()
    
    # Apply command line overrides
    if args.protocol:
        config.data.train_protocol = os.path.join(
            args.protocol, "ASVspoof5.LA.train.txt"
        )
        config.data.dev_protocol = os.path.join(
            args.protocol, "ASVspoof5.LA.dev.txt"
        )
        config.data.eval_protocol = os.path.join(
            args.protocol, "ASVspoof5.LA.eval.txt"
        )
    
    if args.audio_dir:
        config.data.audio_dir = args.audio_dir
    
    if args.epochs:
        config.training.num_epochs = args.epochs
    
    if args.batch_size:
        config.training.batch_size = args.batch_size
    
    if args.learning_rate:
        config.training.learning_rate = args.learning_rate
    
    config.output_dir = args.output
    config.checkpoint_dir = args.checkpoint
    config.training.seed = args.seed
    config.use_wandb = args.wandb
    
    # Set seed
    set_seed(config.training.seed)
    
    print("=" * 60)
    print("WavLM + AASIST Voice Liveness Training")
    print("=" * 60)
    print(f"Config: {args.config}")
    print(f"Model: {config.model.wavlm_variant}")
    print(f"Epochs: {config.training.num_epochs}")
    print(f"Batch size: {config.training.batch_size}")
    print(f"Learning rate: {config.training.learning_rate}")
    print(f"Device: {config.training.device}")
    print("=" * 60)
    
    # Create model
    print("Loading model...")
    model = WavLMLivenessModel(wavlm_variant=config.model.wavlm_variant)
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Total parameters: {total_params:,}")
    print(f"Trainable parameters: {trainable_params:,}")
    
    # Create dataloaders
    print("Creating dataloaders...")
    train_loader, dev_loader, eval_loader = create_dataloaders(
        config=config.data,
        augmentation_config=config.augmentation,
        batch_size=config.training.batch_size,
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        config=config,
        train_loader=train_loader,
        dev_loader=dev_loader,
        eval_loader=eval_loader,
    )
    
    # Resume from checkpoint if specified
    if args.resume:
        print(f"Resuming from checkpoint: {args.resume}")
        trainer.load_checkpoint(args.resume)
    
    # Train
    print("Starting training...")
    results = trainer.train()
    
    # Print final results
    print("=" * 60)
    print("Training Complete!")
    print("=" * 60)
    print(f"Best Dev EER: {results['best_dev_eer']:.4f}")
    
    if "eval_eer" in results:
        print(f"Eval EER: {results['eval_eer']:.4f}")
        print(f"Eval t-DCF: {results['eval_tdcf']:.4f}")
    
    print(f"Best model saved to: {config.checkpoint_dir}/best_model.pt")


if __name__ == "__main__":
    main()
