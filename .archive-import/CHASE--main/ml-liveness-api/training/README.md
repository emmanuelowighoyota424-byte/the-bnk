# Training Guide: WavLM + AASIST Voice Liveness Model

This guide covers training the voice liveness detection model from scratch.

## Dataset Setup

### ASVspoof 2019 LA

1. Register at https://datashare.ed.ac.uk/handle/10283/3336
2. Download the LA (Logical Access) partition
3. Extract to your data directory

```
data/
├── ASVspoof2019_LA_train/
│   └── flac/
├── ASVspoof2019_LA_dev/
│   └── flac/
├── ASVspoof2019_LA_eval/
│   └── flac/
└── ASVspoof2019_LA_cm_protocols/
    ├── ASVspoof2019.LA.cm.train.trn.txt
    ├── ASVspoof2019.LA.cm.dev.trl.txt
    └── ASVspoof2019.LA.cm.eval.trl.txt
```

### Custom Dataset

Create a protocol file with format:
```
SPEAKER_ID AUDIO_FILE - - LABEL
```

Example:
```
LA_0001 LA_T_1234567 - - bonafide
LA_0002 LA_T_1234568 - - spoof
```

## Training

### Basic Training

```bash
python -m training.train \
  --data_dir /path/to/ASVspoof2019 \
  --output_dir ./checkpoints \
  --epochs 100 \
  --batch_size 32
```

### Advanced Training

```bash
python -m training.train \
  --data_dir /path/to/ASVspoof2019 \
  --output_dir ./checkpoints \
  --epochs 100 \
  --batch_size 32 \
  --learning_rate 1e-4 \
  --weight_decay 1e-5 \
  --warmup_steps 1000 \
  --gradient_accumulation_steps 2 \
  --fp16 \
  --freeze_wavlm_epochs 10 \
  --augmentation_prob 0.5 \
  --early_stopping_patience 15 \
  --wandb_project voice-liveness
```

### Multi-GPU Training

```bash
torchrun --nproc_per_node=4 -m training.train \
  --data_dir /path/to/ASVspoof2019 \
  --output_dir ./checkpoints \
  --distributed
```

## Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--data_dir` | Required | Path to dataset |
| `--output_dir` | `./checkpoints` | Output directory |
| `--epochs` | 100 | Training epochs |
| `--batch_size` | 32 | Batch size per GPU |
| `--learning_rate` | 1e-4 | Initial learning rate |
| `--weight_decay` | 1e-5 | Weight decay |
| `--warmup_steps` | 1000 | LR warmup steps |
| `--freeze_wavlm_epochs` | 10 | Epochs to freeze WavLM |
| `--augmentation_prob` | 0.5 | Augmentation probability |
| `--early_stopping_patience` | 15 | Early stopping patience |
| `--fp16` | False | Mixed precision training |
| `--wandb_project` | None | W&B project name |

## Data Augmentation

The training pipeline includes these augmentations:

- **Noise Injection**: Add background noise (SNR 5-20dB)
- **RIR Convolution**: Room impulse response simulation
- **Speed Perturbation**: 0.9x - 1.1x speed changes
- **Pitch Shifting**: +/- 2 semitones
- **Time Masking**: SpecAugment-style masking
- **Frequency Masking**: SpecAugment-style masking
- **Codec Simulation**: MP3/AAC compression artifacts

## Evaluation Metrics

| Metric | Description |
|--------|-------------|
| EER | Equal Error Rate |
| min t-DCF | Minimum tandem Detection Cost Function |
| AUC | Area Under ROC Curve |
| Accuracy | Classification accuracy |

## Expected Results

On ASVspoof 2019 LA eval:

| Model | EER (%) | min t-DCF |
|-------|---------|-----------|
| AASIST (baseline) | 0.83 | 0.028 |
| WavLM + AASIST | **0.52** | **0.018** |

## Exporting Models

### PyTorch

```python
from training.trainer import Trainer

trainer = Trainer.load_from_checkpoint("checkpoints/best_model.pt")
trainer.export_pytorch("models/liveness_model.pt")
```

### ONNX

```python
trainer.export_onnx("models/liveness_model.onnx")
```

### TorchScript

```python
trainer.export_torchscript("models/liveness_model.jit")
```

## Troubleshooting

### Out of Memory

- Reduce `batch_size`
- Enable `--fp16`
- Increase `--gradient_accumulation_steps`
- Use `--freeze_wavlm_epochs` to reduce memory during initial training

### Slow Training

- Enable `--fp16` for 2x speedup
- Use multiple GPUs with `torchrun`
- Pre-compute WavLM features (see `training/precompute.py`)

### Poor Performance

- Increase augmentation (`--augmentation_prob 0.7`)
- Train longer with patience (`--epochs 200 --early_stopping_patience 30`)
- Try different learning rates (`--learning_rate 5e-5`)
