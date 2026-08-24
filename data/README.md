# Data sourcing notes

## Primary source (available now)
**UCI Chronic Kidney Disease dataset** — 400 records, 24 clinical/lab
features (Rubini, Soundarapandian & Eswaran, 2015, CC BY 4.0,
https://doi.org/10.24432/C5G020). Stored at `data/raw/uci_ckd.csv`,
retrieved via a GitHub mirror of the original CSV since the UCI
archive itself isn't reachable from every network environment. This
file IS committed to git (see the .gitignore exception) since it's
public and anonymized — unlike any future real hospital data.

## Parallel track (request sent, Sprint 1)
**St. Paul's Hospital Millennium Medical College (Addis Ababa) CKD dataset**
— from Debal, D.A. & Sitote, T.M. (2022). "Chronic kidney disease
prediction using machine learning techniques." Journal of Big Data,
9(109). https://doi.org/10.1186/s40537-022-00657-5 (1,718 records,
19 features, collected 2018-2019). The paper's data-availability
statement says there are no restrictions on the dataset and the
authors are willing to share their code too — a direct request was
sent to the corresponding author (Dibaba Adeba Debal,
dibabaadeba44@gmail.com, cc Tilahun Melak Sitote,
the_melak@yahoo.com) on the date of this commit. Do not block
Sprint 1-2 on a reply — build and validate the baseline on the UCI
dataset first.

## Imaging modality (Sprint 3)
**Kaggle "CT KIDNEY DATASET: Normal-Cyst-Tumor and Stone"** —
~12,446 CT images, 4 classes, sourced from hospitals in Dhaka,
Bangladesh. Publicly downloadable. Used as a documented stand-in
for kidney imaging, since no public Ethiopian imaging dataset exists.

## Text modality (Sprint 3)
No public Ethiopian clinical-notes dataset exists. Notes are
generated synthetically from the tabular features as a documented
proxy — this must be stated plainly in the final report, not hidden.

## Rule for this repo
Raw data files are never committed to git (see `.gitignore`) —
only the code that fetches/generates them.

The UCI CSV above is the single deliberate exception, because it is public and
anonymized. **Real patient data stays out of git — permanently, not "until we
tidy up".** That includes the St. Paul's dataset when it arrives, and anything
from an Ethiopian hospital. `data/raw/` is gitignored apart from that one
exception, so the default is already correct; the way this rule gets broken is
someone adding a `-f` to force-add a file, or committing a derived CSV to a
directory that is not `data/raw/`.

---

## How to add a new dataset

Training is not hard-wired to UCI. A new CSV is a `DatasetSpec` entry plus a
flag on the training script — no new script, and no changes to the preprocessing
pipeline. Design rationale is in [AUDIT.md](../AUDIT.md) Part VI; this is the
procedure.

### 1. Put the CSV in `data/raw/`

```text
data/raw/your_dataset.csv
```

It stays out of git automatically. Nothing else in the repo needs to know the
path — the spec resolves bare filenames under `data/raw/` for you.

### 2. Look at the actual headers before writing anything

```bash
venv/Scripts/python.exe -c "import pandas as pd; d=pd.read_csv('data/raw/your_dataset.csv'); print(list(d.columns)); print(d.head(3).to_string())"
```

Do not write the mapping from a paper's feature table. The `ethiopian` spec in
[src/data/datasets.py](../src/data/datasets.py) currently has an **empty,
unverified** `column_map` for exactly this reason: the file has not arrived, so
there are no real headers to map, and guessing them would be a mapping nobody
had checked.

### 3. Add a `DatasetSpec`

In [src/data/datasets.py](../src/data/datasets.py), beside `UCI` and
`ETHIOPIAN`:

```python
MY_CLINIC = DatasetSpec(
    name="clinic",                       # what --dataset clinic refers to
    filename="your_dataset.csv",         # under data/raw/
    column_map={                         # source header -> canonical name
        "Age_Years": "age",
        "Serum_Creatinine": "sc",
        "Haemoglobin": "hemo",
        "PedalOedema": "pe",
        "Outcome": "classification",     # the label column MUST end up here
    },
    value_map={                          # only where the vocabulary differs
        "pe": {"Yes": "yes", "No": "no"},
    },
    target_map={"1": "ckd", "0": "notckd"},
    citation="Author (year). Title. DOI/URL.",
    license="whatever the source actually permits",
)

_REGISTRY[MY_CLINIC.name] = MY_CLINIC    # or call register(MY_CLINIC)
```

The canonical names are the 24 in `config.NUMERIC_COLUMNS` +
`config.BINARY_COLUMNS`. Columns you do not map are simply absent — they are
reported, not invented. You do **not** need all 24.

Three things to get right:

- **`column_map` must produce `config.TARGET_COLUMN`** (`classification`), or
  loading raises `SchemaMismatchError` listing the columns it did find.
- **`value_map` values must be words the encoder knows**: `yes`/`no`,
  `normal`/`abnormal`, `present`/`notpresent`, `good`/`poor`. Anything else
  raises. Keys are matched case-insensitively and whitespace-stripped, so
  `"Yes"`, `" YES "` and `"yes"` are the same key — meaning `Yes`/`No` sources
  usually need no `value_map` at all. `1`/`0` sources do.
- **`target_map` is mandatory unless the labels are already `ckd`/`notckd`.**
  A row with no usable label is not training data, so an unmapped label raises
  rather than being dropped.

### 4. Check it loads before training on it

```bash
venv/Scripts/python.exe scripts/train_baseline.py --list-datasets
```

This prints each registered dataset's row count, how many of the 24 canonical
features it provides, which are absent, and its licence — or tells you the file
is missing or the mapping is incomplete. A spec whose CSV has not arrived is
registered but unusable, and this distinguishes the two.

### 5. Train on it

```bash
# combined, on the features both datasets actually share
venv/Scripts/python.exe scripts/train_baseline.py --dataset uci,clinic --out-suffix combined

# the new dataset alone, for comparison
venv/Scripts/python.exe scripts/train_baseline.py --dataset clinic --out-suffix clinic
```

Use `--out-suffix` while evaluating. Without it, the default bundle the agent
loads is overwritten.

Two behaviours to expect:

- **Features intersect; they are not padded.** `--features all` *refuses* when a
  source lacks whole columns, because every row from that source would get the
  same fabricated value and the model can learn to read it as a dataset ID
  rather than as clinical signal. `--force` overrides with a warning that any
  resulting metric must disclose it.
- **A worse model is not saved.** Every run appends to
  `saved_models/metrics_history.jsonl` — including rejected runs — and the saved
  model is left untouched if recall drops below `config.MIN_ACCEPTABLE_RECALL`.
  Use `--force` to override, or `--out-suffix` to keep it separately.

### 6. Use it

```bash
venv/Scripts/python.exe -m src.agent.chatbot
```

The agent reads its question list from the saved preprocessor, so a model
trained on 10 shared features asks 10 questions rather than 24. Point it at a
suffixed bundle by training without `--out-suffix` once you are satisfied.

### What is not handled: units

`value_map` translates vocabularies, not scales. A source recording creatinine
in µmol/L instead of mg/dL, or glucose in mmol/L instead of mg/dL, will load
without complaint and train a quietly wrong model. Convert the column before
saving the CSV, and record in the spec's `citation` that you did. This is the
most likely way a first real ingestion goes wrong.
