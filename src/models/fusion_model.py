"""
Sprint 4: combine the tabular, imaging, and text encoders into one
multimodal model. Only the fusion head and two small per-modality
encoders (tabular, text) are trained here -- the imaging backbone
stays frozen, reusing Sprint 3's trained weights purely as a fixed
feature extractor. This keeps training fast even on CPU: the model
trains on the 400 tabular-patient rows (each paired with one image
via pair_modalities.py and one synthetic note), not the full
12,446-image imaging dataset.

Honesty note: like imaging_model.py, this has NOT been executed in
the development sandbox (same disk-quota/no-torch constraint there).
Written to the same correctness standard and the pairing logic it
depends on (pair_modalities.py) IS tested. The first real
execution of the torch-dependent parts is on the user's machine.
"""

from __future__ import annotations
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

EVAL_TRANSFORMS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


class TabularEncoder(nn.Module):
    """Small MLP: raw scaled tabular features -> fixed-size embedding."""
    def __init__(self, in_features, embed_dim=16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 32),
            nn.ReLU(),
            nn.Linear(32, embed_dim),
            nn.ReLU(),
        )

    def forward(self, x):
        return self.net(x)


class TextEncoder(nn.Module):
    """Small linear layer: TF-IDF vector -> fixed-size embedding."""
    def __init__(self, in_features, embed_dim=16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, embed_dim),
            nn.ReLU(),
        )

    def forward(self, x):
        return self.net(x)


def load_frozen_imaging_encoder(weights_path, device):
    """
    Loads the Sprint 3 trained ResNet18, strips its final
    classification layer so it outputs a 512-dim feature embedding
    instead of a 4-class prediction, and freezes ALL parameters --
    used purely as a fixed feature extractor here, not fine-tuned
    further. The temporary 4-class fc layer below must exist before
    load_state_dict so the saved weights' shapes match; it's then
    immediately replaced with nn.Identity().
    """
    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 4)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.fc = nn.Identity()
    for param in model.parameters():
        param.requires_grad = False
    model.eval()
    return model.to(device)


def encode_image(image_path, imaging_encoder, device):
    img = Image.open(image_path).convert("RGB")
    tensor = EVAL_TRANSFORMS(img).unsqueeze(0).to(device)
    with torch.no_grad():
        return imaging_encoder(tensor).squeeze(0)


class FusionModel(nn.Module):
    """
    Concatenates tabular, text, and (precomputed, frozen) imaging
    embeddings, then a small classification head.
    num_classes=2 (ckd / notckd), matching the tabular baseline.
    """
    def __init__(self, tabular_dim, text_dim, imaging_dim=512, embed_dim=16, num_classes=2):
        super().__init__()
        self.tabular_encoder = TabularEncoder(tabular_dim, embed_dim)
        self.text_encoder = TextEncoder(text_dim, embed_dim)
        self.classifier = nn.Sequential(
            nn.Linear(embed_dim + embed_dim + imaging_dim, 32),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(32, num_classes),
        )

    def forward(self, tabular_x, text_x, imaging_embedding):
        tab_emb = self.tabular_encoder(tabular_x)
        text_emb = self.text_encoder(text_x)
        combined = torch.cat([tab_emb, text_emb, imaging_embedding], dim=1)
        return self.classifier(combined)