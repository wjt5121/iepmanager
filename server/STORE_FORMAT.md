# Local store format and commit boundary

`workspace.json` now contains one versioned snapshot:

```json
{"storeFormatVersion":1,"workspace":{},"auditEvents":[]}
```

Workspace mutations build both the workspace and audit history in memory. The store writes and fsyncs a temporary snapshot, closes it, atomically renames it over `workspace.json`, and fsyncs the directory. The rename is the single commit point. Reads use the canonical snapshot and never promote a leftover `.tmp` file. A failure before rename leaves both old values intact. If durability confirmation fails after rename, the error explicitly states that the change committed but durability is uncertain; reload and verify before retrying.

Legacy unwrapped `workspace.json` plus `audit-log.ndjson` remains readable. The next successful mutation validates their chain and correspondence, then publishes a version-1 snapshot. The old audit file is retained unchanged as migration evidence and is no longer the authoritative audit after migration. Failed migration leaves the old canonical files intact. A missing workspace with existing legacy audit history is an error, not permission to reseed. Inconsistent legacy state requires explicit recovery; it is not automatically repaired.

Older application versions cannot read this snapshot format correctly. Do not run an old checkout against a migrated data directory. This change does not migrate the development default data merely by running tests, which use temporary synthetic directories.

Audit verification checks sequence, hashes, event count, and correspondence with workspace audit entries. Hash verification is an integrity check, not an authenticated signature or proof against an attacker rewriting both state and hashes.

The guarantee covers one WorkspaceStore writer/process on a local filesystem supporting atomic rename. The existing in-process write queue serializes mutations. Cross-process locking, hardware power-loss testing, encrypted storage, backups/restore, and transactions covering separately written source/export/retention blobs are outside scope. A failed request can leave an unreferenced blob, but cannot publish an audit event independently of its workspace state. Whole-snapshot writes cost more as history grows; this bounded dev-store repair is not a substitute for a production transactional database.
