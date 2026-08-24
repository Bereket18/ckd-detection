"""
Dataset ingestion: map any CKD CSV onto this project's canonical feature
contract, so training is not hard-wired to the one dataset it started with.

Why this file exists. Until now `fetch_uci_ckd()` was called directly by five
scripts and `preprocess.py` read the column lists from `config` globals, so a
second dataset could not be loaded at all -- `load_raw_tabular` would raise
KeyError on the first UCI column the new file happened not to have. That is a
problem for a project whose stated goal is Ethiopian CKD data: the St. Paul's
Hospital dataset (1,718 records, 19 features) does not have all 24 UCI columns,
and no realistic hospital extract will.

The canonical contract is the UCI schema in config.py: config.NUMERIC_COLUMNS,
config.BINARY_COLUMNS, target config.TARGET_COLUMN holding "ckd"/"notckd", and
binary columns holding the text vocabulary encode_binary_column() understands.
A DatasetSpec says how to get from some source CSV to that contract.

The honest constraint this module enforces
------------------------------------------
Two datasets rarely share all their columns, and there are only three things
you can do about it:

  1. INTERSECT  -- train on the features both sources actually have. Loses
                   features, gains one clean combined model. Usually correct.
  2. TWO MODELS -- keep them separate. Supported by just not combining them.
  3. IMPUTE THE GAP -- treat an entirely absent column as "missing" and let the
                   imputer fill it from the other dataset's median.

Option 3 is not defensible for a reported result: every row from the source
lacking that column gets an identical fabricated value, so the model can learn
to use it as a dataset ID rather than as clinical signal, and the accuracy it
buys is partly the accuracy of guessing which hospital a record came from.
AUDIT.md Part V called this out; combine_datasets() therefore *refuses* it
rather than leaving it as a footnote someone can skip. `force=True` overrides
with a loud warning, because "never" is not a thing a library gets to decide.

See AUDIT.md (Part VI) for the full design note.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

import config
from src.data.preprocess import clean_target, coerce_numeric

# The vocabulary encode_binary_column() recognizes. A DatasetSpec's value_map
# must land in this set; anything else silently becomes NaN downstream, which
# for a binary clinical field means the imputer substitutes a population mode
# the patient never reported -- the exact failure mode AUDIT.md P1-8 guards
# against in the agent.
CANONICAL_BINARY_VALUES = {
    "yes", "no", "normal", "abnormal", "present", "notpresent", "good", "poor",
}
CANONICAL_TARGET_VALUES = {"ckd", "notckd"}


class SchemaMismatchError(ValueError):
    """
    Raised when datasets are combined on a feature set one of them lacks.

    A ValueError subclass so existing `except ValueError` handling still
    catches it, but distinguishable for callers that want to offer the
    intersect-instead suggestion.
    """


@dataclass(frozen=True)
class DatasetSpec:
    """
    How to read one source CSV into the canonical schema.

    name          short identifier used on the command line (--dataset uci)
    filename      file under config.DATA_RAW_DIR, or an absolute path
    column_map    {source column -> canonical column}. Empty = already canonical.
    value_map     {canonical binary column -> {source value -> canonical value}}
                  Only needed when a source uses a vocabulary
                  encode_binary_column() does not already handle. "Yes"/"No"
                  needs nothing (it strips and lowercases); 1/0 does.
    target_map    {source label -> "ckd" | "notckd"}. Empty = already canonical.
    citation      provenance, so a trained model can say where its data came from
    license       licensing, so redistribution rules travel with the spec
    """

    name: str
    filename: str
    column_map: dict = field(default_factory=dict)
    value_map: dict = field(default_factory=dict)
    target_map: dict = field(default_factory=dict)
    citation: str = ""
    license: str = ""

    def resolve_path(self) -> Path:
        """Absolute filenames are used as given; bare names resolve under data/raw/."""
        path = Path(self.filename)
        return path if path.is_absolute() else config.DATA_RAW_DIR / path


@dataclass(frozen=True)
class Coverage:
    """Which canonical features a loaded dataset actually provides."""

    dataset: str
    n_rows: int
    numeric_present: list
    binary_present: list
    absent: list

    @property
    def n_present(self) -> int:
        return len(self.numeric_present) + len(self.binary_present)

    def summary(self) -> str:
        total = len(config.FEATURE_COLUMNS)
        line = f"[{self.dataset}] {self.n_rows} rows, {self.n_present}/{total} canonical features"
        if self.absent:
            line += f"\n    absent: {', '.join(self.absent)}"
        return line


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

UCI = DatasetSpec(
    name="uci",
    filename="uci_ckd.csv",
    # No maps needed: this file *defines* the canonical schema.
    citation=(
        "Rubini, L., Soundarapandian, P., & Eswaran, P. (2015). Chronic Kidney "
        "Disease [Dataset]. UCI Machine Learning Repository. "
        "https://doi.org/10.24432/C5G020"
    ),
    license="CC BY 4.0",
)

# Declared but inert until the file exists. The column_map below is a BEST
# GUESS from the paper's feature description, NOT from the actual file -- the
# data has been requested and not yet received (see data/README.md). It must be
# checked against the real CSV headers before any result is reported from it;
# load_dataset() will raise a clear FileNotFoundError until then, so nothing can
# silently train on a wrong mapping.
ETHIOPIAN = DatasetSpec(
    name="ethiopian",
    filename="ethiopian_ckd.csv",
    column_map={},
    citation=(
        "Debal, D.A. & Sitote, T.M. (2022). Chronic kidney disease prediction "
        "using machine learning techniques. Journal of Big Data, 9(109). "
        "https://doi.org/10.1186/s40537-022-00657-5 -- St. Paul's Hospital "
        "Millennium Medical College, Addis Ababa (1,718 records, 2018-2019)"
    ),
    license="per the authors' data-availability statement; request pending",
)

_REGISTRY: dict = {spec.name: spec for spec in (UCI, ETHIOPIAN)}


def register(spec: DatasetSpec) -> DatasetSpec:
    """
    Add a dataset to the registry at runtime.

    Used by tests, and the intended way to try a new file without editing this
    module. Returns the spec so it can be registered and used in one expression.
    """
    _REGISTRY[spec.name] = spec
    return spec


def unregister(name: str) -> None:
    """Remove a dataset from the registry. Tests use this to avoid leaking state."""
    _REGISTRY.pop(name, None)


def available_datasets() -> list:
    """Registered dataset names, whether or not their file is present on disk."""
    return sorted(_REGISTRY)


def get_spec(name_or_spec) -> DatasetSpec:
    """Accepts a registered name or a DatasetSpec, so callers can pass either."""
    if isinstance(name_or_spec, DatasetSpec):
        return name_or_spec
    if name_or_spec not in _REGISTRY:
        raise KeyError(
            f"Unknown dataset {name_or_spec!r}. Registered: {available_datasets()}. "
            "Add one with a DatasetSpec in src/data/datasets.py, or register() it."
        )
    return _REGISTRY[name_or_spec]


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def _normalize(series: pd.Series) -> pd.Series:
    """Lowercase, whitespace-stripped text -- the same normalization
    encode_binary_column() applies, so mapping keys behave predictably whether
    the CSV stored 1, "1", " Yes" or "YES"."""
    return series.astype(str).str.strip().str.lower()


def _apply_value_map(series: pd.Series, mapping: dict, column: str, dataset: str) -> pd.Series:
    """
    Translate one column's source vocabulary into the canonical one.

    Unmapped values raise rather than becoming NaN. A binary field that quietly
    turns to NaN is filled by the imputer with the population mode, which
    fabricates a clinical observation -- see AUDIT.md (P1-8) for the same bug in
    the agent. Genuinely missing entries are excluded from this check: blanks
    are legitimate and the imputer is the right place to handle them.
    """
    normalized_map = {str(k).strip().lower(): v for k, v in mapping.items()}
    unknown = set(normalized_map.values()) - CANONICAL_BINARY_VALUES
    if unknown:
        raise ValueError(
            f"[{dataset}] value_map for {column!r} maps to {sorted(unknown)}, which "
            f"encode_binary_column() does not understand. Use one of: "
            f"{sorted(CANONICAL_BINARY_VALUES)}."
        )

    normalized = _normalize(series)
    missing = series.isna() | normalized.isin({"", "nan", "none", "?"})
    mapped = normalized.map(normalized_map)

    unmapped = sorted(set(normalized[~missing & mapped.isna()]))
    if unmapped:
        raise ValueError(
            f"[{dataset}] column {column!r} contains value(s) {unmapped} that its "
            f"value_map does not cover. Add them to the DatasetSpec rather than "
            f"letting them become NaN and get imputed."
        )
    # mask() without `other` writes NaN, which is what encode_binary_column
    # produces for an unrecognized value and what the imputer expects.
    return mapped.mask(missing)


def load_dataset(name_or_spec, path=None):
    """
    Load one dataset into the canonical schema.

    Returns (df, coverage). The frame holds canonical column names, a cleaned
    "ckd"/"notckd" target, binary columns in the canonical text vocabulary, and
    numeric columns coerced to numbers with unparseable entries as NaN -- i.e.
    exactly what fetch_uci_ckd() has always returned, and exactly what
    encode_tabular()/prepare_tabular() expect next.

    Canonical columns the source does not provide are simply absent from the
    frame; they are reported in `coverage` rather than invented. `path`
    overrides the spec's location, which is what makes this testable against a
    temporary file.
    """
    spec = get_spec(name_or_spec)
    csv_path = Path(path) if path is not None else spec.resolve_path()

    if not csv_path.exists():
        raise FileNotFoundError(
            f"Dataset {spec.name!r} expects a CSV at {csv_path}, which is not present. "
            f"See data/README.md for sourcing notes."
            + (f"\nSource: {spec.citation}" if spec.citation else "")
        )

    df = pd.read_csv(csv_path)
    if spec.column_map:
        df = df.rename(columns=spec.column_map)
    if config.ID_COLUMN in df.columns:
        df = df.drop(columns=[config.ID_COLUMN])

    if config.TARGET_COLUMN not in df.columns:
        raise SchemaMismatchError(
            f"[{spec.name}] no {config.TARGET_COLUMN!r} column after applying column_map. "
            f"Columns found: {list(df.columns)}. The spec's column_map must rename the "
            f"source's label column to {config.TARGET_COLUMN!r}."
        )

    # Target first, and strictly: an unmapped label cannot be imputed or
    # dropped silently, because a row with no usable label is not training data.
    df[config.TARGET_COLUMN] = clean_target(df[config.TARGET_COLUMN]).str.lower()
    if spec.target_map:
        normalized_target_map = {str(k).strip().lower(): v for k, v in spec.target_map.items()}
        df[config.TARGET_COLUMN] = df[config.TARGET_COLUMN].map(normalized_target_map)
    bad_labels = sorted(set(df[config.TARGET_COLUMN].dropna()) - CANONICAL_TARGET_VALUES)
    if bad_labels or df[config.TARGET_COLUMN].isna().any():
        raise SchemaMismatchError(
            f"[{spec.name}] target column has value(s) {bad_labels or ['<missing>']} that are "
            f"not {sorted(CANONICAL_TARGET_VALUES)}. Add a target_map to the DatasetSpec."
        )

    numeric_present = [c for c in config.NUMERIC_COLUMNS if c in df.columns]
    binary_present = [c for c in config.BINARY_COLUMNS if c in df.columns]
    absent = [c for c in config.FEATURE_COLUMNS if c not in df.columns]

    for column, mapping in spec.value_map.items():
        if column in df.columns:
            df[column] = _apply_value_map(df[column], mapping, column, spec.name)

    df = coerce_numeric(df, numeric_present)

    coverage = Coverage(
        dataset=spec.name,
        n_rows=len(df),
        numeric_present=numeric_present,
        binary_present=binary_present,
        absent=absent,
    )
    return df, coverage


def shared_features(names):
    """
    The canonical features every named dataset provides, as
    (numeric_columns, binary_columns) in canonical order.

    Order comes from config, not from the datasets, so the feature order a
    model is trained on is deterministic regardless of the order datasets were
    listed on the command line.
    """
    coverages = [load_dataset(n)[1] for n in names]
    numeric = [c for c in config.NUMERIC_COLUMNS
               if all(c in cov.numeric_present for cov in coverages)]
    binary = [c for c in config.BINARY_COLUMNS
              if all(c in cov.binary_present for cov in coverages)]
    return numeric, binary


def combine_datasets(names, features: str = "intersect", force: bool = False):
    """
    Load several datasets and concatenate them into one training frame.

    Returns (df, numeric_columns, binary_columns, coverages) -- the feature
    lists are what to pass straight into prepare_tabular(), so the caller never
    has to work out the shared schema itself.

    features="intersect" (default) keeps only the columns every source provides.
    features="all" keeps the full canonical set and raises SchemaMismatchError
    if any source is missing columns -- see this module's docstring for why
    imputing an entirely absent column is not a reportable result. force=True
    downgrades that to a warning.

    A "source" column records which dataset each row came from. prepare_tabular
    selects only the feature and target columns, so it never reaches the model;
    it is there for provenance and for per-source error analysis.
    """
    if features not in {"intersect", "all"}:
        raise ValueError(f"features must be 'intersect' or 'all', got {features!r}")

    names = list(names)
    if not names:
        raise ValueError("combine_datasets needs at least one dataset name")

    loaded = [load_dataset(n) for n in names]
    coverages = [cov for _, cov in loaded]

    if features == "intersect":
        numeric, binary = shared_features(names)
    else:
        numeric = list(config.NUMERIC_COLUMNS)
        binary = list(config.BINARY_COLUMNS)
        incomplete = {cov.dataset: cov.absent for cov in coverages if cov.absent}
        if incomplete:
            detail = "; ".join(f"{name} lacks {absent}" for name, absent in incomplete.items())
            message = (
                f"features='all' was requested but {detail}. Every row from those "
                f"sources would get an identical imputed value for each absent column, "
                f"which the model can use to identify the dataset rather than the "
                f"patient. Use features='intersect' "
                f"({len(shared_features(names)[0]) + len(shared_features(names)[1])} "
                f"shared features) instead."
            )
            if not force:
                raise SchemaMismatchError(message)
            warnings.warn(
                "force=True: " + message + " Any metric produced from this run must "
                "state that absent columns were imputed wholesale.",
                UserWarning,
                stacklevel=2,
            )

    feature_columns = numeric + binary
    if not feature_columns:
        raise SchemaMismatchError(
            f"Datasets {names} share no canonical features, so there is nothing to "
            f"train on. Check each spec's column_map against its CSV headers."
        )

    frames = []
    for df, cov in loaded:
        # reindex, not df[cols]: a column this source genuinely lacks arrives as
        # all-NaN rather than raising. That only happens on the force=True path
        # above -- under "intersect" every column is present by construction --
        # and the warning there already says the gap will be imputed wholesale.
        subset = df.reindex(columns=feature_columns + [config.TARGET_COLUMN])
        subset["source"] = cov.dataset
        frames.append(subset)

    combined = pd.concat(frames, ignore_index=True)
    return combined, numeric, binary, coverages
