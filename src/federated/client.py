"""
Sprint 5: Flower (flwr) client — represents one simulated hospital.
Each client trains only on its own local partition of the data and
never sends raw records anywhere; only model weight updates leave
this class.
"""

# TODO (Sprint 5):
#   - CKDClient(flwr.client.NumPyClient): wraps a local model +
#     local data partition; implements get_parameters / fit / evaluate
#   - partition_data(df, num_clients): split the tabular dataset into
#     simulated hospital partitions (e.g. UCI as one client, any
#     Ethiopian data as another, if/when obtained)
