"""
Sprint 3 entry point: trains the imaging CNN on the organized
train/val/test split and saves it to config.IMAGING_MODEL_PATH.

Usage:
    python scripts/train_imaging.py

Honesty note: this is the first real execution of this code — it was
written and syntax-checked but never run end-to-end before now (see
src/models/imaging_model.py's module docstring). Whatever this prints
is the actual first real result, not a re-confirmation of something
already verified.
"""

import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import torch  # noqa: E402
import torch.nn as nn  # noqa: E402
from src.models.imaging_model import (
    build_dataloaders, build_model, train_one_epoch, evaluate_imaging_model, compute_class_weights,
)

DATA_DIR = "data/raw/kidney_ct"
EPOCHS = 8  # start small to see real timing before committing to a long run


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    if device.type == "cpu":
        print("No GPU detected — this will be slower. Starting with "
              f"{EPOCHS} epochs so you can see real per-epoch timing "
              "before deciding whether to let it run longer or move to Colab.\n")

    print("Building dataloaders...")
    train_loader, val_loader, test_loader = build_dataloaders(DATA_DIR, batch_size=32)
    print(f"  train batches: {len(train_loader)}, val batches: {len(val_loader)}, test batches: {len(test_loader)}\n")

    model = build_model(freeze_backbone=True).to(device)
    class_weights = compute_class_weights(train_loader.dataset).to(device)
    print(f"Class weights (higher = rarer class, penalized more): {class_weights.tolist()}\n")
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    trainable_params = filter(lambda p: p.requires_grad, model.parameters())
    optimizer = torch.optim.Adam(trainable_params, lr=1e-3)

    for epoch in range(EPOCHS):
        start = time.time()
        train_loss, train_acc = train_one_epoch(model, train_loader, optimizer, criterion, device)
        val_results = evaluate_imaging_model(model, val_loader, device)
        elapsed = time.time() - start
        print(f"Epoch {epoch+1}/{EPOCHS}  train_loss={train_loss:.4f}  "
              f"train_acc={train_acc:.4f}  val_acc={val_results['accuracy']:.4f}  "
              f"({elapsed:.0f}s)")

    print("\nFinal evaluation on held-out test set...")
    test_results = evaluate_imaging_model(model, test_loader, device)
    print(f"Test accuracy: {test_results['accuracy']:.4f}\n")
    print(test_results["classification_report"])
    print("Confusion matrix:", test_results["confusion_matrix"])

    config.SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), config.IMAGING_MODEL_PATH)
    print(f"\nSaved model to {config.IMAGING_MODEL_PATH}")


if __name__ == "__main__":
    main()