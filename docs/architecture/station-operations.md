# Station Operations

Station operations are admin-only and always resolve an authorized canonical region on the server. Legacy stations without `regionCode` are intentionally excluded until the approved migration.

Stations retain MongoDB `_id`; production identity is `(regionCode, objectId)`, subject to the temporary global `objectId` unique index. Manual edits create an append-only audit event and a `StationOverride`. A dataset publish reapplies overrides after its source projection; source removal soft-deactivates a station and marks any override as unresolved.

Normal admins cannot modify audit logs. Dataset source files are kept in `public/geo/station-datasets/` and are served through the authorized download endpoint; deployment persistence is the operator's responsibility.
