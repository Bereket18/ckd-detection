"""
Data cleaning and preprocessing for the tabular (clinical/lab) modality.

The important structural rule in this file: cleaning is split into two
stages, and the boundary between them is what keeps the evaluation honest.

  1. encode_tabular()     -- row-independent. Each row's output depends
                             only on that row (strip the target, map the
                             binary text categories to 0/1). Safe to run
                             on the whole dataset before splitting.
  2. TabularPreprocessor  -- LEARNS from the data it sees (imputation
                             medians, scaling mean/std). Must be fit on
                             the TRAINING split only, then applied to test.

Fitting stage 2 before splitting leaks test-set statistics -- the median
used to fill missing values and the mean/std used to standardize -- into
the training data, which silently inflates every reported metric. That is
exactly what this module used to do (see AUDIT.md, P0-3). prepare_tabular()
is the one function callers should use: it enforces the correct order, so
the mistake cannot be reintroduced by accident at a call site the way it
was replicated across four training scripts before.
"""

from __future__ import annotations
import pandas as pd


def encode_binary_column(series: pd.Series) -> pd.Series:
    """
    Map the UCI CKD dataset's binary text categories to 0/1.

    Handles the four label pairs that appear in this dataset: yes/no,
    normal/abnormal, present/notpresent, and good/poor (used only by
    the appet column — found by inspecting real unique values in
    Sprint 1; missing this pair silently turned the entire appet
    column to NaN). Strips whitespace first, since the raw CSV has
    stray leading spaces and tabs (e.g. " yes", "\\tno").
    Unrecognized or missing values are returned as NaN so they can be
    handled explicitly by the imputation step in TabularPreprocessor,
    rather than silently becoming 0.
    """
    mapping = {
        "yes": 1, "no": 0,
        "normal": 1, "abnormal": 0,
        "present": 1, "notpresent": 0,
        "good": 1, "poor": 0,
    }
    cleaned = series.astype(str).str.strip().str.lower()
    return cleaned.map(mapping)


def load_raw_tabular(path) -> pd.DataFrame:
    """
    Load the raw UCI CKD CSV and drop the non-feature id column.

    Most missing values in this CSV are genuinely blank/NaN. But three
    numeric columns (pcv, wc, rc) were found by inspection (Sprint 1) to
    contain stray artifacts from how the source file was assembled —
    values like "\\t?" (a literal tab + question mark, meaning missing)
    and "\\t43" (a valid number with a leading tab). Both are handled
    here: strip whitespace, then coerce to numeric with errors="coerce"
    so anything still unparseable (like a bare "?") becomes NaN rather
    than silently crashing the imputer downstream.
    """
    import config
    df = pd.read_csv(path)
    if config.ID_COLUMN in df.columns:
        df = df.drop(columns=[config.ID_COLUMN])

    for col in config.NUMERIC_COLUMNS:
        # Note: pandas 3.x infers a native "str" dtype for mixed columns
        # by default (not the old "object" dtype), so check numeric-ness
        # directly rather than comparing dtype == object — the latter
        # silently misses these columns on pandas >= 3.0.
        if not pd.api.types.is_numeric_dtype(df[col]):
            df[col] = pd.to_numeric(df[col].astype(str).str.strip(), errors="coerce")

    return df


def clean_target(series: pd.Series) -> pd.Series:
    """
    The raw target column has a couple of dirty values (e.g. "ckd\t"
    with a stray tab character, found by inspecting real value counts).
    Strip whitespace so "ckd" and "notckd" are the only two values.
    """
    return series.astype(str).str.strip()


def encode_tabular(df: pd.DataFrame) -> pd.DataFrame:
    """
    Stage 1 of cleaning: the row-independent part.

    Cleans the target and encodes the binary text columns to 0/1. Every
    output row depends only on the corresponding input row, so running
    this on the full dataset before splitting leaks nothing.

    Missing values are deliberately left as NaN here — filling them
    requires learning a median/mode from data, which belongs in
    TabularPreprocessor where it can be restricted to the training split.
    """
    import config

    df = df.copy()
    df[config.TARGET_COLUMN] = clean_target(df[config.TARGET_COLUMN])
    for col in config.BINARY_COLUMNS:
        df[col] = encode_binary_column(df[col])
    return df


