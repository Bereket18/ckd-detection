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
