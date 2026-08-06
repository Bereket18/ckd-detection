# Data sourcing notes

## Primary source (available now)
**UCI Chronic Kidney Disease dataset** — 400 records, 24 clinical/lab
features. Download and place as `data/raw/uci_ckd.csv`. Also
mirrored on Kaggle if the UCI link is slow.

## Parallel track (not yet available)
**St. Paul's Hospital Millennium Medical College (Addis Ababa) CKD
dataset** — referenced in a 2022 Journal of Big Data study (1,718
records, 19 features), used with the authors' own collected data.
No public download link exists for this dataset as of this writing.
Group action item: email the paper's authors to request access.
Do not block Sprint 1-2 on this — build and validate the baseline
on the UCI dataset first.

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
