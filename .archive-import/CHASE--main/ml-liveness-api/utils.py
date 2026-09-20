import io
import numpy as np
import torch
import torchaudio
import webrtcvad
import librosa
from resemblyzer import VoiceEncoder, preprocess_wav
from models.ml_models import model, device
from config import settings

# Initialize VAD with aggressiveness level 3 (most aggressive)
vad = webrtcvad.Vad(3)

# Voice encoder for biometrics (lazy load to save memory)
_voice_encoder = None


def get_voice_encoder() -> VoiceEncoder:
    """Lazy load voice encoder"""
    global _voice_encoder
    if _voice_encoder is None:
        _voice_encoder = VoiceEncoder()
    return _voice_encoder


def preprocess_audio(audio_bytes: bytes, target_sr: int = 16000) -> torch.Tensor:
    """
    Preprocess audio bytes for model input
    
    Args:
        audio_bytes: Raw audio bytes (WAV, MP3, etc.)
        target_sr: Target sample rate (16kHz for WavLM)
        
    Returns:
        Tensor of shape (1, samples) at target sample rate
    """
    waveform, sr = torchaudio.load(io.BytesIO(audio_bytes))
    
    # Resample if necessary
    if sr != target_sr:
        resampler = torchaudio.transforms.Resample(sr, target_sr)
        waveform = resampler(waveform)
    
    # Convert stereo to mono
    if waveform.shape[0] > 1:
        waveform = torch.mean(waveform, dim=0, keepdim=True)
    
    return waveform.to(device)


def apply_vad(audio_bytes: bytes, min_duration: float = 2.0, frame_duration_ms: int = 30) -> bytes:
    """
    Apply Voice Activity Detection to filter silence
    
    Args:
        audio_bytes: Raw audio bytes
        min_duration: Minimum duration in seconds
        frame_duration_ms: Frame duration for VAD (10, 20, or 30ms)
        
    Returns:
        Filtered audio bytes with only speech segments
    """
    # For production, implement Silero VAD for better accuracy
    # This is a placeholder that returns the original audio
    return audio_bytes


def extract_behavioral_features(audio_bytes: bytes, sr: int = 16000) -> dict:
    """
    Extract behavioral voice features using Librosa
    
    Args:
        audio_bytes: Raw audio bytes
        sr: Sample rate
        
    Returns:
        Dictionary of behavioral features
    """
    y, sr = librosa.load(io.BytesIO(audio_bytes), sr=sr)
    
    # Pitch analysis
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    pitch_values = pitches[pitches > 0]
    pitch_var = float(np.std(pitch_values)) if len(pitch_values) > 0 else 0.0
    pitch_mean = float(np.mean(pitch_values)) if len(pitch_values) > 0 else 0.0
    
    # Tempo estimation
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo = float(librosa.feature.tempo(onset_envelope=onset_env, sr=sr)[0])
    
    # MFCC features
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    mfcc_mean = mfccs.mean(axis=1).tolist()
    
    # Zero crossing rate (speech vs non-speech indicator)
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
    
    # RMS energy
    rms = float(np.mean(librosa.feature.rms(y=y)))
    
    return {
        "pitch_variation": pitch_var,
        "pitch_mean": pitch_mean,
        "tempo": tempo,
        "mfcc_mean": mfcc_mean,
        "zero_crossing_rate": zcr,
        "rms_energy": rms,
    }


def compute_voice_embedding(audio_bytes: bytes) -> list[float]:
    """
    Compute voice embedding using Resemblyzer
    
    Args:
        audio_bytes: Raw audio bytes
        
    Returns:
        256-dimensional embedding as list of floats
    """
    encoder = get_voice_encoder()
    
    # Preprocess audio for Resemblyzer
    wav = preprocess_wav(io.BytesIO(audio_bytes))
    
    # Generate embedding
    embedding = encoder.embed_utterance(wav)
    
    return embedding.tolist()


def cosine_similarity(emb1: list[float], emb2: list[float]) -> float:
    """Compute cosine similarity between two embeddings"""
    a = np.array(emb1)
    b = np.array(emb2)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def ensemble_liveness_score(
    audio_bytes: bytes,
    user_baseline: dict | None = None,
    user_embedding: list[float] | None = None,
) -> dict:
    """
    Compute ensemble liveness score combining multiple signals
    
    Components:
    1. WavLM ML Model (45% weight) - Deep learning liveness
    2. Deepfake Probability (30% weight) - From ML model
    3. Behavioral Analysis (25% weight) - Pitch/tempo anomalies
    
    Args:
        audio_bytes: Raw audio bytes
        user_baseline: Optional behavioral baseline for comparison
        user_embedding: Optional stored voice embedding for verification
        
    Returns:
        Dictionary with all scores and recommendation
    """
    # 1. Advanced ML Liveness (WavLM)
    waveform = preprocess_audio(audio_bytes)
    liveness_ml, deepfake_prob = model(waveform.unsqueeze(0))
    
    # 2. Behavioral Analysis (Librosa)
    behavioral_features = extract_behavioral_features(audio_bytes)
    
    # Compute behavioral risk based on anomalies
    behavioral_risk = 0.0
    
    # Flattened pitch → potential synthetic voice
    if behavioral_features["pitch_variation"] < 20:
        behavioral_risk += 0.4
    
    # Abnormal tempo (too fast or too slow)
    if behavioral_features["tempo"] < 60 or behavioral_features["tempo"] > 200:
        behavioral_risk += 0.2
    
    # Very low energy (might be replay attack with poor audio)
    if behavioral_features["rms_energy"] < 0.01:
        behavioral_risk += 0.2
    
    # Compare to baseline if available
    if user_baseline:
        baseline_pitch_var = user_baseline.get("pitch_variation", 0)
        if baseline_pitch_var > 0:
            pitch_diff = abs(behavioral_features["pitch_variation"] - baseline_pitch_var)
            if pitch_diff > baseline_pitch_var * 0.5:  # >50% deviation
                behavioral_risk += 0.2
    
    # Cap behavioral risk at 1.0
    behavioral_risk = min(behavioral_risk, 1.0)
    
    # 3. Voice Biometrics Match (if embedding provided)
    voice_match_score = 1.0
    if user_embedding:
        current_embedding = compute_voice_embedding(audio_bytes)
        voice_match_score = cosine_similarity(current_embedding, user_embedding)
    
    # 4. Compute overall risk (weighted ensemble)
    overall_risk = (
        0.45 * (1 - liveness_ml)
        + 0.30 * deepfake_prob
        + 0.25 * behavioral_risk
    )
    
    # Adjust for voice mismatch
    if voice_match_score < 0.7:
        overall_risk += 0.3 * (1 - voice_match_score)
        overall_risk = min(overall_risk, 1.0)
    
    # Determine recommendation
    if overall_risk > settings.HIGH_RISK_THRESHOLD:
        recommendation = "ESCALATE"
    elif overall_risk > 0.5:
        recommendation = "REVIEW"
    else:
        recommendation = "PROCEED"
    
    return {
        "liveness_score": round(liveness_ml, 4),
        "deepfake_probability": round(deepfake_prob, 4),
        "behavioral_risk": round(behavioral_risk, 4),
        "voice_match_score": round(voice_match_score, 4),
        "overall_risk": round(overall_risk, 4),
        "behavioral_features": behavioral_features,
        "recommendation": recommendation,
    }
