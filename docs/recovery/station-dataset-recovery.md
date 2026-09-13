# Dataset recovery

If a published dataset is incorrect, validate the previously published archived dataset, review its preview, and use the region-scoped rollback action. Rollback creates a new audited publication event and never deletes dataset history.

If a publication fails, its transaction is aborted and the per-region lock is released. Investigate the audit record, R2 checksum, and MongoDB replica-set transaction support before retrying. Restore a database backup only under the approved production recovery process.
