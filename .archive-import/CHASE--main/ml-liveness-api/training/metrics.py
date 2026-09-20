"""
Evaluation Metrics for Voice Liveness Detection

Implements:
- Equal Error Rate (EER)
- Minimum tandem Detection Cost Function (t-DCF)
- ROC curves
- DET curves
"""

import numpy as np
from typing import Tuple, Optional
from scipy.optimize import brentq
from scipy.interpolate import interp1d


def compute_eer(scores: np.ndarray, labels: np.ndarray) -> float:
    """
    Compute Equal Error Rate (EER)
    
    EER is the point where False Acceptance Rate (FAR) equals
    False Rejection Rate (FRR).
    
    Args:
        scores: Array of spoof scores (higher = more likely spoof)
        labels: Array of ground truth labels (0=bonafide, 1=spoof)
        
    Returns:
        EER as a float between 0 and 1
    """
    # Separate scores by class
    bonafide_scores = scores[labels == 0]
    spoof_scores = scores[labels == 1]
    
    if len(bonafide_scores) == 0 or len(spoof_scores) == 0:
        return 0.5  # Cannot compute
    
    # Calculate FAR and FRR at different thresholds
    thresholds = np.sort(np.unique(scores))
    
    fars = []  # False Acceptance Rate (spoof accepted as bonafide)
    frrs = []  # False Rejection Rate (bonafide rejected as spoof)
    
    for threshold in thresholds:
        # FAR: proportion of spoof samples below threshold
        far = np.mean(spoof_scores < threshold)
        # FRR: proportion of bonafide samples above or at threshold
        frr = np.mean(bonafide_scores >= threshold)
        
        fars.append(far)
        frrs.append(frr)
    
    fars = np.array(fars)
    frrs = np.array(frrs)
    
    # Find EER using interpolation
    try:
        eer = brentq(
            lambda x: interp1d(thresholds, fars)(x) - interp1d(thresholds, frrs)(x),
            thresholds[0],
            thresholds[-1],
        )
        eer_value = interp1d(thresholds, fars)(eer)
    except ValueError:
        # Fallback: find closest point
        diff = np.abs(fars - frrs)
        idx = np.argmin(diff)
        eer_value = (fars[idx] + frrs[idx]) / 2
    
    return float(eer_value)


def compute_min_tdcf(
    scores: np.ndarray,
    labels: np.ndarray,
    p_target: float = 0.9405,
    c_miss: float = 1.0,
    c_fa: float = 10.0,
) -> float:
    """
    Compute minimum tandem Detection Cost Function (t-DCF)
    
    t-DCF is the primary metric for ASVspoof challenges, measuring
    the cost of spoofing attacks on a speaker verification system.
    
    Args:
        scores: Array of spoof scores
        labels: Array of ground truth labels
        p_target: Prior probability of target speaker (default for ASVspoof)
        c_miss: Cost of miss
        c_fa: Cost of false acceptance
        
    Returns:
        Minimum normalized t-DCF
    """
    # Separate scores
    bonafide_scores = scores[labels == 0]
    spoof_scores = scores[labels == 1]
    
    if len(bonafide_scores) == 0 or len(spoof_scores) == 0:
        return 1.0
    
    # Calculate FAR and FRR at different thresholds
    thresholds = np.sort(np.unique(np.concatenate([bonafide_scores, spoof_scores])))
    
    min_tdcf = float("inf")
    
    for threshold in thresholds:
        # False acceptance rate (spoof below threshold)
        p_fa = np.mean(spoof_scores < threshold)
        # False rejection rate (bonafide above threshold)
        p_miss = np.mean(bonafide_scores >= threshold)
        
        # Compute t-DCF
        tdcf = c_miss * p_miss * p_target + c_fa * p_fa * (1 - p_target)
        
        if tdcf < min_tdcf:
            min_tdcf = tdcf
    
    # Normalize by default cost
    default_tdcf = min(c_miss * p_target, c_fa * (1 - p_target))
    normalized_tdcf = min_tdcf / default_tdcf
    
    return float(normalized_tdcf)


def compute_roc_curve(
    scores: np.ndarray,
    labels: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Compute ROC curve
    
    Args:
        scores: Array of spoof scores
        labels: Array of ground truth labels
        
    Returns:
        fpr: False positive rates
        tpr: True positive rates
        thresholds: Decision thresholds
    """
    bonafide_scores = scores[labels == 0]
    spoof_scores = scores[labels == 1]
    
    thresholds = np.sort(np.unique(scores))[::-1]
    
    tprs = []
    fprs = []
    
    for threshold in thresholds:
        # TPR: correctly detect spoof
        tpr = np.mean(spoof_scores >= threshold)
        # FPR: incorrectly reject bonafide
        fpr = np.mean(bonafide_scores >= threshold)
        
        tprs.append(tpr)
        fprs.append(fpr)
    
    return np.array(fprs), np.array(tprs), thresholds


def compute_det_curve(
    scores: np.ndarray,
    labels: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute DET (Detection Error Tradeoff) curve
    
    DET curves plot FRR vs FAR in normal deviate scale,
    making it easier to compare systems at low error rates.
    
    Args:
        scores: Array of spoof scores
        labels: Array of ground truth labels
        
    Returns:
        frr: False rejection rates
        far: False acceptance rates
    """
    bonafide_scores = scores[labels == 0]
    spoof_scores = scores[labels == 1]
    
    thresholds = np.sort(np.unique(scores))
    
    frrs = []
    fars = []
    
    for threshold in thresholds:
        far = np.mean(spoof_scores < threshold)
        frr = np.mean(bonafide_scores >= threshold)
        
        fars.append(far)
        frrs.append(frr)
    
    return np.array(frrs), np.array(fars)


def compute_accuracy_at_threshold(
    scores: np.ndarray,
    labels: np.ndarray,
    threshold: float = 0.5,
) -> Tuple[float, float, float]:
    """
    Compute accuracy metrics at a specific threshold
    
    Args:
        scores: Array of spoof scores
        labels: Array of ground truth labels
        threshold: Decision threshold
        
    Returns:
        accuracy: Overall accuracy
        bonafide_accuracy: Accuracy on bonafide samples
        spoof_accuracy: Accuracy on spoof samples
    """
    predictions = (scores >= threshold).astype(int)
    
    # Overall accuracy
    accuracy = np.mean(predictions == labels)
    
    # Per-class accuracy
    bonafide_mask = labels == 0
    spoof_mask = labels == 1
    
    bonafide_accuracy = np.mean(predictions[bonafide_mask] == 0) if bonafide_mask.sum() > 0 else 0
    spoof_accuracy = np.mean(predictions[spoof_mask] == 1) if spoof_mask.sum() > 0 else 0
    
    return float(accuracy), float(bonafide_accuracy), float(spoof_accuracy)


def compute_confusion_matrix(
    scores: np.ndarray,
    labels: np.ndarray,
    threshold: float = 0.5,
) -> np.ndarray:
    """
    Compute confusion matrix
    
    Returns:
        2x2 matrix: [[TN, FP], [FN, TP]]
    """
    predictions = (scores >= threshold).astype(int)
    
    tn = np.sum((predictions == 0) & (labels == 0))
    fp = np.sum((predictions == 1) & (labels == 0))
    fn = np.sum((predictions == 0) & (labels == 1))
    tp = np.sum((predictions == 1) & (labels == 1))
    
    return np.array([[tn, fp], [fn, tp]])
