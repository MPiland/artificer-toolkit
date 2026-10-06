# Private receipt retirement — 2026-09-30

**Status:** focused local proof passed for the receipt-storage foundation and
[D71](../../adr/0035-room-authoritative-live-encounters.md#d71-bounded-deferred-private-payload-purge--2026-09-30).
Final integration, F12, S3, R08, V15 and Q16 remain pending. Phase 8.2 remains 51/75 accepted,
with 24 cases open.

D71 was recommended and decided by Codex, with user approval on 2026-09-30. Account/Character
state, private receipt headers and durable purge intent are removed in one transaction. Unreachable
private payloads are purged in bounded, retryable transactions. Shared Encounter history remains;
no history retention cap is introduced. The [decision ledger](../../handoffs/phase-08-2-open-questions.md)
and ADR record the intentional change to D70's physical cleanup boundary.

## Source and environment

- Branch: `codex/phase-08-2-convex-cutover`; base HEAD:
  `33b34e19019726bbf1cacf234499050e4172546b`. The proof includes uncommitted source changes.
- Native source inventory: `local-validation/local-convex-proofs/phase82-receipt-max-v8-20260930.source-before.json`,
  captured at `2026-09-30T16:15:58.6163759Z`.
- Inventory SHA-256: `6B41639A55AE0FBCEAEF01FF0F856D0D4CA881ED50B5D4B568B9F4399DB243BA`.
  Post-run parity matches all 5,362 entries, with no changed or added source paths.
- Existing container: `phase82-convex-local-linux`; instance: `phase82-local-linux`;
  API `http://127.0.0.1:3210`, site `http://127.0.0.1:3211`. No cloud deployment was used.
- Native proof ran from `2026-09-30T16:15:58.6831941Z` to `2026-09-30T16:16:21.9769508Z`, exit 0.
  The admin key was generated inside the container and used only in memory.

## Ordered verification

Compiler, tests and native commands were serialized through `local-validation/.validation.lock`.
TypeScript used `GOMAXPROCS=2`, Turbo concurrency one and loose environment mode.

| Order | Command                                                                                                                                                                                                 | Result              | Log under `local-validation/phase82-receipt-native-integration/` |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| 1     | `yarn workspace @artificer-toolkit/apis test:convex apps/apis/convex/lib/receiptLedgers.test.ts apps/apis/convex/characters/receiptCleanup.test.ts apps/apis/convex/characters/accountDeletion.test.ts` | Exit 0; 54/54 tests | `private-purge-tests-v8.log`, `.exit`                            |
| 2     | `yarn turbo run build --filter=@artificer-toolkit/schema --filter=@artificer-toolkit/encounter-persistence --filter=@artificer-toolkit/rules-runtime --concurrency=1 --env-mode=loose`                  | Exit 0              | `dependency-build-v8.log`, `.exit`                               |
| 3     | `yarn turbo run typecheck:convex --filter=@artificer-toolkit/apis --concurrency=1 --env-mode=loose`                                                                                                     | Exit 0              | `typecheck-v8.log`, `.exit`                                      |
| 4     | Local `convex codegen --typecheck disable`, with explicit localhost URL and runtime-generated key                                                                                                       | Exit 0              | `local-codegen-v8.log`, `.exit`                                  |
| 5     | Local `convex deploy --yes --typecheck disable --codegen disable`, with the same localhost target                                                                                                       | Exit 0              | `local-deploy-v8.log`, `.exit`                                   |
| 6     | `pwsh -NoProfile -File scripts/runLocalConvexProof.ps1 -Name phase82-receipt-max-v8-20260930 -Proof receipt-ledgers`                                                                                    | Exit 0              | `native-proof-v8.log`, `.exit`                                   |

The ignored `run-types-v8.ps1` and `run-native-v8.ps1` wrappers retain precise invocations.
The native packet retains `.metadata.json`, `.command.txt`, `.guard.json`, `.native-executions.jsonl`,
capture metadata and source inventories under
`local-validation/local-convex-proofs/phase82-receipt-max-v8-20260930.*`.

## Proven behavior

- Three ledgers each hold exactly 4,194,304 bytes, read back completely with checksums, public
  identities, scalar headers and pointers validated. Native paging/replay complete in four pages;
  public keyset paging/replay complete in three. Oversized cursor windows are refused before
  body reads, retaining continuation metadata without truncating results.
- Creation rollback reaches its deliberate post-create marker. Retirement rollback reaches its
  post-removal/purge-intent marker. Both restore prior state; an early rate-limit, timeout or
  authorization refusal cannot pass the checks.
- The real `auth:onDelete` hook atomically removes the Character, profile and all three private
  headers. The former authenticated client immediately loses access to private history.
- Purge deletes at most four parts per pass, checks private scope and live-reference absence,
  completes through scheduled native mutations and removes its intent. Two completed retries
  are harmless. Focused tests preserve shared/unrelated history and prove malformed metadata
  and live references abort without partial cleanup.
- Exact fixture accounts, credentials, sessions, aliases and drafts are removed through SDK
  cleanup; stale JWTs are then denied.

| Native function                                             | Maximum recorded wall time | Maximum recorded database read bytes |
| ----------------------------------------------------------- | -------------------------: | -----------------------------------: |
| Account-deletion hook, including idempotent fixture cleanup |                    0.208 s |                               12,308 |
| Retirement rollback mutation                                |                    0.275 s |                               14,475 |
| Purge, 16 scheduled passes plus two completed retries       |                    0.146 s |                            1,968,243 |

These are focused maxima, not workload percentiles. First maximal construction took 1.047 s wall
time and 0.917 s user execution time; its deliberate rollback took 0.682 s user execution time.
These figures establish no frozen-workload, free-tier-headroom or final release pass.

## Failed attempts and remaining gates

Earlier attempts remain retained. Version 5 timed out constructing the fixture before any write.
Version 6 completed retirement but failed a premature stale-JWT assertion: app deletion had run,
while SDK auth-account removal had not. Version 7 failed when construction timed out before the
required rollback marker. They are failed runs, not acceptance evidence.

Final source removes redundant self-pointer validation during publication; canonical body,
checksum, logical schema, public key, scope and header validation remain. Static review found no
lost integrity check. Fixture-only maximal writes are spaced 1,250 ms apart for the local write-rate
window; frozen gameplay/chat cadence is unchanged.

Checkpoint publication, room authority, held Sheets, final account/browser acceptance, the complete
local lifecycle and Q16 remain open. Subsequent documentation updates do not replace the required
final-source release manifest.
