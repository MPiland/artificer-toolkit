# PLATFORM-18.T1: canonical replace mutation margin under the 1 s limit (2026-10-15)

Supports AC PLATFORM-18.1. Source: `apps/apis/convex/content/import.ts` (`importSubjects` replace branch), `authoredReplacement.ts` and `importBatches.ts`. Reference: [PLATFORM-5.T1 insert measurements](platform-5-t1-seed-mutation-margin-2026-10-15.md).

## Question

A corpus change now replaces a stored subject in place (insert next version, replace root, delete previous version with chunks and compilation, sync catalogue metadata, recompile children). The batch cost model (25 per record plus 1 per KiB, budget 100) was fitted to inserts. Does a replace still fit under the 1 s `userExecutionTime` limit?

## Measurement

`apps/apis/scripts/liveBackendReplaceProbe.ts`, run by `scripts/liveBackendValidation.mjs` (`replace` step) on the ephemeral self-hosted backend in `.github/workflows/live-backend.yml` after the full SRD seed (run 38843201832, a shared GitHub runner, not an idle workstation). Each probe replaces one subject with a relabelled copy through the real `content/import:importSubjects` mutation and restores it. Times are wall clock of the HTTP call (mutation time plus round trip), so they bound the mutation from above.

| Probe                                  | Document | Replace | Restore |
| -------------------------------------- | -------- | ------- | ------- |
| Largest Class                          | 156 KiB  | 242 ms  | 210 ms  |
| Largest Subclass (re-reads its parent) | 18 KiB   | 142 ms  | 137 ms  |
| Race with the most subraces            | 7 KiB    | 94 ms   | 104 ms  |
| Equipment with the most variants       | 3 KiB    | 143 ms  | 152 ms  |
| Background                             | 12 KiB   | 94 ms   | n/a     |

The following seed step then replaced the left-changed Background (`"replaced": 1`) and the audit passed.

## Finding and fit

A replace of a small record costs about 100-150 ms, against about 28 ms for the insert model (25 + 3 KiB). The per-KiB fit under-prices replaces by roughly 4-5x, so three small replaces packed into one batch (budget 100) could cost 300-450 ms idle and exceed 1 s on a loaded host (3-6x).

No limit is raised and nothing is retried. Instead the seed reads the stored checksums (`readSubjectChecksums`) before writing (`changedSubjectIds` in `seed.ts`) and `sourceImportBatches` gives every subject that will be replaced a batch alone. A replace batch then costs at most the figures above, the same shape as the Class floor that PLATFORM-5.T1 already accepts. A first seed or an unchanged reseed has no replaced subjects, so its batching is exactly as before. Corpus changes are rare and small, so the extra mutations are negligible.

## Residual risk

The largest Class replace (242 ms wall idle) is the floor, as for inserts; PLATFORM-5.T1 measured the Class insert floor at 717 ms under full host saturation, and a replace of the same Class is slower than its insert. A fully saturated host could approach the limit for that one subject. A loaded-host re-measurement of the replace path is not done here (the CI runner is shared but not saturated deliberately).
