"""
Training module for WavLM + AASIST Voice Liveness Detection

Provides:
- Dataset loaders for ASVspoof data
- Data augmentation (RawBoost, codec, noise, reverb)
- Training loop with mixed precision
- EER and t-DCF evaluation metrics
"""

from .config import (
    Config,
    ModelConfig,
    TrainingConfig,
    DataConfig,
    AugmentationConfig,
    get_default_config,
    get_large_model_config,
)
from .dataset import ASVspoofDataset, create_dataloaders
from .augmentation import RawBoost, apply_codec_augmentation, add_noise, add_reverb
from .trainer import Trainer
from .metrics import compute_eer, compute_min_tdcf, compute_roc_curve

__all__ = [
    # Config
    "Config",
    "ModelConfig",
    "TrainingConfig",
    "DataConfig",
    "AugmentationConfig",
    "get_default_config",
    "get_large_model_config",
    # Dataset
    "ASVspoofDataset",
    "create_dataloaders",
    # Augmentation
    "RawBoost",
    "apply_codec_augmentation",
    "add_noise",
    "add_reverb",
    # Training
    "Trainer",
    # Metrics
    "compute_eer",
    "compute_min_tdcf",
    "compute_roc_curve",
]
