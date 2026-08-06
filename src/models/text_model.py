"""
Sprint 3: encoder for the clinical-notes modality. Since no public
Ethiopian clinical-notes dataset exists, notes are synthetically
generated from the tabular features as a documented proxy (see
docs/ for the honesty note that belongs in the final report).
"""

# TODO (Sprint 3):
#   - generate_synthetic_notes(df): template-based short text per
#     patient row, derived from their tabular values
#   - encode_notes(notes): start with TF-IDF (scikit-learn) for a
#     reliable baseline; sentence-transformers is the optional
#     "more advanced" upgrade once TF-IDF works end-to-end
