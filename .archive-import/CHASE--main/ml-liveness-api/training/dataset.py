"""
ASVspoof Dataset Loader

Loads audio files and labels from ASVspoof protocol files for training
voice liveness detection models.
"""

import os
import random
from pathlib import Path
from typing import Optional, Tuple, Dict, List

import torch
import torchaudio
from torch.utils.data import Dataset, DataLoader
import numpy as np

from .config import DataConfig, AugmentationConfig
from .augmentation import RawBoost, apply_codec_augmentation, add_noise, add_reverb


class ASVspoofDataset(Dataset):
    """
    ASVspoof Dataset for voice liveness detection
    
    Protocol file format (space-separated):
    SPEAKER_ID AUDIO_FILE - ATTACK_TYPE LABEL
    
    LABEL: bonafide or spoof
    """

    def __init__(
        self,
        protocol_path: str,
        audio_dir: str,
        config: DataConfig,
        augmentation_config: Optional[AugmentationConfig] = None,
        is_train: bool = True,
    ):
        self.audio_dir = Path(audio_dir)
        self.config = config
        self.augmentation_config = augmentation_config
        self.is_train = is_train
        
        # Label mapping
        self.label_map = {"bonafide": 0, "spoof": 1}
        
        # Load protocol file
        self.samples = self._load_protocol(protocol_path)
        
        # Initialize augmentations if training
        if is_train and augmentation_config:
            self.rawboost = RawBoost(augmentation_config)
        else:
            self.rawboost = None

    def _load_protocol(self, protocol_path: str) -> List[Dict]:
        """Load and parse ASVspoof protocol file"""
        samples = []
        
        with open(protocol_path, "r") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 5:
                    speaker_id, audio_file, _, attack_type, label = parts[:5]
                    
                    # Construct audio path
                    audio_path = self.audio_dir / f"{audio_file}.flac"
                    
                    if audio_path.exists():
                        samples.append({
                            "speaker_id": speaker_id,
                            "audio_path": str(audio_path),
                            "attack_type": attack_type,
                            "label": self.label_map.get(label, 1),  # Default to spoof
                        })
        
        print(f"Loaded {len(samples)} samples from {protocol_path}")
        return samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        sample = self.samples[idx]
        
        # Load audio
        waveform, sr = torchaudio.load(sample["audio_path"])
        
        # Resample if needed
        if sr != self.config.sample_rate:
            resampler = torchaudio.transforms.Resample(sr, self.config.sample_rate)
            waveform = resampler(waveform)
        
        # Convert to mono
        if waveform.shape[0] > 1:
            waveform = torch.mean(waveform, dim=0, keepdim=True)
        
        # Remove channel dimension for processing
        waveform = waveform.squeeze(0)
        
        # Truncate or pad to max duration
        max_samples = int(self.config.max_duration * self.config.sample_rate)
        min_samples = int(self.config.min_duration * self.config.sample_rate)
        
        if len(waveform) > max_samples:
            # Random crop for training, center crop for eval
            if self.is_train:
                start = random.randint(0, len(waveform) - max_samples)
            else:
                start = (len(waveform) - max_samples) // 2
            waveform = waveform[start : start + max_samples]
        elif len(waveform) < min_samples:
            # Pad short audio
            pad_length = min_samples - len(waveform)
            waveform = torch.nn.functional.pad(waveform, (0, pad_length))
        
        # Apply augmentations during training
        if self.is_train and self.augmentation_config:
            waveform = self._apply_augmentations(waveform)
        
        return waveform, sample["label"]

    def _apply_augmentations(self, waveform: torch.Tensor) -> torch.Tensor:
        """Apply data augmentations"""
        aug_config = self.augmentation_config
        
        # RawBoost
        if self.config.use_rawboost and random.random() < 0.5:
            waveform = self.rawboost(waveform)
        
        # Codec augmentation
        if self.config.use_codec_aug and random.random() < 0.3:
            waveform = apply_codec_augmentation(
                waveform,
                self.config.sample_rate,
                aug_config.codec_types,
                aug_config.codec_bitrates,
            )
        
        # Noise augmentation
        if self.config.use_noise_aug and random.random() < aug_config.noise_prob:
            snr = random.uniform(aug_config.noise_snr_min, aug_config.noise_snr_max)
            waveform = add_noise(waveform, snr)
        
        # Reverb augmentation
        if self.config.use_reverb_aug and random.random() < aug_config.reverb_prob:
            waveform = add_reverb(waveform)
        
        return waveform


def collate_fn(batch: List[Tuple[torch.Tensor, int]]) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Custom collate function to pad variable-length audio
    """
    waveforms, labels = zip(*batch)
    
    # Find max length in batch
    max_len = max(w.shape[0] for w in waveforms)
    
    # Pad all waveforms to max length
    padded_waveforms = []
    for w in waveforms:
        if w.shape[0] < max_len:
            pad = torch.zeros(max_len - w.shape[0])
            w = torch.cat([w, pad])
        padded_waveforms.append(w)
    
    # Stack into batch tensors
    waveforms_tensor = torch.stack(padded_waveforms)
    labels_tensor = torch.tensor(labels, dtype=torch.long)
    
    return waveforms_tensor, labels_tensor


def create_dataloaders(
    config: DataConfig,
    augmentation_config: Optional[AugmentationConfig] = None,
    batch_size: int = 16,
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """
    Create train, dev, and eval dataloaders
    """
    # Training dataset
    train_dataset = ASVspoofDataset(
        protocol_path=config.train_protocol,
        audio_dir=config.audio_dir,
        config=config,
        augmentation_config=augmentation_config,
        is_train=True,
    )
    
    # Development dataset
    dev_dataset = ASVspoofDataset(
        protocol_path=config.dev_protocol,
        audio_dir=config.audio_dir,
        config=config,
        augmentation_config=None,
        is_train=False,
    )
    
    # Evaluation dataset
    eval_dataset = ASVspoofDataset(
        protocol_path=config.eval_protocol,
        audio_dir=config.audio_dir,
        config=config,
        augmentation_config=None,
        is_train=False,
    )
    
    # Create dataloaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=config.num_workers,
        pin_memory=config.pin_memory,
        collate_fn=collate_fn,
        drop_last=True,
    )
    
    dev_loader = DataLoader(
        dev_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=config.num_workers,
        pin_memory=config.pin_memory,
        collate_fn=collate_fn,
    )
    
    eval_loader = DataLoader(
        eval_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=config.num_workers,
        pin_memory=config.pin_memory,
        collate_fn=collate_fn,
    )
    
    return train_loader, dev_loader, eval_loader
