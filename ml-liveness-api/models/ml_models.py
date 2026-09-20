import torch
import torch.nn as nn
from transformers import WavLMModel
import torchaudio
import io

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


class WavLMLivenessModel(nn.Module):
    """
    WavLM + Attentive Classifier for Voice Liveness Detection
    
    Architecture:
    - WavLM base/large for feature extraction (768/1024-dim)
    - Freeze early layers, fine-tune last 8 layers
    - Adaptive average pooling (replace with MHFA for SOTA)
    - MLP classifier: bonafide vs spoof
    """

    def __init__(self, wavlm_variant: str = "microsoft/wavlm-base"):
        super().__init__()
        self.wavlm = WavLMModel.from_pretrained(wavlm_variant)
        
        # Freeze early layers (keep last 8 trainable for fine-tuning)
        for param in list(self.wavlm.parameters())[:-8]:
            param.requires_grad = False

        # Determine hidden size from model config
        hidden_size = self.wavlm.config.hidden_size  # 768 for base, 1024 for large

        # Simple pooling (replace with MHFA for SOTA performance)
        self.pooling = nn.AdaptiveAvgPool1d(1)

        # Classifier head
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 2),  # bonafide vs spoof
        )

        self.to(device)
        self.eval()

    def forward(self, waveform: torch.Tensor) -> tuple[float, float]:
        """
        Forward pass for liveness detection
        
        Args:
            waveform: Audio tensor of shape (batch, samples) at 16kHz
            
        Returns:
            liveness_score: 0-1 (higher = more likely real)
            deepfake_prob: 0-1 (higher = more likely fake)
        """
        with torch.no_grad():
            outputs = self.wavlm(waveform)
            features = outputs.last_hidden_state  # (batch, time, hidden_size)

        # Pooling across time dimension
        pooled = torch.mean(features, dim=1)  # (batch, hidden_size)

        # Classification
        logits = self.classifier(pooled)
        probs = torch.softmax(logits, dim=1)

        # Index 0 = bonafide, Index 1 = spoof
        deepfake_prob = probs[:, 1]
        liveness_score = (1 - deepfake_prob).item()

        return liveness_score, deepfake_prob.item()


class MHFAPooling(nn.Module):
    """
    Multi-Head Factorized Attentive Pooling (MHFA)
    
    For SOTA performance, replace AdaptiveAvgPool1d with this.
    Implements attention-weighted pooling across time dimension.
    """

    def __init__(self, hidden_size: int, num_heads: int = 8):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = hidden_size // num_heads
        
        self.query = nn.Linear(hidden_size, hidden_size)
        self.key = nn.Linear(hidden_size, hidden_size)
        self.value = nn.Linear(hidden_size, hidden_size)
        self.out = nn.Linear(hidden_size, hidden_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (batch, time, hidden_size)
        Returns:
            pooled: (batch, hidden_size)
        """
        batch_size, seq_len, hidden_size = x.shape

        # Compute attention weights
        q = self.query(x[:, 0, :]).unsqueeze(1)  # Use first token as query
        k = self.key(x)
        v = self.value(x)

        # Reshape for multi-head attention
        q = q.view(batch_size, 1, self.num_heads, self.head_dim).transpose(1, 2)
        k = k.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        v = v.view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)

        # Scaled dot-product attention
        scores = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim**0.5)
        attn_weights = torch.softmax(scores, dim=-1)
        
        # Weighted sum
        attended = torch.matmul(attn_weights, v)  # (batch, heads, 1, head_dim)
        attended = attended.transpose(1, 2).contiguous().view(batch_size, hidden_size)

        return self.out(attended)


# Initialize the global model instance
model = WavLMLivenessModel("microsoft/wavlm-base")
