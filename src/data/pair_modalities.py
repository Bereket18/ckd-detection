"""
Sprint 4: pairs each tabular patient record with a synthetic imaging
example, since the tabular (UCI CKD, 400 patients) and imaging
(Kaggle CT Kidney, 12,446 images) datasets have no real shared
patients -- two unrelated public datasets. This is a documented,
explicit simulation strategy, not a claim of real correspondence:
CKD-positive patients are randomly paired with an abnormal-class
image (cyst, stone, or tumor); CKD-negative patients are randomly
paired with a normal-class image. This gives the fusion model a
plausible, label-consistent (though synthetic) multimodal training
signal -- the most defensible option available without real paired
data, and it is stated as such in the project's report rather than
presented as genuine per-patient imaging.
"""

import random
from pathlib import Path

import config


def build_image_pairing(tabular_df, image_dir="data/raw/kidney_ct/train", seed=42):
    """
    tabular_df must have config.TARGET_COLUMN (cleaned: "ckd"/"notckd").
    Returns a list of image file paths, one per row of tabular_df, in
    the same row order as tabular_df.
    """
    random.seed(seed)
    image_dir = Path(image_dir)

    normal_images = list((image_dir / "Normal").glob("*.*"))
    abnormal_images = (
        list((image_dir / "Cyst").glob("*.*"))
        + list((image_dir / "Stone").glob("*.*"))
        + list((image_dir / "Tumor").glob("*.*"))
    )
    if not normal_images or not abnormal_images:
        raise FileNotFoundError(
            f"Expected class folders (Normal/Cyst/Stone/Tumor) under {image_dir} -- "
            "run split_into_train_val_test() first (Sprint 3)."
        )

    paired_paths = []
    for label in tabular_df[config.TARGET_COLUMN]:
        pool = normal_images if label == "notckd" else abnormal_images
        paired_paths.append(str(random.choice(pool)))
    return paired_paths