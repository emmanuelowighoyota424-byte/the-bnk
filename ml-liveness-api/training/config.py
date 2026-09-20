"""
Training Configuration for WavLM + AASIST Liveness Detection

Configurable parameters for training on ASVspoof datasets.
"""

from dataclasses import dataclass, field
from typing import Optional
import torch


@dataclass
class ModelConfig:
    """Model architecture configuration"""

    # WavLM variant
    wavlm_variant: str = "microsoft/wavlm-base"  # or "microsoft/wavlm-large"
    
    # Classifier head
    hidden_dim: int = 256
    dropout: float = 0.3
    num_classes: int = 2  # bonafide vs spoof
    
    # Fine-tuning layers (how many WavLM layers to unfreeze)
    unfreeze_layers: int = 8
    
    # Pooling type
    pooling_type: str = "mean"  # "mean", "mhfa", "attentive"
    mhfa_heads: int = 8


@dataclass
class TrainingConfig:
    """Training hyperparameters"""

    # Basic training
    batch_size: int = 16
    num_epochs: int = 50
    learning_rate: float = 1e-4
    weight_decay: float = 1e-4
    
    # Learning rate scheduling
    scheduler: str = "cosine"  # "cosine", "step", "plateau"
    warmup_epochs: int = 5
    min_lr: float = 1e-6
    
    # Early stopping
    patience: int = 10
    min_delta: float = 0.001
    
    # Gradient clipping
    max_grad_norm: float = 1.0
    
    # Mixed precision
    use_amp: bool = True
    
    # Device
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Seed for reproducibility
    seed: int = 42


@dataclass
class DataConfig:
    """Dataset configuration"""

    # Paths
    train_protocol: str = "data/ASVspoof5/ASVspoof5.LA.train.txt"
    dev_protocol: str = "data/ASVspoof5/ASVspoof5.LA.dev.txt"
    eval_protocol: str = "data/ASVspoof5/ASVspoof5.LA.eval.txt"
    audio_dir: str = "data/ASVspoof5/flac/"
    
    # Audio processing
    sample_rate: int = 16000
    max_duration: float = 10.0  # seconds
    min_duration: float = 0.5  # seconds
    
    # Data augmentation
    use_rawboost: bool = True
    use_codec_aug: bool = True
    use_noise_aug: bool = True
    use_reverb_aug: bool = True
    use_freq_mask: bool = True
    
    # RawBoost parameters
    rawboost_algo: int = 5  # 1-5, with 5 being most aggressive
    
    # Noise augmentation
    noise_snr_range: tuple = (5, 20)  # dB
    
    # Data loading
    num_workers: int = 4
    pin_memory: bool = True


@dataclass
class AugmentationConfig:
    """Data augmentation settings"""

    # RawBoost parameters
    rawboost_algo: int = 5
    rawboost_nBands: int = 5
    rawboost_minF: int = 20
    rawboost_maxF: int = 8000
    rawboost_minBW: int = 100
    rawboost_maxBW: int = 1000
    rawboost_minG: int = 0
    rawboost_maxG: int = 12
    
    # Codec augmentation
    codec_types: list = field(default_factory=lambda: ["mp3", "aac", "ogg"])
    codec_bitrates: list = field(default_factory=lambda: [64, 128, 192])
    
    # Noise augmentation
    noise_prob: float = 0.5
    noise_snr_min: float = 5.0
    noise_snr_max: float = 20.0
    
    # Reverb augmentation
    reverb_prob: float = 0.3
    
    # SpecAugment-style frequency masking
    freq_mask_prob: float = 0.5
    freq_mask_max_width: int = 27


@dataclass
class Config:
    """Master configuration"""

    model: ModelConfig = field(default_factory=ModelConfig)
    training: TrainingConfig = field(default_factory=TrainingConfig)
    data: DataConfig = field(default_factory=DataConfig)
    augmentation: AugmentationConfig = field(default_factory=AugmentationConfig)
    
    # Experiment tracking
    experiment_name: str = "wavlm_liveness"
    output_dir: str = "outputs"
    checkpoint_dir: str = "checkpoints"
    log_dir: str = "logs"
    
    # Logging
    log_every_n_steps: int = 100
    eval_every_n_epochs: int = 1
    save_every_n_epochs: int = 5
    
    # Wandb (optional)
    use_wandb: bool = False
    wandb_project: str = "voice-liveness"
    wandb_entity: Optional[str] = None


def get_default_config() -> Config:
    """Get default configuration"""
    return Config()


def get_large_model_config() -> Config:
    """Configuration for WavLM-Large with more aggressive training"""
    config = Config()
    config.model.wavlm_variant = "microsoft/wavlm-large"
    config.model.hidden_dim = 512
    config.model.unfreeze_layers = 12
    config.training.batch_size = 8  # Smaller due to larger model
    config.training.learning_rate = 5e-5
    return config
