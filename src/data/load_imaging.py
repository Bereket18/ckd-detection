"""
Sprint 3: download/organize the public Kaggle "CT KIDNEY DATASET:
Normal-Cyst-Tumor and Stone" (~12,446 images, 4 classes) into the
train/val/test folder-per-class layout that
src/models/imaging_model.py's build_dataloaders() expects.

Honesty note: this has NOT been run in the development sandbox —
Kaggle isn't reachable from that environment, and the dataset is far
too large for the sandbox's disk quota anyway. This is meant to run
on Colab (or any machine with the Kaggle CLI configured and a GPU),
not in this project's automated test suite. See
notebooks/02_imaging_training_colab.ipynb for the full walkthrough.
"""

import shutil
import random
from pathlib import Path


def fetch_kidney_ct_dataset(dest_dir="data/raw/kidney_ct_flat"):
    """
    Requires the Kaggle CLI configured with your own API credentials
    (kaggle.json in ~/.kaggle/ — see https://www.kaggle.com/docs/api).
    Run this on Colab, not in this project's local dev environment.
    """
    import subprocess
    Path(dest_dir).mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "kaggle", "datasets", "download",
        "-d", "nazmul0087/ct-kidney-dataset-normal-cyst-tumor-and-stone",
        "-p", dest_dir, "--unzip",
    ], check=True)
    return dest_dir


def _find_class_root(flat_dir: Path) -> Path:
    """
    Kaggle zips are inconsistent about nesting — sometimes the class
    folders sit directly in the download, sometimes wrapped in one or
    more redundant same-named parent folders (this dataset's zip
    wraps it twice: kidney_ct_flat/CT-KIDNEY.../CT-KIDNEY.../
    {Cyst,Normal,Stone,Tumor}/). Walk down through directories that
    contain exactly one subdirectory, until reaching the level with
    multiple subdirectories — that's the real class-folder level.
    Stray files alongside the single subdirectory (e.g. a loose CSV)
    are ignored; only directory count matters.
    """
    current = flat_dir
    while True:
        subdirs = [c for c in current.iterdir() if c.is_dir()]
        if len(subdirs) == 1:
            current = subdirs[0]
        else:
            return current


def split_into_train_val_test(flat_dir, out_dir="data/raw/kidney_ct", val_frac=0.15, test_frac=0.15, seed=42):
    """
    Kaggle's download is one folder per class with no train/val/test
    split already applied (and often extra wrapping folders — see
    _find_class_root). This creates the out_dir/{train,val,test}/<class>/
    layout build_dataloaders() expects, splitting each class
    independently so the class balance is preserved in every split.
    """
    random.seed(seed)
    flat_dir, out_dir = Path(flat_dir), Path(out_dir)
    class_root = _find_class_root(flat_dir)
    class_dirs = [d for d in class_root.iterdir() if d.is_dir()]
    print(f"Found {len(class_dirs)} class folders at: {class_root}")

    for class_dir in class_dirs:
        images = list(class_dir.glob("*.*"))
        random.shuffle(images)
        n = len(images)
        n_val, n_test = int(n * val_frac), int(n * test_frac)
        splits = {
            "val": images[:n_val],
            "test": images[n_val:n_val + n_test],
            "train": images[n_val + n_test:],
        }
        for split_name, files in splits.items():
            split_dir = out_dir / split_name / class_dir.name
            split_dir.mkdir(parents=True, exist_ok=True)
            for f in files:
                shutil.copy(f, split_dir / f.name)

    return str(out_dir)