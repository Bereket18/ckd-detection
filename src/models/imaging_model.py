"""
Sprint 3: CNN for the kidney CT imaging modality. Use transfer
learning (pretrained ResNet18/MobileNetV2 from torchvision) rather
than training from scratch — the dataset is large enough for
fine-tuning but training from scratch would need far more compute
and time than this sprint allows.
"""

# TODO (Sprint 3):
#   - build_model(): load a pretrained backbone, replace the final
#     classification layer for the 4 CT classes
#   - train_imaging_model(...) / evaluate_imaging_model(...)
#   - run this on Google Colab (free GPU) — see requirements-advanced.txt
