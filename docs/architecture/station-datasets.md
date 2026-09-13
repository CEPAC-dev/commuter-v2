# Station datasets

Lifecycle: `UPLOADED` → `VALIDATING` → `VALID` or `INVALID`; a valid dataset can become `PUBLISHED`, and the former active dataset becomes `ARCHIVED`. Files are stored in Cloudflare R2 with filename, media type, byte size, SHA-256 checksum, region, uploader, and immutable storage key.

Required variables are `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_STATION_DATASETS_BUCKET`. Missing configuration returns a service-unavailable upload error; it is not durable storage.

Publish and rollback require MongoDB transaction support and a per-region compare-and-set lock. Neither operation uses collection replacement or hard deletion.
