import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd
import pytest
from src.data.pair_modalities import build_image_pairing


@pytest.fixture
def mock_image_dir(tmp_path):
    d = tmp_path / "train"
    for cls in ["Normal", "Cyst", "Stone", "Tumor"]:
        (d / cls).mkdir(parents=True)
        (d / cls / "img1.jpg").touch()
        (d / cls / "img2.jpg").touch()
    return d


def test_ckd_positive_rows_get_abnormal_images(mock_image_dir):
    df = pd.DataFrame({"class": ["ckd"] * 10})
    paths = build_image_pairing(df, image_dir=mock_image_dir)
    assert len(paths) == 10
    assert all(("Cyst" in p or "Stone" in p or "Tumor" in p) for p in paths)


def test_ckd_negative_rows_get_normal_images(mock_image_dir):
    df = pd.DataFrame({"class": ["notckd"] * 10})
    paths = build_image_pairing(df, image_dir=mock_image_dir)
    assert all("Normal" in p for p in paths)


def test_mixed_labels_get_correct_pools(mock_image_dir):
    df = pd.DataFrame({"class": ["ckd", "notckd", "ckd", "notckd"]})
    paths = build_image_pairing(df, image_dir=mock_image_dir)
    assert "Normal" in paths[1] and "Normal" in paths[3]
    assert all(("Cyst" in paths[i] or "Stone" in paths[i] or "Tumor" in paths[i]) for i in [0, 2])


def test_missing_class_folders_raises_clear_error(tmp_path):
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()
    df = pd.DataFrame({"class": ["ckd"]})
    with pytest.raises(FileNotFoundError):
        build_image_pairing(df, image_dir=empty_dir)