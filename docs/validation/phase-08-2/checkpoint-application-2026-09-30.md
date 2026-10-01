# Inline S3 checkpoint application — 2026-09-30

**Status:** focused local checkpoint application proof passed. This is not S3 acceptance: the ledger
remains 51/75 and no gate is accepted. Scene/fog publication, integrated room alarms/drains/global
sequence, S5/S6/S7, Q16, and the complete final-source lifecycle remain pending. The later focused
oversized staging proof is recorded in the [staging validation record](checkpoint-staging-2026-09-30.md);
the near-4 MiB ceiling and integrated room flow remain unproven.

The local checkpoint application stores typed record deltas and scopes actor mutable keys by
`[encounterId, id]`. The Character ledger is Character-scoped. The play clock advances once per
checkpoint and is excluded from the canonical digest. Applying a checkpoint updates state, history
and the authority fence atomically; fixture rollback proved that a failed transaction restores all
three. The response renews authorization; checkpoint-originated writes suppress self input
invalidation.

Native v2 passed against the local `phase82-local-linux` backend. Source parity matched the captured
source at HEAD `33b34e19019726bbf1cacf234499050e4172546b`: 5,382 entries, no changed or added paths.
The proof passed rollback, altered-payload and foreign-epoch rejection, exact replay, altered replay
rejection, private/shared ledger partitioning, authority release, and fixture cleanup. The resulting
record shows the outside-play Campaign ledger, checkpoint-scoped Campaign ledger, and Character-scoped
Character ledger separately. Full native JSONL is intentionally retained only in ignored local
validation evidence.

| Check | Result | Evidence |
| --- | --- | --- |
| Shared codec, Worker checkpoint records and store tests | 65/65 across 3 files | `local-validation/phase82-checkpoint-application/records-tests-v1.log` |
| Encounter persistence/schema build (v1) and schema build (v2) | Pass | `local-validation/phase82-checkpoint-application/build-v1.log`, `build-v2.log` |
| Convex codegen (v2) | Pass | `local-validation/phase82-checkpoint-application/codegen-v2.log` |
| API typechecks (v2: 13/13 tasks; v3: 12/12 tasks) | Pass | `local-validation/phase82-checkpoint-application/typecheck-v2.log`, `typecheck-v3.log` |
| API tests v3 | 35/35 across 6 files | `local-validation/phase82-checkpoint-application/api-tests-v3.log` |
| Focused deployment to `http://127.0.0.1:3210` | Pass | `local-validation/phase82-checkpoint-application/local-deploy-v1.log` |
| Native checkpoint proof v2 | Pass; source parity matches | `local-validation/phase82-checkpoint-application/native-proof-v2.log`; ordered command `local-validation/local-convex-proofs/phase82-checkpoint-v2-20260930.command.txt`; manifest `local-validation/local-convex-proofs/phase82-checkpoint-v2-20260930.metadata.json`, parity `...source-parity.json`, summary `...log` |

The retained logs are recorded by check, not as a reconstructed end-to-end command order. The native
proof's command metadata gives its exact invocation and timestamps. The first native attempt (v1)
failed because it sent the internal function through Convex's public
HTTP function endpoint. The retained `native-proof-v1.log` records the missing public function
failure; it is not passing evidence. The caller was corrected to use the installed Convex client's
internal `/api/function` method, and v2 then passed. No compiler or tests were run for this
documentation-only record update.
