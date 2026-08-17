"""
Sprint 3: CNN for the kidney CT imaging modality. Use transfer
learning (pretrained ResNet18 from torchvision) rather than training
from scratch — the dataset is large enough for fine-tuning but
training from scratch would need far more compute and time than
this sprint allows.

IMPORTANT — honesty note: this file's code has NOT been executed in
the development sandbox (it has a hard disk quota well under
PyTorch's install size, so `pip install torch` fails there). It's
written to the same correctness standard as the rest of the
codebase and follows standard, well-documented torchvision transfer
-learning patterns, but it has not been run end-to-end the way
every other module in this project has been. Run it on Colab
(free GPU, plenty of disk) and treat the first run as the real
verification step — see notebooks/ for the Colab-ready version.
"""

from __future__ import annotations
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from torchvision import datasets, models, transforms

NUM_CLASSES = 4  # normal, cyst, tumor, stone
CLASS_NAMES = ["cyst", "normal", "stone", "tumor"]  # order matters: must match ImageFolder's alphabetical assignment of the real folder names (Cyst, Normal, Stone, Tumor), NOT the intuitive listing order

TRAIN_TRANSFORMS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),  # ImageNet stats, matches the pretrained backbone
])

EVAL_TRANSFORMS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def compute_class_weights(dataset):
    """
    Inverse-frequency class weights, to be passed into
    nn.CrossEntropyLoss(weight=...). Found necessary after the first
    real training run showed tumor recall at only 52% — tumor has
    ~3.7x fewer training images than cyst, so the model defaulted to
    the more familiar class whenever uncertain. Weighting makes
    mistakes on the rarer classes cost proportionally more during
    training, directly counteracting that.
    """
    counts = torch.zeros(len(dataset.classes))
    for _, label in dataset.samples:
        counts[label] += 1
    weights = counts.sum() / (len(counts) * counts)
    return weights

def build_dataloaders(data_dir, batch_size=32):
    """
    Expects data_dir/<class_name>/<image>.png structure (torchvision
    ImageFolder convention) — see src/data/load_imaging.py for how
    the raw Kaggle download should be organized into this layout.
    """
    train_ds = datasets.ImageFolder(f"{data_dir}/train", transform=TRAIN_TRANSFORMS)
    val_ds = datasets.ImageFolder(f"{data_dir}/val", transform=EVAL_TRANSFORMS)
    test_ds = datasets.ImageFolder(f"{data_dir}/test", transform=EVAL_TRANSFORMS)
    return (
        DataLoader(train_ds, batch_size=batch_size, shuffle=True),
        DataLoader(val_ds, batch_size=batch_size),
        DataLoader(test_ds, batch_size=batch_size),
    )


def build_model(num_classes=NUM_CLASSES, freeze_backbone=True):
    """
    Pretrained ResNet18 with the final layer replaced for our 4
    classes. Freezing the backbone means only the new final layer
    trains initially — much faster and less prone to overfitting on
    a dataset this size than fine-tuning the whole network from the
    start.
    """
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False
    model.fc = nn.Linear(model.fc.in_features, num_classes)  # this new layer is always trainable
    return model


def train_one_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss, correct, total = 0.0, 0, 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * images.size(0)
        correct += (outputs.argmax(1) == labels).sum().item()
        total += labels.size(0)
    return total_loss / total, correct / total


def evaluate_imaging_model(model, loader, device):
    """Accuracy + per-class breakdown on a held-out split."""
    model.eval()
    correct, total = 0, 0
    all_preds, all_labels = [], []
    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            preds = outputs.argmax(1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.cpu().tolist())

    from sklearn.metrics import confusion_matrix, classification_report
    return {
        "accuracy": correct / total,
        "confusion_matrix": confusion_matrix(all_labels, all_preds).tolist(),
        "classification_report": classification_report(all_labels, all_preds, target_names=CLASS_NAMES),
    }