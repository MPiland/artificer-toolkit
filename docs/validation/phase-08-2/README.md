# Phase 8.2 local validation record

**Current status — 2026-09-30:** local Phase 8.2 implementation is active; complete current-tree
release verification remains pending. The [acceptance ledger](../../roadmap/08-2-convex-cutover-acceptance.md)
is the status authority: 51/75 accepted, with 24 open (run `node scripts/acceptanceProgress.mjs` for
live counts). Earlier stopped checkpoints below are historical evidence. None of the focused checks
is the complete R08 local release lifecycle.

## Acceptance evidence by gate

One summary per gate gives each case's status, acceptance date, proof tier, criteria and evidence origin. Most raw evidence they cite lives only in the Codex backup worktree and will be superseded by the final R08 re-proof.

- [Gate 1 — Foundation, auth, operations](gate-1-foundation-auth-operations.md)
- [Gate 2 — Content and rules](gate-2-content-rules.md)
- [Gate 3 — Characters, Campaigns, Social](gate-3-characters-campaigns-social.md)
- [Gate 4 — Scene, Encounter, VTT](gate-4-scene-encounter-vtt.md)
- [Gate 5 — Cutover and release](gate-5-cutover-release.md)
- [Gate readiness review, 2026-09-25](gate-readiness-2026-09-25.md): five passes (2026-09-25 to 2026-09-27, last against `aa68fd681`) that leave 64 criteria and 12 cases READY_FOR_ACCEPTANCE, with the missing clause of every criterion still open

## R08 preparation

- [R08 preparation, 2026-09-26](r08-prep-2026-09-26.md): drivers through the Session room, scripted container fixtures, the V14.4 real-backend reaction race, lifecycle tooling fixes, the lifecycle run (stopped at Storybook tests) and open findings
- [V15 local workload, 2026-09-26](v15-local-2026-09-26.md): the updated workload and why no run completed

## Module-load speed

- [D55 lazy schema spike, 2026-09-27](d55-lazy-schema-spike-2026-09-27.md): where per-call module load goes, the patterns tried and the rollout plan
- [D59 lazy schema rollout, 2026-09-27](d59-lazy-schema-rollout-2026-09-27.md): module load 56–83% lower on five hot function graphs, zero differences against the merge base, and the gates run

## ADR 0035

- [S0 measurements, 2026-09-27](adr-0035-s0-2026-09-27.md): room CPU in workerd, the Durable Object cost model for V15, checkpoint delta sizes against the Convex free plan, the token lifetime and Convex transaction limits; recommends N = 120 s, a 240 s lease and memory-only previews
- [Private receipt retirement, 2026-09-30](private-receipt-retirement-2026-09-30.md): D71 attribution,
  54 focused tests, native three-ledger deletion/rollback/retry/privacy proof, source identity and
  retained failures; checkpoint integration, the final lifecycle and Q16 remain pending
- [Acknowledged checkpoint prefix, 2026-09-30](checkpoint-prefix-2026-09-30.md): 58 focused checks,
  10 native SQLite checks, prefix compaction, retained suffix recovery and rollback; S3 publication
  remains pending
- [Inline S3 checkpoint application, 2026-09-30](checkpoint-application-2026-09-30.md): typed delta
  application and native rollback/replay/ledger/privacy proof passed against local Convex; no gate
  accepted, and Scene/fog publication, integrated room coordination and S5/S6/S7 remain pending
- [Oversized checkpoint staging, 2026-09-30](checkpoint-staging-2026-09-30.md): staged 240 KiB
  chunk upload and retry after uploaded-byte deletion passed native local proofs; 4 MiB ceiling,
  Scene/fog publication, integrated room coordination, S5/S6/S7 and full lifecycle remain open

## Character access

- [Compact Spell preparation, 2026-09-30](compact-spell-picker-2026-09-30.md): snapshot metadata,
  virtualization, focused checks, all three frozen native Builder-to-Sheet journeys, fixture
  restoration and before/after access maxima; broad authored-input reads and Q16 remain open

## Local checkpoints

Complete output and manifests are retained under ignored `local-validation/phase82-goal-20260923/` in the regular checkout; the copy from the detached worktree completed successfully (robocopy exit 3). `local-validation/phase82-relocation-20260924/transfer-result.json` records the checkout transfer. This durable summary intentionally excludes raw logs, payloads and secrets.

| Checkpoint                             | Final recorded proof                                                                                                                                                                                                                                                                                                                                                                                                                   | Source and limits                                                                                                                                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial START and initiative responses | Serial API/Convex/Worker typechecks 10/10; START and Recharge commit/retry/rollback; four initiative integer responses and one order choice; exact round-wrap prior-row history and replay.                                                                                                                                                                                                                                            | `do-rules-execution/initial-start/README.md` and `types-final02.log`; before movement responses, declarations and room dispatch.                                                                                                   |
| Movement responses                     | 31 passing focused cases across 8 files; serial types 10/10; format/lint on 39 TypeScript files; 8 private entrypoints free of heavy preparation and emitted Kernel/compiler imports. Private Passage final response rolls back fully, consumes one allowance and replays; PLAYER Concentration response checks assignment revocation, derived child receipt and no duplicate cleanup; response admission and native regressions pass. | `do-rules-execution/movement-responses/README.md`, `types03.log`, `source-after.json`; SHA-256 `27047BE566B2B6180396F7B024054B4D9B03A6ED396C2C4F554C2FC12C373F90`. This source identity predates declaration edits and relocation. |
| Relocation                             | 3,376 files copied, 1,526 unchanged, 1,283 tracked obsolete files removed; regular `AGENTS.md` and spell mapper edits preserved.                                                                                                                                                                                                                                                                                                       | `local-validation/phase82-relocation-20260924/transfer-result.json`; transfer evidence, not a build or test pass.                                                                                                                  |
| Initiative declarations                | Patch applied; two private response-order tests fail on stale Character action equipment facts. Latest compiler failed a test union access, corrected but not rerun. Read-only review completed.                                                                                                                                                                                                                                       | [Durable declaration checkpoint](initiative-declarations.md); `types01.log`, `types02.log`, `private01.log`, and 15-file `source-stopped.json`. **No current-tree pass or new acceptance.**                                        |

The movement-response sequence corrected earlier fixture assertions before its final pass. Its private response cases passed 2/2, native regressions 9/9, Passage 13/13 and Concentration 7/7; these runs overlap the stated **31 distinct cases**. Earlier failed/incomplete logs remain retained and are not passing evidence. Initial START's simultaneous compiler/Vitest attempt crashed or crossed a 60-second fixture auth lifetime; the later serial compiler and isolated round-wrap run superseded it. Keep compiler and Vitest serial on this machine.

The declaration checkpoint records the ordered attempted checks and retained source hashes. Final typecheck, complete scoped format/lint, private import proof and successful declaration tests remain unrun or incomplete. The local release lifecycle was not run. Do not mark R06, R08 or V15 accepted from this checkpoint. Managed R09/V15 and R10 require their separate approval and evidence.
