"""
Data Augmentation for Voice Liveness Training

Implements RawBoost, codec augmentation, noise injection, and reverb
for robust deepfake detection training.
"""

import io
import random
from typing import List, Optional

import torch
import torchaudio
import numpy as np
from scipy import signal


class RawBoost:
    """
    RawBoost Data Augmentation
    
    Combines multiple signal processing augmentations to improve
    robustness against spoofing attacks.
    
    Based on: https://arxiv.org/abs/2111.04433
    """

    def __init__(self, config):
        self.algo = config.rawboost_algo
        self.nBands = config.rawboost_nBands
        self.minF = config.rawboost_minF
        self.maxF = config.rawboost_maxF
        self.minBW = config.rawboost_minBW
        self.maxBW = config.rawboost_maxBW
        self.minG = config.rawboost_minG
        self.maxG = config.rawboost_maxG

    def __call__(self, waveform: torch.Tensor) -> torch.Tensor:
        """Apply RawBoost augmentation"""
        x = waveform.numpy()
        
        if self.algo == 1:
            x = self._linear_time_warp(x)
        elif self.algo == 2:
            x = self._impulse_noise(x)
        elif self.algo == 3:
            x = self._colored_noise(x)
        elif self.algo == 4:
            x = self._linear_time_warp(x)
            x = self._impulse_noise(x)
        elif self.algo == 5:
            x = self._linear_time_warp(x)
            x = self._colored_noise(x)
            x = self._impulse_noise(x)
        
        return torch.from_numpy(x.astype(np.float32))

    def _linear_time_warp(self, x: np.ndarray) -> np.ndarray:
        """Linear frequency domain warping"""
        N = len(x)
        X = np.fft.rfft(x)
        
        # Apply random frequency shift
        shift = random.randint(-5, 5)
        X = np.roll(X, shift)
        
        return np.fft.irfft(X, N)

    def _impulse_noise(self, x: np.ndarray) -> np.ndarray:
        """Add impulse noise"""
        N = len(x)
        
        # Random impulse positions
        n_impulses = random.randint(1, max(1, N // 1000))
        positions = np.random.randint(0, N, n_impulses)
        
        # Random impulse magnitudes
        magnitudes = np.random.uniform(-0.1, 0.1, n_impulses)
        
        x_copy = x.copy()
        x_copy[positions] += magnitudes * np.max(np.abs(x))
        
        return x_copy

    def _colored_noise(self, x: np.ndarray) -> np.ndarray:
        """Add colored (frequency-shaped) noise"""
        N = len(x)
        
        # Generate white noise
        noise = np.random.randn(N)
        
        # Apply random frequency bands
        for _ in range(self.nBands):
            fc = random.uniform(self.minF, self.maxF)
            bw = random.uniform(self.minBW, self.maxBW)
            gain = random.uniform(self.minG, self.maxG)
            
            # Design bandpass filter
            low = max(0.01, (fc - bw / 2) / 8000)
            high = min(0.99, (fc + bw / 2) / 8000)
            
            if low < high:
                b, a = signal.butter(2, [low, high], btype="band")
                band_noise = signal.filtfilt(b, a, noise)
                x = x + (10 ** (gain / 20)) * band_noise * 0.01
        
        return x


def apply_codec_augmentation(
    waveform: torch.Tensor,
    sample_rate: int,
    codec_types: List[str],
    bitrates: List[int],
) -> torch.Tensor:
    """
    Apply codec compression/decompression as augmentation
    
    Simulates transmission artifacts from voice calls.
    """
    try:
        # Select random codec and bitrate
        codec = random.choice(codec_types)
        bitrate = random.choice(bitrates)
        
        # Create in-memory buffer
        buffer = io.BytesIO()
        
        # Encode with selected codec
        if codec == "mp3":
            format_str = "mp3"
        elif codec == "aac":
            format_str = "aac"
        else:
            format_str = "ogg"
        
        torchaudio.save(
            buffer,
            waveform.unsqueeze(0),
            sample_rate,
            format=format_str,
            bits_per_sample=bitrate // 8,
        )
        
        # Decode back
        buffer.seek(0)
        decoded, _ = torchaudio.load(buffer)
        
        return decoded.squeeze(0)
    except Exception:
        # Return original if codec fails
        return waveform


def add_noise(waveform: torch.Tensor, snr_db: float) -> torch.Tensor:
    """
    Add Gaussian noise at specified SNR
    
    Args:
        waveform: Input audio tensor
        snr_db: Signal-to-noise ratio in dB
    """
    # Calculate signal power
    signal_power = torch.mean(waveform ** 2)
    
    # Calculate noise power from SNR
    noise_power = signal_power / (10 ** (snr_db / 10))
    
    # Generate noise
    noise = torch.randn_like(waveform) * torch.sqrt(noise_power)
    
    return waveform + noise


def add_reverb(
    waveform: torch.Tensor,
    room_size: float = 0.5,
    damping: float = 0.5,
) -> torch.Tensor:
    """
    Add simple reverb effect
    
    Uses a basic FIR filter to simulate room acoustics.
    """
    # Simple reverb using exponential decay
    reverb_samples = int(0.1 * 16000)  # 100ms reverb tail
    
    # Create impulse response
    t = np.arange(reverb_samples)
    ir = np.exp(-damping * t / reverb_samples) * np.random.randn(reverb_samples)
    ir = ir / np.max(np.abs(ir)) * room_size
    ir[0] = 1.0  # Direct sound
    
    # Apply convolution
    waveform_np = waveform.numpy()
    reverbed = np.convolve(waveform_np, ir, mode="same")
    
    return torch.from_numpy(reverbed.astype(np.float32))


def apply_frequency_masking(
    waveform: torch.Tensor,
    sample_rate: int = 16000,
    max_mask_width: int = 27,
    n_masks: int = 2,
) -> torch.Tensor:
    """
    Apply SpecAugment-style frequency masking
    
    Masks random frequency bands in the spectrogram domain.
    """
    # Compute spectrogram
    n_fft = 512
    hop_length = 128
    spec = torch.stft(
        waveform,
        n_fft=n_fft,
        hop_length=hop_length,
        return_complex=True,
    )
    
    n_freq = spec.shape[0]
    
    # Apply random frequency masks
    for _ in range(n_masks):
        mask_width = random.randint(0, max_mask_width)
        mask_start = random.randint(0, max(0, n_freq - mask_width))
        spec[mask_start : mask_start + mask_width, :] = 0
    
    # Convert back to waveform
    masked_waveform = torch.istft(
        spec,
        n_fft=n_fft,
        hop_length=hop_length,
        length=len(waveform),
    )
    
    return masked_waveform


class ComposeAugmentations:
    """Compose multiple augmentations"""

    def __init__(self, augmentations: List, probs: Optional[List[float]] = None):
        self.augmentations = augmentations
        self.probs = probs or [0.5] * len(augmentations)

    def __call__(self, waveform: torch.Tensor) -> torch.Tensor:
        for aug, prob in zip(self.augmentations, self.probs):
            if random.random() < prob:
                waveform = aug(waveform)
        return waveform
