"""
Sprint 3: download/load the public Kaggle "CT KIDNEY DATASET:
Normal-Cyst-Tumor and Stone" (~12,446 images, 4 classes) and set up
a torchvision ImageFolder / DataLoader pipeline for the CNN.
"""

# TODO (Sprint 3):
#   - fetch_kidney_ct_dataset(): download into data/raw/kidney_ct/
#   - build_dataloaders(): torchvision transforms + train/val/test
#     DataLoaders, using config.RANDOM_SEED for reproducible splits