class TabularPreprocessor:
    """
    Stage 2 of cleaning: the three transforms that have to LEARN from
    data, bundled into one object so they are fit, saved, and applied
    together.

    Bundling is the point. These used to be fit inline in a single
    function and only the StandardScaler was saved, so the agent had to
    remember to re-apply it by hand at inference time (a bug that did
    happen — see the note in agent/chatbot.py) and the imputer's learned
    medians were discarded entirely. Now "preprocess this patient exactly
    the way training did" is one call, and one file on disk.

    Fit on the training split only. transform() is what runs on test data
    and on live patient input.
    """

    def __init__(self):
        import config
        from sklearn.impute import SimpleImputer
        from sklearn.preprocessing import StandardScaler

        self.numeric_columns = list(config.NUMERIC_COLUMNS)
        self.binary_columns = list(config.BINARY_COLUMNS)
        # keep_empty_features=True guarantees the output keeps the same
        # column count even if some column were entirely missing in the
        # training split — otherwise SimpleImputer silently drops it and
        # train/test shapes diverge.
        self.numeric_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        self.binary_imputer = SimpleImputer(strategy="most_frequent", keep_empty_features=True)
        self.scaler = StandardScaler()
        self.fitted = False

    def fit(self, X: pd.DataFrame) -> "TabularPreprocessor":
        self.numeric_imputer.fit(X[self.numeric_columns])
        self.binary_imputer.fit(X[self.binary_columns])
        # The scaler must be fit on imputed values, not on NaNs — fitting
        # it on the raw column would compute mean/std from the non-missing
        # subset only, which is a different (and less correct) statistic
        # than the one the model will actually see at transform time.
        self.scaler.fit(self.numeric_imputer.transform(X[self.numeric_columns]))
        self.fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        if not self.fitted:
            raise RuntimeError(
                "TabularPreprocessor.transform() called before fit(). Fit on the "
                "training split first (or use prepare_tabular, which does it for you)."
            )
        out = X.copy()
        imputed_numeric = self.numeric_imputer.transform(out[self.numeric_columns])
        out[self.numeric_columns] = self.scaler.transform(imputed_numeric)
        out[self.binary_columns] = self.binary_imputer.transform(out[self.binary_columns])
        return out

    def fit_transform(self, X: pd.DataFrame) -> pd.DataFrame:
        return self.fit(X).transform(X)


def split_train_test(df: pd.DataFrame):
    """
    Stratified train/test split using config.TEST_SIZE and
    config.RANDOM_SEED, stratified on config.TARGET_COLUMN so both
    classes are represented fairly in each split.

    Runs on the output of encode_tabular(), i.e. before imputation —
    splitting rows is unaffected by the NaNs still present at that point.
    """
    import config
    from sklearn.model_selection import train_test_split

    X = df[config.FEATURE_COLUMNS]
    y = df[config.TARGET_COLUMN]
    return train_test_split(
        X, y,
        test_size=config.TEST_SIZE,
        random_state=config.RANDOM_SEED,
        stratify=y,
    )


def prepare_tabular(df: pd.DataFrame):
    """
    The leak-free end-to-end tabular pipeline, and the function every
    caller should use:

        encode -> split -> fit the preprocessor on TRAIN ONLY -> transform both

    Returns (X_train, X_test, y_train, y_test, preprocessor).

    The returned preprocessor is what must be saved alongside the model:
    it is the only thing that can turn a new patient's raw answers into
    the exact representation the model was trained on.
    """
    encoded = encode_tabular(df)
    X_train, X_test, y_train, y_test = split_train_test(encoded)

    preprocessor = TabularPreprocessor().fit(X_train)
    return (
        preprocessor.transform(X_train),
        preprocessor.transform(X_test),
        y_train,
        y_test,
        preprocessor,
    )
