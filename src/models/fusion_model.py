"""
Sprint 4: combine the tabular, imaging, and text encoders into one
multimodal model. Only attempt this after the three single-modality
models (Sprint 2-3) are each independently trained and evaluated --
fusing three broken models is harder to debug than fusing three
working ones.
"""

# TODO (Sprint 4):
#   - FusionModel: concatenate the three encoded representations,
#     pass through a final classification head
#   - benchmark against the Sprint 2 tabular-only baseline -- the
#     whole point of this sprint is showing fusion adds real value,
#     not just complexity
