# Station region migration gate

This implementation does not assign a region to existing station rows, drop the global `objectId` index, or mutate trip and ride history. Run the audit script first and obtain approval before any backfill.

The approved migration must verify region coverage, duplicate IDs, dependent records, indexes, MongoDB transaction support, a database backup, and a dry-run result. The approximately 33 eastern outliers must be reviewed individually; they must not be assigned automatically.
