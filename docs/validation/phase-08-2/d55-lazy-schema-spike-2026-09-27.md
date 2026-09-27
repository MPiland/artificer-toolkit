# D55 lazy schema spike, 2026-09-27

Design spike for the D55 ruling (build schemas lazily, including the HTTP router path). This is
spike evidence, not the rollout. The prototype is on the spike branch only; see
[Rollout plan](#rollout-plan). Base: `codex/phase-08-2-convex-cutover` at `adcab9331`.

## Method

- **Import cost.** The D52 harness (`importCost.mjs`, `compareSplit.mjs`, `evaluateEsm.mjs`, copied to
  ignored `local-validation/d55/`) bundles every Convex module like `convex deploy` (esbuild, ESM,
  code splitting into `_deps` chunks, `convex` condition) and evaluates one function's closure in
  fresh V8 contexts with compiled code cached. Values are warm medians of 27 evaluations, in ms.
  D52 showed these track the backend's fixed per-call cost at about 1.0–1.25×.
- **Per-file breakdown.** `profileSplit.mjs` marks each source module's start and attributes time
  between marks. The marks inflate totals by about 25%, so read the shares, not the absolute sums.
- **Schemas a handler builds.** Lazy schemas are built on first use, so per-call cost is module
  evaluation plus the schemas the handler touches. A traced vitest config
  (`vitest.trace.config.mjs`) records, per Convex handler invocation, every lazy schema it
  resolves. It covers `encounters/queries`, `liveSessions/encounterActionAdmission`,
  `roomCaptureCache` and `stateHttp` tests. `tracedCost.mjs` then evaluates the target and builds
  the median-size and the largest recorded set.
- The machine was shared with other agents. Final numbers were taken while holding
  `local-validation/.validation.lock`; run-to-run noise is about ±10%.

## Where module load goes (before)

| Function graph                        | Eval, ms | `packages/schema` share | Other                                           |
| ------------------------------------- | -------- | ----------------------- | ----------------------------------------------- |
| `encounters/projectionReads`          | 57–59    | 87%                     | zod 7%, `packages/shared` 3%                    |
| `liveSessions/encounterCaptureBundle` | 131–142  | 87%                     | zod 5%, Convex modules 4% (`content/schema.ts`) |
| `liveSessions/encounterActionCommit`  | 139–146  | 88%                     | zod 4%, Convex modules 4% (`content/schema.ts`) |
| `http` (router)                       | 51–54    | 57%                     | better-auth 27%, zod 12%                        |

- **No single hot file.** The cost is Zod node construction spread over 100–300 schema files.
  Each schema instance runs zod's `$constructor` init chain (about 3–9 µs per node). The largest
  single files are `shared/facet`, `grants/modifier`, `api/characterSheet*`, `api/characterRules`,
  `subjects/characterIntent`, `api/vttScenes`, `api/encounterData` and `shared/optionalCombat`, at
  about 3–8 ms each.
- **Dominators.** `projectionReads` pays 40 ms of its 58 ms through one edge:
  `api/encounterData` imports a small schema (`creatureQualifiedDamageDefenseDtoSchema`) from
  `subjects/creature`. That pulls in the Creature → Feature → Effect union graph, which the handler
  never parses.
- **Router.** `liveSessions/transientHttp` pulls `api/liveSessionTransient` → `campaignList` →
  `authoredDrafts` → `imports`, plus `vttScenes`: about 32 ms. `authFactory.helper` (better-auth)
  is about 8–14 ms. `stateHttp` itself is already thin after D52.
- **Convex-side eager construction.** `content/streams.ts` imports `content/schema.ts` at run time,
  because convex-helpers `stream()` needs the tables' index lists. Its module load runs
  `zodToConvex` over every content table, about 7–11 ms per call for capture and commit.
- **Duplicate zod.** Three zod copies are evaluated: `zod/mini` (schema package), classic zod at
  the root, and classic zod under `apps/apis/node_modules`. Together they cost about 4–8 ms.

## Patterns tried

### (a) Lazy memoized schema accessor: recommended

`lazySchema(() => z.…)` in `packages/schema/src/zod.ts` returns a `Proxy` typed as the built
schema. Every trap forwards to the schema, which is built once on first access. Call sites,
`z.infer` types, `.shape`, `z.extend`/`z.pick`, `instanceof` (zod checks traits) and
`~standard` are unchanged.

- **Rollout mechanism.** A Babel-based codemod (`lazyCodemod.mjs`) wraps every module-level
  `const x = z.…` (2,262 sites), then every call rooted at another schema binding, such as
  `base.check(…)` (38 sites). Imperative top-level builders need a hand edit; `grants/modifier.ts`
  is the only one on the hot graphs. `z.json()` stays eager (see Risks). 272 of 293 files change,
  all mechanically.

| Function (warm ms)                   | Before  | Lazy, module eval | Lazy, eval plus schemas the handler builds (median / largest set) |
| ------------------------------------ | ------- | ----------------- | ----------------------------------------------------------------- |
| `projectionReads:get`                | 57–59   | 14–15             | 17.6 / 17.0 (20 / 32 schemas)                                     |
| `encounterCaptureBundle:capture`     | 131–142 | 29                | 41.5 / 58.3 (89 / 179 schemas)                                    |
| `encounterActionCommit:commit`       | 139–146 | 28–29             | 61.2 / 96.0 (151 / 377 schemas)                                   |
| `http` router                        | 51–54   | 25                | 26.7 (route handlers build 0 at the median)                       |
| `encounterMovement` (stage/commit)   | 145     | 38                | not traced                                                        |
| `encounterTurnCommit`                | 144     | 31                | not traced                                                        |
| `encounterRulesCapture`              | 124     | 26                | not traced                                                        |
| `pendingReads`                       | 82      | 18                | not traced                                                        |
| Whole `packages/schema`, all modules | 166–178 | 21–31             |                                                                   |

Cold (first-ever) evaluation also drops, for example the commit from 294 ms to 154 ms. The lazy
numbers include the content-tables fix below (about 6–8 ms for capture and commit).

**Equivalence, measured on the prototype:**

- `equivalence.mjs` bundles HEAD's eager source and the lazy source. For all 2,168 exported schemas
  in 283 modules it compares: the structural definition fingerprint (types, checks, shapes,
  options, values, refinement source), `zodToConvex` JSON, `z.toJSONSchema` output, and
  `safeParse` results with full issues for 14 probe inputs. It also parses all 311 SRD creatures
  through the Creature authored schemas. **All four measures match for 2,168 of 2,168.**
- `functionSpecs.mjs` bundles HEAD's `apps/apis/convex` (eager) and the working tree. For
  `schema.ts` (`export()`, 422 KB) and all 553 registered functions, `exportArgs()` and
  `exportReturns()` are byte-identical. That is exactly what `convex deploy` pushes.
- **Declarations.** 348 of 349 emitted `.d.ts` files are byte-identical to an eager build. The
  exception, `effects/effect.d.ts`, prints one `ZodMiniType<T>` with its default type arguments
  spelled out, which is the same type.
- **Checks.** `typecheck:convex` passes, as do the schema package tests (56 files, 460 tests) and
  these Convex test files: `encounters/queries`, `encounters/activeReads`,
  `liveSessions/encounterActionAdmission`, `roomCaptureCache`, `stateHttp`, `transientHttp`,
  `content/catalogueBrowse`, `equipmentCharacter`, `definitions`, `imports/jobs` and
  `imports/preview` (11 files, 70 tests). The traced run also passed (4 files, 25 tests).
- **Hot-path cost.** Parsing all 311 SRD creatures through proxied schemas takes 65–72 ms per pass
  against 59–63 ms eager (median of 60 passes, separate processes): about 8% more parse time. Only
  parsing pays it.

### (b) Router shells and dynamic dispatch: not needed, and dynamic import is unverified

- With (a), the router graph falls from about 52 ms to 25 ms without changing routes. What
  remains is better-auth (needed for the auth routes in the one allowed `http.ts`), three zod
  copies, and small Convex modules.
- **Dynamic `import()`.** The bundler records `dynamic-import` edges (`bundler/depgraph.js`), and
  esbuild would split them into chunks. Nothing in `node_modules/convex` (dist, src, README,
  CHANGELOG) says whether the backend isolate resolves `import()` at run time. It cannot be proved
  without the backend, which this spike did not touch, so it is not recommended.
- **Thin shells** that forward raw JSON and parse in the child are subsumed by (a), because an
  unparsed route no longer pays for its contracts.

### (c) Other patterns

- **Validators as getters.** Convex reads `args` and `returns` only inside the
  `exportArgs`/`exportReturns` closures (`server/impl/registration_impl.js:101-118`), so both can
  be getters. The 15 large `returns` already are. A codemod (`validatorGetterCodemod.mjs`)
  converted the other 655 in 162 files. The four targets did not change measurably (lazy without
  getters: 16.2 / 35.2 / 37.3 / 24.8 ms; with getters: 14.2 / 35.6 / 37.3 / 24.7 ms). **Not
  recommended** as a blanket change; keep using getters where a module's `returns` is large. It is a
  separate spike commit so it can be dropped.
- **Content tables on demand.** `content/schema.ts` exports `buildContentTables()`. Root
  `schema.ts` calls it, and `content/streams.ts` builds and memoizes `defineSchema(…)` on first
  `contentStream()`. This takes about 6–8 ms off capture and commit (lazy 35.2/37.3 → 29.1/28.9).
  `schema.ts` `export()` is unchanged. **Recommended** (3 source files and 2 tests).
- **Collapsing chained checks.** Rewriting `.check(a).check(b)` as `.check(a, b)` gives an identical
  definition with one fewer clone. It applies to 1,550 sites. Whole-package eager evaluation falls
  7% (158 → 147 ms, 5 alternating processes). After (a), it only trims schemas a handler builds
  (a few ms per call). Optional follow-up.
- **Narrower modules** (for example, moving `creatureQualifiedDamageDefenseDtoSchema` out of
  `subjects/creature`). This would save about 40 ms on `projectionReads`, but it is per-edge
  surgery that (a) makes unnecessary.
- **Dedupe zod** (one `zod` copy; `apps/apis` on `zod/mini`). About 3–5 ms per call. Optional
  follow-up.

## Recommendation

Adopt (a) plus the content-tables fix. It is contract-preserving, and the four checks above prove
it for every exported schema and every pushed validator. It is mechanical (a codemod plus a
handful of hand edits), and it cuts module evaluation 73–84% on every hot function. The saving
also reaches every subscriber re-run and the router, which the ruling asked for.

### Rollout plan

1. **Schema package, one PR.**
   1. Add `lazySchema` to `packages/schema/src/zod.ts`. Commit the codemod as a repo script with a
      `--check` mode wired into `yarn lint`, which fails on a new eager module-level `z.…`
      initializer (`z.json()` exempt).
   2. Run it. Hand-convert the imperative top-level builders the codemod reports: shape-literal
      and array constants such as `api/vttScenes` `scene*Base` and `grants/modifier`.
   3. Add a permanent schema test that imports every module and resolves every exported schema.
      Construction errors, such as `z.extend` on a refined object, now surface on first use
      instead of at import, so the test must force them.
2. **Content tables on demand** in `apps/apis/convex/content/{schema,streams}.ts`, root
   `schema.ts` and 2 tests.
3. **Prove equivalence at scale, once, in the PR.** Promote `equivalence.mjs` and
   `functionSpecs.mjs` to a script that compares the PR against its merge base:
   - identical fingerprints, `zodToConvex` JSON, JSON Schema and parse results for every exported
     schema (plus the seeded SRD records per subject);
   - an identical `schema.ts` `export()`;
   - identical `exportArgs`/`exportReturns` for every function;
   - an identical `.d.ts` emit, allowing only reprinted-equivalent types.

   Record the result under `docs/validation/`.

4. **Full gates.** Run `yarn turbo:affected:typecheck`, schema tests, `test:convex`, `test:web`,
   `session-worker` tests, and a local codegen push per AGENTS. The web app and the Worker also
   consume `packages/schema` and get lazy schemas too.
5. **Re-run the browserless V15 check.** Confirm per-function `userExecutionTime` on the backend.
   Run the 6-browser V15 only if both budgets pass with margin.
6. **Optional follow-ups**, each measured on its own: collapse chained checks, dedupe zod, and
   make large `returns` getters wherever a profile shows `zodToConvex` at load.

### Estimated outcome (not measured on the backend)

This scales the harness savings by the D52 harness-to-backend ratio (1.0–1.25×) and applies them
to the post-D52 breakdown (a `RESOLVE_ACTION` at p50 is 746 ms: bundle route 348, commit route
359).

- **Per call.**
  - Router: about 30–35 ms less per route call (twice per command).
  - Capture bundle: about 90–115 ms less.
  - Action commit: about 55–100 ms less.
  - `projectionReads:get`: about 40–50 ms less, from about 113 ms user time to about 65–75 ms.
  - The hot-path proxy overhead adds back about 2–5 ms.
- **Per command.**
  - About 200–260 ms less fixed setup. Action p50 would be about 0.5–0.55 s.
  - Subscriber re-runs per commit fall from about 435 ms of backend JS to about 260 ms, so there
    is less contention in the tails.
- **Gameplay command p95:** about **0.84–0.90 s** (was 1.089–1.090 s). Moves and reaction
  responses still carry the largest tail, at about 1.1–1.15 s p95. They have no per-type budget,
  but a 6-browser run adds subscriptions.
- **Durable convergence p95:** about **205–215 ms** (was 251–252 ms). It is mostly one
  `projectionReads:get` re-run.

## Risks

- **Identity.** A proxy is a different object from the schema it builds. zod's `z.json()`
  references its own internal instance, so wrapping it made `zodToConvex` and `toJSONSchema`
  expand one extra level. This was caught by the equivalence harness and is excluded in the
  codemod. No app code compares schemas by identity or uses registries (checked `apps/apis`,
  `packages/shared`, `rules-runtime`, `authoring`, `session-worker` and `apps/web`). The permanent
  `--check` and the one-time equivalence script guard it.
- **Hot-path parse** is about 8% slower through proxies. Handler parse time is a fraction of
  handler work, so this is a few ms against 50–120 ms saved.
- **Late errors.** Schema construction errors move from import to first use. The
  resolve-everything test is required.
- **Regression.** New eager schemas creep back in. The lint `--check` guards this.
- **Debugging.** Inspecting a proxy shows an empty object until it is resolved.
- **Estimates are in-process measurements** on a shared machine. Hosted Convex may cache modules
  differently (R09); the fix helps either way.
- **The traced sets come from the test fixtures.** Real Runs with more actors or effects build
  more of the same schemas (the largest recorded set is used as the upper bound above).
