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

Every function here takes the feature lists as OPTIONAL arguments defaulting
to the config globals. That default keeps all existing callers working
unchanged, while letting src/data/datasets.py train on a reduced feature set
-- the intersection of what two source datasets actually share. A second
dataset will not have all 24 UCI columns, and hardcoding the column lists was
the thing that made ingesting one impossible. See AUDIT.md (Part VI).
"""

from __future__ import annotations
import pandas as pd


def _resolve_columns(numeric_columns=None, binary_columns=None):
    """
    Fall back to the canonical UCI feature lists when a caller does not
    specify a subset. Centralized so the default cannot drift between the
    six entry points in this module.
    """
    import config
    if numeric_columns is None:
        numeric_columns = config.NUMERIC_COLUMNS
    if binary_columns is None:
        binary_columns = config.BINARY_COLUMNS
    return list(numeric_columns), list(binary_columns)


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


def coerce_numeric(df: pd.DataFrame, columns) -> pd.DataFrame:
    """
    Force `columns` to a numeric dtype, turning unparseable entries into NaN.

    Three numeric columns in the UCI CSV (pcv, wc, rc) were found by inspection
    (Sprint 1) to contain stray artifacts from how the source file was
    assembled -- values like "\\t?" (a literal tab + question mark, meaning
    missing) and "\\t43" (a valid number with a leading tab). Strip whitespace,
    then coerce with errors="coerce" so anything still unparseable (like a bare
    "?") becomes NaN rather than silently crashing the imputer downstream.

    Extracted from load_raw_tabular so the dataset adapters in
    src/data/datasets.py reuse this handling instead of writing their own. A
    second copy of "how a messy CSV column becomes numeric" is the same class
    of duplication as the binary map in AUDIT.md (P1-8): real CSVs from other
    sources are at least as messy as this one, not less.

    Operates on a copy; the input frame is not modified.
    """
    df = df.copy()
    for col in columns:
        if col not in df.columns:
            continue
        # Note: pandas 3.x infers a native "str" dtype for mixed columns
        # by default (not the old "object" dtype), so check numeric-ness
        # directly rather than comparing dtype == object — the latter
        # silently misses these columns on pandas >= 3.0.
        if not pd.api.types.is_numeric_dtype(df[col]):
            df[col] = pd.to_numeric(df[col].astype(str).str.strip(), errors="coerce")
    return df


def load_raw_tabular(path, numeric_columns=None) -> pd.DataFrame:
    """
    Load the raw UCI CKD CSV, drop the non-feature id column, and coerce the
    numeric columns (see coerce_numeric for the messy-value details).
    """
    import config
    numeric_columns, _ = _resolve_columns(numeric_columns, None)

    df = pd.read_csv(path)
    if config.ID_COLUMN in df.columns:
        df = df.drop(columns=[config.ID_COLUMN])

    return coerce_numeric(df, numeric_columns)


def clean_target(series: pd.Series) -> pd.Series:
    """
    The raw target column has a couple of dirty values (e.g. "ckd\t"
    with a stray tab character, found by inspecting real value counts).
    Strip whitespace so "ckd" and "notckd" are the only two values.
    """
    return series.astype(str).str.strip()


def encode_tabular(df: pd.DataFrame, binary_columns=None) -> pd.DataFrame:
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
    _, binary_columns = _resolve_columns(None, binary_columns)

    df = df.copy()
    df[config.TARGET_COLUMN] = clean_target(df[config.TARGET_COLUMN])
    for col in binary_columns:
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

    The instance remembers its own column lists, and it is the object saved to
    saved_models/tabular_preprocessor.joblib -- so a saved preprocessor is
    self-describing. src/agent/chatbot.py reads feature_columns off it rather
    than off config, which is what lets a model trained on a reduced feature
    set automatically ask only the questions it actually needs.
    """

    def __init__(self, numeric_columns=None, binary_columns=None):
        from sklearn.impute import SimpleImputer
        from sklearn.preprocessing import StandardScaler

        self.numeric_columns, self.binary_columns = _resolve_columns(
            numeric_columns, binary_columns
        )
        # keep_empty_features=True guarantees the output keeps the same
        # column count even if some column were entirely missing in the
        # training split — otherwise SimpleImputer silently drops it and
        # train/test shapes diverge.
        self.numeric_imputer = SimpleImputer(strategy="median", keep_empty_features=True)
        self.binary_imputer = SimpleImputer(strategy="most_frequent", keep_empty_features=True)
        self.scaler = StandardScaler()
        self.fitted = False

    @property
    def feature_columns(self) -> list:
        """The exact column order transform() produces, and the model expects."""
        return self.numeric_columns + self.binary_columns

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


