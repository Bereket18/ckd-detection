"""
Sprint 4 entry point: trains the multimodal fusion model and
compares it against the Sprint 2 tabular-only baseline (98.75%
accuracy) -- the whole point of this sprint is showing fusion adds
real value, not just complexity.

Usage:
    python scripts/train_fusion.py
"""

import sys
import time
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import config  # noqa: E402
import torch  # noqa: E402
import torch.nn as nn  # noqa: E402
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score  # noqa: E402

from src.data.load_tabular import fetch_uci_ckd  # noqa: E402
from src.data.preprocess import clean_tabular, split_train_test  # noqa: E402
from src.data.pair_modalities import build_image_pairing  # noqa: E402
from src.models.text_model import generate_synthetic_notes, encode_notes  # noqa: E402
from src.models.fusion_model import (  # noqa: E402
    FusionModel, load_frozen_imaging_encoder, encode_image,
)

EPOCHS = 30  # small dataset (400 rows), fast per epoch -- more epochs is cheap here


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    print("Loading and cleaning tabular data...")
    raw = fetch_uci_ckd()
    cleaned, _ = clean_tabular(raw)
    X_train, X_test, y_train, y_test = split_train_test(cleaned)
    print(f"  train: {len(X_train)} rows, test: {len(X_test)} rows")

    print("Generating synthetic notes + TF-IDF encoding...")
    notes_train = generate_synthetic_notes(raw.loc[X_train.index])
    notes_test = generate_synthetic_notes(raw.loc[X_test.index])
    text_train_matrix, vectorizer = encode_notes(notes_train)
    text_test_matrix, _ = encode_notes(notes_test, vectorizer=vectorizer)

    print("Pairing tabular rows with imaging examples (Sprint 4 simulated pairing)...")
    train_image_paths = build_image_pairing(cleaned.loc[X_train.index])
    test_image_paths = build_image_pairing(cleaned.loc[X_test.index], seed=43)  # different seed: test pairing independent of train

    print("Loading frozen Sprint 3 imaging encoder...")
    imaging_encoder = load_frozen_imaging_encoder(config.IMAGING_MODEL_PATH, device)

    print("Precomputing imaging embeddings for all paired images (one-time, frozen encoder)...")
    start = time.time()
    train_img_embeds = torch.stack([encode_image(p, imaging_encoder, device) for p in train_image_paths])
    test_img_embeds = torch.stack([encode_image(p, imaging_encoder, device) for p in test_image_paths])
    print(f"  done in {time.time() - start:.0f}s\n")

    tabular_train_t = torch.tensor(X_train.values, dtype=torch.float32).to(device)
    tabular_test_t = torch.tensor(X_test.values, dtype=torch.float32).to(device)
    text_train_t = torch.tensor(text_train_matrix.toarray(), dtype=torch.float32).to(device)
    text_test_t = torch.tensor(text_test_matrix.toarray(), dtype=torch.float32).to(device)
    y_train_t = torch.tensor((y_train.values == "ckd").astype(int), dtype=torch.long).to(device)
    y_test_t = torch.tensor((y_test.values == "ckd").astype(int), dtype=torch.long).to(device)

    model = FusionModel(
        tabular_dim=tabular_train_t.shape[1],
        text_dim=text_train_t.shape[1],
        imaging_dim=512,
    ).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
    criterion = nn.CrossEntropyLoss()

    print("Training fusion model...")
    for epoch in range(EPOCHS):
        model.train()
        optimizer.zero_grad()
        outputs = model(tabular_train_t, text_train_t, train_img_embeds)
        loss = criterion(outputs, y_train_t)
        loss.backward()
        optimizer.step()
        if (epoch + 1) % 5 == 0 or epoch == 0:
            train_acc = (outputs.argmax(1) == y_train_t).float().mean().item()
            model.eval()
            with torch.no_grad():
                test_outputs_check = model(tabular_test_t, text_test_t, test_img_embeds)
                test_acc_check = (test_outputs_check.argmax(1) == y_test_t).float().mean().item()
            print(f"  epoch {epoch+1}/{EPOCHS}  loss={loss.item():.4f}  train_acc={train_acc:.4f}  test_acc={test_acc_check:.4f}")

    print("\nEvaluating on held-out test set...")
    model.eval()
    with torch.no_grad():
        test_outputs = model(tabular_test_t, text_test_t, test_img_embeds)
        test_preds = test_outputs.argmax(1).cpu().numpy()
        test_proba = torch.softmax(test_outputs, dim=1)[:, 1].cpu().numpy()

    y_test_bin = y_test_t.cpu().numpy()
    precision, recall, f1, _ = precision_recall_fscore_support(y_test_bin, test_preds, average="binary", zero_division=0)
    accuracy = accuracy_score(y_test_bin, test_preds)
    auc = roc_auc_score(y_test_bin, test_proba)

    print(f"\nFusion model results:")
    print(f"  accuracy:  {accuracy:.4f}")
    print(f"  precision: {precision:.4f}")
    print(f"  recall:    {recall:.4f}")
    print(f"  f1:        {f1:.4f}")
    print(f"  auc_roc:   {auc:.4f}")
    print(f"\nSprint 2 tabular-only baseline was: accuracy=0.9875, recall=0.98")
    print("Compare the numbers above against that baseline honestly -- "
          "the point of this sprint is finding out whether fusion actually helps, not assuming it does.")

    config.SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), config.FUSION_MODEL_PATH)
    print(f"\nSaved model to {config.FUSION_MODEL_PATH}")


if __name__ == "__main__":
    main()