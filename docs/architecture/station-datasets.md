# Station datasets

Lifecycle: `UPLOADED` → `VALIDATING` → `VALID` or `INVALID`; a valid dataset can become `PUBLISHED`, and the former active dataset becomes `ARCHIVED`. Files retain filename, media type, byte size, SHA-256 checksum, region, uploader, and immutable storage key.

Dataset source files are stored under `public/geo/station-datasets/` in the project directory. This requires the deployment filesystem to persist and be shared between application instances; it is not suitable as durable multi-instance production storage.

Publish and rollback require MongoDB transaction support and a per-region compare-and-set lock. Neither operation uses collection replacement or hard deletion.