def encoded_feature_frame(df: pd.DataFrame, preprocessor) -> pd.DataFrame:
    """
    Stage 1 applied to already-canonical rows at INFERENCE time: select the
    model's features in the model's order, map the binary columns to 0/1, and
    coerce the numeric ones. Nothing is imputed or scaled, so a NaN in the result
    means exactly "this cell has no usable value".

    This is the single definition of how raw canonical rows become numbers,
    shared by the interactive agent (one row) and scripts/predict.py (a whole
    CSV). Writing the batch path separately would have reproduced two audit
    findings at once: a second copy of the binary map (AUDIT.md P1-8) and
    preprocessing re-implemented per script (P0-3, the leakage bug that spread to
    four of them).

    The learned half of "model-ready" stays where it already was --
    preprocessor.transform() -- so a caller finishes with:

        encoded  = encoded_feature_frame(df, preprocessor)
        features = preprocessor.transform(encoded)

    Two steps rather than one wrapper, because both callers genuinely need the
    intermediate frame and cannot reconstruct it afterwards: predict.py counts
    its NaNs per row to report n_imputed, and chatbot.answers_to_feature_row uses
    them to tell a deliberate skip apart from an answer that failed to parse.

    The column list comes off the preprocessor, not off config, so a model
    trained on the intersection of two datasets is fed exactly the features it
    was trained on -- see TabularPreprocessor's docstring.

    This deliberately mirrors encode_tabular() rather than being more permissive.
    A binary column arriving as 0/1 instead of the text vocabulary becomes NaN
    here, the same as it would during training; making inference accept input
    that training rejects is how the two drift apart (AUDIT.md P0-3).
    """
    feature_columns = list(preprocessor.feature_columns)
    missing = [c for c in feature_columns if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing column(s) {missing}. The loaded model was trained on "
            f"{len(feature_columns)} features and needs every one of them present "
            f"(blank cells are fine -- they are imputed); got {list(df.columns)}."
        )

    out = df[feature_columns].copy()
    for col in preprocessor.binary_columns:
        out[col] = encode_binary_column(out[col])
    for col in preprocessor.numeric_columns:
        # errors="coerce" rather than raising: an unparseable cell is missing
        # data, and it is the caller that decides whether that is acceptable.
        # This also guarantees a float dtype for an all-None column, which
        # would otherwise stay object and break the imputer.
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def split_train_test(df: pd.DataFrame, feature_columns=None):
    """
    Stratified train/test split using config.TEST_SIZE and
    config.RANDOM_SEED, stratified on config.TARGET_COLUMN so both
    classes are represented fairly in each split.

    Runs on the output of encode_tabular(), i.e. before imputation —
    splitting rows is unaffected by the NaNs still present at that point.
    """
    import config
    from sklearn.model_selection import train_test_split

    if feature_columns is None:
        feature_columns = config.FEATURE_COLUMNS

    X = df[list(feature_columns)]
    y = df[config.TARGET_COLUMN]
    return train_test_split(
        X, y,
        test_size=config.TEST_SIZE,
        random_state=config.RANDOM_SEED,
        stratify=y,
    )


def prepare_tabular(df: pd.DataFrame, numeric_columns=None, binary_columns=None):
    """
    The leak-free end-to-end tabular pipeline, and the function every
    caller should use:

        encode -> split -> fit the preprocessor on TRAIN ONLY -> transform both

    Returns (X_train, X_test, y_train, y_test, preprocessor).

    The returned preprocessor is what must be saved alongside the model:
    it is the only thing that can turn a new patient's raw answers into
    the exact representation the model was trained on.

    numeric_columns/binary_columns default to the full UCI feature set. Pass a
    subset to train on the intersection of several datasets' columns -- see
    src/data/datasets.py. The same lists are threaded through every stage, so
    the preprocessor, the model, and the agent cannot end up disagreeing about
    which features exist.
    """
    numeric_columns, binary_columns = _resolve_columns(numeric_columns, binary_columns)
    feature_columns = numeric_columns + binary_columns

    encoded = encode_tabular(df, binary_columns=binary_columns)
    X_train, X_test, y_train, y_test = split_train_test(
        encoded, feature_columns=feature_columns
    )

    preprocessor = TabularPreprocessor(
        numeric_columns=numeric_columns, binary_columns=binary_columns
    ).fit(X_train)
    return (
        preprocessor.transform(X_train),
        preprocessor.transform(X_test),
        y_train,
        y_test,
        preprocessor,
    )
