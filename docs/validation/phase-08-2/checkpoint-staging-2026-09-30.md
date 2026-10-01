# Oversized checkpoint staging — 2026-09-30

**Status:** focused local staging and inline-retry proofs passed. No acceptance changed: the ledger
remains 51/75. Scene/fog publication, unified global room sequence, room alarms/final drain, S5/S6/S7,
Q16 and the complete final-source lifecycle remain pending.

The Worker publishes payloads up to 240 KiB inline; larger record payloads are uploaded in indexed
240 KiB UTF-8 chunks. Staging binds immutable byte counts to the epoch and checkpoint fence. Commit
validates the complete staged payload and applies it with state, history, acknowledgement and staging
deletion in one transaction. An exact acknowledged retry succeeds after uploaded bytes have been
deleted without applying the payload again. This follows the current local implementation documented
in [live-session coordination](../../architecture/live-sessions.md).

The native staged fixture covered 64 valid reminders, a 4,000-character multibyte note and a private
play receipt. It passed rollback of an upload baseline, refusal of incomplete or changed parts,
identical begin/part retries, commit cleanup, current authorization response, exact retry after byte
deletion, authority release and fixture cleanup. The native inline v3 proof also passed. Both native
runs matched source parity at 5,392 entries with no changed or added paths. Exact native invocations,
timestamps and full evidence are retained in ignored `local-validation/local-convex-proofs/` files
linked below.

| Check | Result | Retained evidence |
| --- | --- | --- |
| Build | 6 tasks passed | `local-validation/phase82-checkpoint-staging/build-v1.log` |
| Typecheck | 14 tasks passed; Worker used dry-run only | `local-validation/phase82-checkpoint-staging/typecheck-v1.log` |
| Transport tests, initial run | 2 fixture owner-UUID comparisons failed; corrected | `local-validation/phase82-checkpoint-staging/transport-tests-v1.log` |
| Transport tests, corrected run | 33/33 across 5 files | `local-validation/phase82-checkpoint-staging/transport-tests-v2.log` |
| API tests | 40/40 across 7 files | `local-validation/phase82-checkpoint-staging/api-tests-v1.log` |
| Lint | Initial unused fixture metadata field fixed; rerun passed | `local-validation/phase82-checkpoint-staging/lint-v1.log`, `lint-v2.log` |
| Convex codegen and focused local deployment | Pass | `local-validation/phase82-checkpoint-staging/codegen-v1.log`, `local-deploy-v1.log` |
| Native staged upload proof | Pass; source parity matches | `local-validation/phase82-checkpoint-staging/native-proof-v1.log`; command, metadata, parity and summary under `local-validation/local-convex-proofs/phase82-checkpoint-staging-v1-20260930.*` |
| Native inline retry proof | Pass; source parity matches | `local-validation/phase82-checkpoint-staging/inline-native-proof-v3.log`; command, metadata, parity and summary under `local-validation/local-convex-proofs/phase82-checkpoint-v3-20260930.*` |

`native-stats-v1.json` records one successful staged commit at 217.15 ms total / 175.88 ms user,
reading 3,287,046 bytes across 41 documents and writing 1,208,071 bytes across 81 documents. Its
exact replay was 31.85 ms, reading 4,885 bytes across 11 documents and writing zero bytes. These are
fixture measurements, not a performance gate. The near-4 MiB journal-page ceiling remains unproven.
The full final-source lifecycle and integrated room publication remain outside this proof.
