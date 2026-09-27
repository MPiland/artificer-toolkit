# D59 lazy schema rollout, 2026-09-27

Rollout of the D55 ruling as planned in the [D55 spike](d55-lazy-schema-spike-2026-09-27.md). Base:
`codex/phase-08-2-convex-cutover` at `1822085c8`. The pattern and the lint rule are described in
[Transport: lazy schema construction](../../architecture/transport.md#lazy-schema-construction).
Raw logs and the equivalence harness are in ignored `local-validation/d59/`.

## What changed

- **Helpers.** `lazySchema` (from the spike) and `lazySchemaParts` in `packages/schema/src/zod.ts`.
- **Codemod.** `scripts/lazySchemas.mjs` re-ran on the current source instead of reusing the spike's
  transformed files. It wrapped 2,321 module-level initializers: 2,304 `z.*` chains and calls on
  other schemas, plus 17 calls to local schema builders (such as `createPathDtoSchema`), which the
  spike had left eager.
- **Hand edits,** listed by the codemod:
  - 25 shared shapes and variant lists in 18 files became `lazySchemaParts` builders.
  - 8 schemas read from another schema (`options[n]`, `.shape.x`) became lazy reads.
  - `grants/modifier.ts` builds its variant unions inside the lazy factory, as in the spike.
  - `ATTACK_TRIGGER_CODES` uses literal codes checked against the trigger enum.
- **TypeScript surface (not wire contracts).** `liveSessionEncounterConcentrationFields` is now a
  memoized builder: its 3 in-package users call it. `movementResolutionCommandBaseShape` is no longer
  exported: nothing outside its module used it.
- **Lint.** `yarn lint` now also runs `yarn lint:schemas` (`scripts/lazySchemas.mjs --check`).
  `@babel/parser` is declared as a root devDependency (already in the lockfile through Babel).
- **Test.** `packages/schema/src/__tests__/lazy-schemas.test.ts` builds and parses with every
  exported schema and fails if one is eager.
- **Content tables** are built on demand (`buildContentTables()`, memoized in `content/streams.ts`).
- **SRD manifest:** no change needed. `content/seed.ts` already decodes and parses it on first use.

## Equivalence against the merge base

`node local-validation/d59/equivalence.mjs` bundles the merge base's eager source (`git archive`) and
the working tree, then compares them. Result: **0 differences.**

- **Schemas:** 2,172 exported schemas in 283 modules. Structural fingerprint, `zodToConvex` JSON,
  JSON Schema (input and output), and `safeParse` results with issues are identical for all 2,172.
  The parse inputs are 14 probe values plus the 1,057 SRD subject documents, each through its kind's
  authored schema.
  - The fingerprint treats a lazy proxy and the schema it built as one instance. It still
    distinguishes two separately built instances, so lost sharing would show as a difference.
- **Convex deploy metadata:** `schema.ts` `export()` (422,635 chars) and `exportArgs()` /
  `exportReturns()` for all 553 registered functions in 477 modules are byte-identical.
- **Declarations** (informational). 8 of 350 `.d.ts` files differ:
  - `zod.d.ts` gains the helpers.
  - The two TypeScript surface changes above.
  - `effects/effect.d.ts` spells out default type arguments, as in the spike.
  - `features/option`, `subjects/class`, `subjects/race` and `subjects/shared` print the same union
    members in a different order.

## Module load, before and after

Measured with the spike's D52 harness (`importCost.mjs` and `compareSplit.mjs`). The harness bundles
like `convex deploy` and takes the warm median of 27 evaluations in fresh V8 contexts. Runs held the
validation lock. The machine is shared, and run-to-run noise is about ±10%.

| Function graph                        | Before, ms | After, ms | Change | Cold after, ms |
| ------------------------------------- | ---------- | --------- | ------ | -------------- |
| `encounters/projectionReads`          | 69.0       | 16.6      | −76%   | 97.5           |
| `liveSessions/encounterCaptureBundle` | 147.0      | 26.0      | −82%   | 154.3          |
| `liveSessions/encounterActionCommit`  | 159.2      | 27.6      | −83%   | 173.4          |
| `liveSessions/encounterMovement`      | 165.1      | 39.1      | −76%   | 198.7          |
| `http` (router)                       | 56.9       | 25.2      | −56%   | 109.8          |

These are module evaluation only. A handler also pays for the schemas it builds on first use; the
spike traced that at about 2–60 ms per call, depending on the handler. Backend numbers still need the
browserless V15 re-run.

## Gates

Serialized under `local-validation/.validation.lock`:

- **Package builds:** passed. All packages were built through `yarn turbo run build --filter=@artificer-toolkit/apis`.
- **Package tests:**
  - schema: 58 files, 474/474, including the new test.
  - shared: 41 files, 265/265.
  - source-data: 6 files, 25/25.
  - authoring: 4 files, 13/13.
  - rules-runtime: 36 files, 399/399.
- **Convex suite** (`test:convex`): 362 files, 2,187/2,187.
- **Session Worker:** 9 files, 134/134.
- **Web (`test:web`):** 1,403/1,404 in two full runs. The failure is the same test both times, `FormPlatform.test.tsx`, "renders manifest behavior outcome paths inline inside the outcome editor". It timed out under full-suite load.
  - Alone, the file passes 25/25. That test takes 3.5 s with the lazy build and 3.8 s with the base build.
  - The same full suite run against the base schema build had 6 timeouts in 3 files, 1,398/1,404. So this is load flakiness that predates D59, not a regression.
- **Typecheck:**
  - `yarn turbo:affected:typecheck` (`GOMAXPROCS=2`, `--concurrency=1 --env-mode=loose`): 18/18. The fresh worktree first had to generate its ignored `worker-configuration.d.ts` with `yarn workspace @artificer-toolkit/session-worker types`.
  - `typecheck:convex`: passed.
- **Lint:** `yarn lint` passes: oxlint with `--deny-warnings`, then `lint:schemas` over 292 modules.
- **Format:** oxfmt is clean on every changed source file. `format:check` still reports 59 files that were already unformatted at the base, including two docs this change edits. They were left as they are.

Not run here: the local codegen push, the backend reset and the browserless V15 re-run. They are
left to the user, who owns Docker and the local Convex backend.

## Risks

- **Late construction errors.** These are covered by the resolve-everything test.
- **Parse cost.** The spike measured parsing through proxies at about 8% slower. That is a few ms
  against 30–130 ms saved per call.
- **Static check blind spot.** A schema built by a function imported from another module and called
  at module load is invisible to the lint rule. If it is exported, the test catches it.
- **Root schema imports.** Seven Convex modules import the root `schema.ts` at run time:
  `social/admissionLists`, `social/blockLists`, and five backfill or cleanup modules. Their graphs still build
  every table validator on each call. The two social modules are the candidates for the
  content-tables treatment if their queries matter.
