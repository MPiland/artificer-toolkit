# AGENTS

## Purpose

This repository is `artificer-toolkit`, a monorepo for tabletop RPG content authoring, character building, character sheet play surfaces, and supporting campaign/reference workflows.

The product is pre-launch: there are no live users or production data to stay compatible with. Remove retired code, fields and compatibility shims instead of preserving them; migrate development data within the same change when a model changes.

## First Reads

Read these before making substantial changes:

1. [PRODUCT.md](PRODUCT.md)
2. [DESIGN.md](DESIGN.md)

If working on a specific domain, read the closest owning source, tests, and current product/design docs before editing.

For architecture or cross-package work, also read [README.md](README.md), [CONTEXT.md](CONTEXT.md), and [docs/README.md](docs/README.md). Use the owning workspace README and the relevant guide under `docs/architecture/` before changing a seam. ADRs under `docs/adr/` record load-bearing decisions and should not be casually re-litigated.

Use canonical documentation to establish product purpose, vocabulary, invariants, and ownership before broad code exploration. Then inspect the smallest relevant current implementation and tests to verify behavior. Read a phase roadmap or implementation ledger when working in that phase; do not load unrelated historical plans as general context.

Documentation upkeep:

- Update the relevant canonical guide when a module interface, dependency direction, persistence invariant, transport contract, node-map rule, or Builder/Sheet ownership rule changes.
- Add or update an ADR when a change intentionally alters a load-bearing architectural decision.
- Keep current, transitional, target, and historical behavior explicitly labeled.
- Keep cross-module intent in docs, and reserve code comments/JSDoc for local non-obvious invariants or public interfaces that are easy to misuse.
- Before handoff, verify links and trace the affected flow through its seam; do not leave architecture knowledge only in chat history.

## Workspace Shape

- `apps/web`: TanStack Start frontend
- `apps/apis`: Convex backend (queries, mutations, actions, HTTP routes, persistence, auth)
- `apps/session-worker`: Cloudflare Worker and Session Durable Object (live table, live rules execution)
- `packages/shared`: domain models, node maps, engine logic, authored metadata
- `packages/schema`: transport and validation contracts
- `packages/rules-runtime`: schema-aware rules execution and System modules shared by Convex and the Worker
- `packages/authoring`: Authoring Schema resolver and publication
- `packages/source-data`: protected canonical SRD corpus
- `packages/emails`, `packages/design-system`: React Email templates and platform-neutral design system

## Core Rules

- Do not treat current frontend code as canonical when newer product, design, or approved Figma guidance exists.
- `apps/apis` is the only product-data boundary for `apps/web`.
- Do not do full-file rewrites; instead, do surgical updates.
- Use only shared contracts from `packages/schema` and no ad-hoc local shapes.
- If a contract shape is missing, create it in a reusable manner.
- Keep Convex functions in `apps/apis` focused on authorization, persistence and transactions. Reuse `packages/rules-runtime`, `packages/authoring`, `packages/shared`, and `packages/schema` for domain logic.
- Builder owns structural character changes.
- Sheet owns play-state interaction.
- Master or seeded records are locked from direct edit in the UI, but copyable into owned drafts.
- Preserve Mantine, vanilla-extract, TanStack Start, SSR where appropriate, and the existing CSS layer override model.
- No bandaids. All code should be DRY and use best practices.
- Pass work to sub agents as needed for efficiency and parallel work. Don't abuse sub agents. Use only as necessary when it would increase efficiency.
- Do not blindly agree with my suggestions if they break best practices or don't make sense. Build for efficiency and correctness. Push back critically.

## Operating Principles

Keep it simple. Simple is better than complex.
Assume the user is a principal engineer.
Make the smallest maintainable change that solves the actual request.
Prefer existing patterns over new abstractions.
Avoid broad refactors, speculative helpers, and clever architecture unless clearly justified.
Prefer colocation and direct props for nearby component ownership. Use a narrowly scoped React context only for stable coordination across a genuinely deep or branching subtree; do not use Context as a general store or merely to avoid passing one or two props.
Do not pass monolithic controller objects through component trees. Split ownership at real behavioral boundaries, and require every provider or layout wrapper to own necessary behavior, state, accessibility, or visible structure.
Use judgment. Read enough surrounding code to understand the existing pattern, then avoid unnecessary exploration.
Optimize for correctness, speed, judgment, and token efficiency.
Correct the user when appropriate.
Prefer FAANG-level code quality: clear naming, strong types, simple control flow, minimal mutation, focused functions, pure functions/components where practical, and no unnecessary abstraction.

## Context Discipline

Protect context aggressively.

Answer the narrow question first. Inspect the smallest relevant file, symbol, route, component, diff, log, or test output.

Prefer targeted searches, focused file sections, nearby call sites, capped logs, and scoped validation. Avoid running validation commands like `npm run build`, `npm run test`, or `npm run lint` unless absolutely necessary. Use normal scoped commands like `rg`, with a byte cap when needed.

Avoid dumping full files, full logs, unrelated directories, broad repo searches, large diffs, or generated output after the relevant code is found.

Do not byte-cap instruction files, skill files, tool docs, or agent policy files. Read the whole relevant file unless it is unexpectedly huge.

## Command Output

Protect context usage. **Any command with unknown or potentially large output must be scoped and byte-capped.**

Cap unknown or potentially large output before displaying it. Line caps alone are unsafe because a single line can be huge. In PowerShell, bound displayed text with `Substring`; for strict byte limits, read a bounded byte range from the saved log.

Scope before printing content: list files first, search specific paths, count matches when useful, and avoid reading generated, binary, minified, database, or huge JSON/JSONL files unless required.

Preserve complete verification logs and native command exit codes; display only a bounded excerpt after completion:

```powershell
New-Item -ItemType Directory -Force local-validation/task | Out-Null
yarn turbo:typecheck:web *> local-validation/task/typecheck.log
$validationExit = $LASTEXITCODE
$excerpt = Get-Content -LiteralPath local-validation/task/typecheck.log -Tail 20 | Out-String
$excerpt.Substring(0, [Math]::Min(4000, $excerpt.Length))
exit $validationExit
```

Avoid unbounded `cat`, broad `rg`, `find`, `ls -R`, `git diff`, tests, builds, and `select *`.

If capped output is insufficient, narrow the command before increasing the cap.

## Shell Selection

Use native PowerShell for Windows commands, including rg, git, yarn, node, tests, and process management. Use Git Bash only when the user explicitly requests it.

Keep quoting, paths, redirection, and exit-code handling native to PowerShell. Preserve documented repository commands and environment configuration.

## Windows Process Execution

This repo runs on Windows, and several frontend tools spawn native child processes. Storybook, Vite, esbuild, Playwright browser runs, Vitest browser mode, and similar dev-server/build commands may fail from a sandboxed agent shell with errors such as `spawn EPERM`.

- Prefer MCP/browser inspection when a dev server is already running.
- Agents may start Storybook when it is needed for UI verification, but first check whether the target port/server is already running. Do not start duplicate Storybook instances.
- Follow the active session's permission policy. In an unrestricted session, run commands normally. Request escalation only when supported and needed for a sandbox restriction; never supply escalation flags when the session forbids them.
- Use documented repo commands through PowerShell, for example `yarn workspace @artificer-toolkit/web storybook --no-open --port 6006`. Do not bypass the user's environment config with direct `node.exe`/Corepack invocations unless the documented command path itself is proven broken.
- Avoid repeated start attempts. Start once, capture the PID/logs or the port owner, perform the check, then stop only the process the agent started.
- If the local Convex backend appears offline, especially `ECONNREFUSED 127.0.0.1:3210`/`3211`, verify Docker Desktop and the local Convex container before diagnosing app auth or Sheet routes. Agents may start them when they are down:
  - Start Docker Desktop once with `Start-Process "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"`, outside the sandbox, then wait for `docker info` to succeed.
  - Start the existing container with `docker start phase82-convex-local-linux` and wait for `http://127.0.0.1:3210/version`. After an unclean shutdown, startup can take several minutes.
  - Never reset, repair, prune or delete Docker data, settings, socket directories, containers or volumes. If Docker Desktop does not become ready within about three minutes, stop and tell the user.

## Secrets

- Never open, print or grep the contents of `.env*` files, credential files or secret stores. To learn which variables exist, list only the names (for example `(Get-Content .env.local) -replace '=.*', '='`), and never echo values.
- Never print, log or write tokens, JWTs, admin keys or connection strings. Generate the local Convex admin key at run time inside the container and pass it in memory.
- Never list process command lines or environments inside containers or on the host (`docker exec … ps aux`, `docker inspect` env or args, `/proc/*/cmdline`). The local Convex backend's command line carries its instance secret. Use `docker stats` for resource checks.
- If a secret value is exposed anyway, stop, tell the user which secret it was and where it appeared, and recommend rotating it.

## GitHub CLI Auth On Windows

GitHub CLI auth is available through the Windows keyring in this workspace, not through `GH_TOKEN` in the sandboxed shell environment.

- Run `gh` under the active session's permission policy. If a sandbox blocks keyring access and escalation is supported, retry with escalation before diagnosing auth as broken.
- Do not print or inspect token values. `gh auth status` is acceptable for confirming authentication state.

## Code Changes

Prefer direct edits with the available patch tool.
Patch the narrow failing path first.
Avoid unrelated cleanup.
Do not add helpers, wrappers, maps, files, abstractions, or validation layers unless they clearly reduce complexity.

## Patterns to Avoid

Avoid single-use abstractions.

Prefer inline types and direct logic when a helper, wrapper, map, or named type is used only once. A well-named pure function used once is fine when it names a domain concept, gets its own test, or turns a long function into readable steps; the test is whether it hides complexity or only moves it.

Avoid wrapper functions that simply call another function.

DRY means one home per piece of knowledge, not "never repeat a line". Merge two code paths when they encode the same rule; keep look-alike code separate when it changes for different reasons.

Never special-case a named feature, spell, creature or rule in code. Express it through generic, data-authored options.

Prefer deep modules: a small interface over a substantial implementation. Avoid layers of thin pass-throughs, which make control flow untraceable.

Name shared code by its domain (`spatial/forcedMovementPath.ts`), not as a grab-bag `utils` file.

Split files by responsibility, not line count: planning, settlement, persistence and fan-out are seams. A large file is a prompt to look for mixed responsibilities, not an automatic split.

## Validation

Match validation to risk.

Development, automated tests, load checks and agents run only against the local Docker Convex backend, or against the ephemeral self-hosted backend container that the live-backend CI job starts on a GitHub runner (ADR 0035 amendment). Never point them at Convex Cloud (dev, staging or production): cloud database I/O counts against the free plan (ADR 0035). A cloud staging smoke check needs the user's explicit approval each time.

Store disposable validation logs, screenshots, and generated evidence under ignored `local-validation/<task>/`. Keep durable validation summaries and source identities under `docs/validation/`, and living handoffs under `docs/handoffs/`, so another agent can find them in the repository. Do not create root-level logs or use `tmp/`, `logs/`, or `artifacts/` for validation output. Keep intentionally retained design-review evidence under `.impeccable/critique/` and canonical product references under `docs/mockups/`.

For low-risk documentation or configuration edits, inspect the diff and skip application tests when they cannot exercise the change. State what was checked.
Use the cheapest useful check for risky changes.
CI is the only gate (user decision 2026-10-22, replacing the 2026-10-18 trial). Before a push to a `ci/<slice>` branch, run lint on the touched files, then push. Do not run a local typecheck or local tests first. CI's fail-fast typecheck gate, its affected-only tests and its red proof are the check. Never push to the phase branch or main this way. Local test runs are an optional inner loop for one test file and are never required. Until PLATFORM-13.13 lets tests read package source without a build, skip them and iterate through CI instead of queueing for a `dist` build. When diagnosing a typecheck outside a slice, use Turbo-backed repo commands such as `yarn turbo:typecheck:web`, so local caching is used. Do not run direct workspace typecheck commands like `yarn workspace @artificer-toolkit/web typecheck:app` unless diagnosing Turbo itself or a Turbo-backed command is unavailable.
Do not run full test suites or full builds unless risk justifies it or the user asks. Promotion work additionally requires the complete local lifecycle, `yarn validate:pre-staging:local`, on the final source. It targets only the local Docker backend, generates the admin key at run time, reads the ignored `local-validation/local-convex/local.application.env` (which must not hold an admin key) and writes evidence under `local-validation/`; see the [release runbook](docs/runbooks/phase-8-2-release.md#final-local-source).
Run the TypeScript compiler alone on this Windows machine: set `$env:GOMAXPROCS='2'` and pass Turbo `--concurrency=1 --env-mode=loose`; never run it alongside Vitest. Build `packages/rules-runtime` before tests that import newly added modules; tests resolve its `dist` output.
TypeScript, Vitest with convex-test, and lint run in plain Node and do not enforce Convex runtime limits (64 MB module load, object argument validators). For any change under `apps/apis/convex` or the contracts it imports, also run a codegen push against a self-hosted backend. In CI that is the `.github/workflows/live-backend.yml` job (see below). On this machine the Convex runner scripts (`scripts/liveBackendValidation.mjs`, `apps/apis/scripts/convexRunLocal.mjs`) generate the key inside the container and pass it as an explicit `--admin-key` argument, so never hand-assemble the key.
When several agents work in parallel, every compiler, test, Wrangler or codegen run goes through the first-come-first-served runner. Put the command batch in a script that does not take a lock itself, and run it with `pwsh -NoProfile -File D:/dev/artificer-toolkit/scripts/withValidationLock.ps1 -Name <slice-step> -Script <batch.ps1> [-Lane light]` (worktrees call the main checkout's copy). The runner has three lanes:

- **Heavy** (default): one batch at a time under `local-validation/.validation.lock`, 20 minutes by default. Only work that needs this machine runs here: the user's local review data (backend reset, deploy or seed of the local container), load reproduction, the Session Worker (Wrangler), and Storybook and Playwright runs the user watches. Builds, profiling and live-backend checks (codegen push, deploy, seed, audit) go to CI. The SRD manifest (`apps/apis/convex/content/srdManifest.generated.ts`) is not committed: CI's setup action generates it after the package build, `yarn dev` (`dev:prepare`) and `yarn dev:convex` generate it locally, and after a fresh checkout or a `packages/` change run `yarn workspace @artificer-toolkit/apis generate:srd:manifest` before local Convex tests or typechecks. The Convex `_generated` files stay committed, and the live-backend job fails if they differ from the commit. It runs beside `tests.yml` on every `ci/**` push that touches `apps/apis` or a package other than the design system, so a slice that changes a Convex function or validator sees the drift on its own branch. When `_generated` drift is the only failure, the workflow's `auto-fix` job commits the regenerated files to the same `ci/**` branch (trailer `Generated-By: live-backend auto-fix`, fast-forward push, never the phase branch or main, never twice in a row) and dispatches Tests and Live on the new commit; `watchCi.ps1` prints `AUTO-FIX <sha>` and follows it, so `git pull --ff-only` the branch before pushing again. Tests does the same for formatting and lint: when Lint is its only failing job and `oxlint --fix` plus oxfmt on the changed files clear it, its `auto-fix` job commits the fixes (trailer `Generated-By: tests auto-fix`) and `watchCi.ps1` follows them. CI checks formatting only on the files a slice changed; `node scripts/formatChanged.mjs --base origin/codex/phase-08-2-convex-cutover` formats those locally. If the auto-fix cannot commit (the branch moved, or drift remains after an auto-fix commit), the run fails and uploads the files as the `generated-files` artifact: `gh run download <run-id> -n generated-files -D local-validation/generated-<run-id>` (it will not overwrite files in place), copy its contents over `apps/apis/convex` and commit them instead of running codegen locally. A slice is not ready to merge until both workflows are green on its tip. Right before the push it reports as ready, a slice merges the current phase tip into itself (`git fetch origin; git merge --no-edit origin/codex/phase-08-2-convex-cutover`), so that its merge takes the fast path ([CI validation](docs/architecture/ci-validation.md#approved-merges)). A single green slice whose tip already contains the phase branch tip merges without a batch run: its `--no-ff` merge commit has the same tree as the slice tip (check that `git rev-parse <merge>^{tree}` equals `<slice-tip>^{tree}`, or that `git diff --name-only <slice-tip> <merge>` lists only `docs/roadmap/08-phase-ledger.json` when the orchestrator committed ledger edits after the slice synced), so the slice's green Tests and Live runs prove the merge. A fast-path merge has a non-blocking full-run backstop: after pushing it to the phase branch, the orchestrator also pushes that merge commit to `ci/merge-m<N>`, which runs every test, watches that run, and fixes a failure there first, ahead of other work. Two or more slices, or a slice behind the phase tip, merge through a `ci/merge-m<N>` batch run. After reviewing and approving a green slice tip, the orchestrator dispatches the merge instead of doing these steps by hand: `gh workflow run merge-slice.yml --ref codex/phase-08-2-convex-cutover -f branch=ci/<slice> -f sha=<tip> -f title='Merge <PBI>.<task>: <summary>'`. To merge several green slices as one batch, pass `-f slices='ci/<a>@<tip> ci/<b>@<tip>'` instead of `branch` and `sha`. It checks that Tests and Live are green on each exact tip, takes the fast path (one slice) or a `ci/merge-m<N>` batch run, and pushes nothing on a moved tip, a conflict or a red run ([approved merges](docs/architecture/ci-validation.md#approved-merges)); merge by hand a slice that changes `.github/workflows`.
- **Light** (`-Lane light`): up to two batches at once, beside the heavy batch, for scoped test files only (a few named Vitest files). The runner refuses a light batch that builds, compiles, deploys, seeds, resets or starts a browser, caps it at 10 minutes, and starts it only while at least 1 GB of memory is free. Tests import workspace packages from `dist`, so pass the batch's test files as `-BuildFor <file>,<file>`: the runner first builds the dependencies of the workspaces that own them (`turbo run build --filter=<workspace>^...`, Turbo-cached) in the typecheck lane, one compile at a time behind its memory gate, and only then takes a light slot. Use it only as an optional red/green inner loop on a specific test. It is never a gate before a push. The recorded red proof comes from CI: every Tests run on a `ci/<slice>` branch has a "Red proof against the phase branch" job that runs the slice's new and changed test files (and keeps its changed test helpers) against the production code at its merge-base with the phase branch, and its summary labels each file RED, RED-IMPORT (fails to load: weaker) or ALREADY-PASSING (right for a test-only change). It runs on its own runner beside the other jobs, so one run proves red and green; do not push separate red branches. It is skipped on `ci/merge-*` and when no test file changed.
- **Typecheck** (`-Lane typecheck`, no `-Script`): one batch at a time under `local-validation/.validation.typecheck.lock`, beside the other lanes, capped at 30 minutes, and started only while the machine has at least 4 GB of commit headroom (twice the measured 2 GB peak; free physical memory is not a usable gate, since any compile here pages it to near zero). The runner runs one fixed command: `typecheck` and `typecheck:convex` for the changed workspaces and their dependents, and web's `typecheck:app`, `typecheck:tests` and `typecheck:stories` when web is among them, with `GOMAXPROCS=2`, `--concurrency=1` and `--env-mode=loose`, building their dependencies first and generating a missing SRD manifest. It prints the `error TS` lines and Turbo's totals and keeps the full log in `local-validation/typecheck/<name>.log`.

Build and suite checkpoints run in the cloud instead of the heavy lane. Commit, pass the typecheck lane, then push the branch to its own CI branch: `git push origin HEAD:ci/<slice>` (fast-forward only; never push `main` or force-push). `.github/workflows/tests.yml` then builds and runs every typecheck, the Convex shards and the package, Worker and web tests on parallel GitHub runners, independently of every other slice. A slice runs only the test files whose imports reach a file it changed since the phase branch; merge batches (`ci/merge-*`), dependency, config and test-setup changes, and `gh workflow run tests.yml --ref ci/<slice> -f full=true` run every test ([CI validation](docs/architecture/ci-validation.md)). Every test file must belong to a CI suite, so a new test location fails the run until a Vitest config includes it. Wait for the result in the background with `pwsh -NoProfile -File scripts/watchCi.ps1`: it watches every run on the pushed commit, exits on the first failure with the failed steps (a type error makes Tests cancel its own run once both typecheck jobs report, and the script prints the `error TS` lines; and the download command when it is snapshot drift or generated-file drift the auto-fix could not commit: a failed Convex shard or package run reruns its snapshot-mismatch files with `-u` and uploads the corrected files as the `updated-snapshots` artifact; the job still fails, so review each snapshot diff before committing it), and exits 0 only when all are green. Act on a failure at once instead of waiting for the other run, and never cancel a run another session or the orchestrator started. Otherwise read the result with `gh run list --branch ci/<slice>`, `gh run watch <id> --exit-status --interval 120` (never the default 3-second poll: parallel sessions exhaust the 5,000 API requests an hour) and `gh run view <id> --log-failed`. Convex tests there are in-process convex-test, so no deployment is touched (ADR 0035).

Live-backend checks run in CI too, against an ephemeral self-hosted Convex backend container (the same image digest as the local container) that is discarded with the runner; ADR 0035's cloud rule forbids Convex Cloud, not this. `.github/workflows/live-backend.yml` runs `scripts/liveBackendValidation.mjs` (manifest, codegen push, deploy, seed, SRD audit) on those `ci/**` pushes and on `gh workflow run live-backend.yml --ref ci/<slice> [-f steps=...]`. It uses no repository secrets, generates the admin key inside the container and uploads step logs as the `live-backend-logs` artifact. The same script runs locally (`node scripts/liveBackendValidation.mjs`, defaults to the local container) inside a heavy batch when the user's local data needs it. The scripts take their target from one constant (`http://127.0.0.1:3210`), verify its `/instance_name`, pass the URL and key as explicit CLI arguments and clear `CONVEX_DEPLOYMENT` and `CONVEX_DEPLOY_KEY` from the child environment, so they cannot reach Convex Cloud. The heavy lane is still used for the main session's local merge batches only when they need this machine's data or tools.

Each lane queues tickets in its own queue and runs them in arrival order. The batch stops at its first failing command (the runner sets `$ErrorActionPreference = 'Stop'` and `$PSNativeCommandUseErrorActionPreference = $true`); a batch that must run every step and report them all sets `$ErrorActionPreference = 'Continue'` itself and exits non-zero on any failure. The runner deletes its own lock and ticket even on failure or timeout. Formatting and lint need no lock; report a heavy lock older than 90 minutes, a typecheck lock older than 60, or a light one older than 30, instead of deleting it.

## Subagents

Use subagents only when they save context, save time, or materially improve output quality.

For implementation delegation, the main agent keeps ownership of judgment. The main agent must first interpret the user's annotations or request, inspect enough code to choose the correct layer, define the intended change, constraints, files or surfaces in scope, validation, and risks. Only then may a subagent receive the bounded execution slice.

Do not delegate open-ended architectural judgment, product interpretation, or layer-selection decisions. Delegate concrete implementation tasks such as "change these files," "preserve this pattern," "do not touch these areas," "expected behavior is X," and "run these checks." The main agent reviews the diff, chooses or runs final validation, integrates the result, and corrects issues.

For tightly-coupled form/UI platform work, prefer one subagent at most for a bounded slice. Avoid multiple agents editing the same provider, renderer, navigation, node-map, or layout surfaces concurrently.

For research, review, and exploration tasks, avoid confirmation bias. Do not pass a preferred conclusion. Ask the subagent to investigate, compare, or verify, and require evidence, tradeoffs, uncertainty, and better alternatives.

Prefer subagents for:

- documentation/API checks
- web research
- non-trivial copywriting/content generation

Avoid subagents for trivial work the main agent can finish faster.

When using a subagent, assign a narrow task and require:

- findings
- files inspected
- files changed, if any
- validation run, if any
- risks or uncertainty

You own final judgment and integration.

## Architect Escalation

The primary agent owns product interpretation, scope, public contracts, persistence meaning, and
acceptance. Implementers and validators must not reinterpret those decisions or contact the user
directly for ordinary implementation details.

Escalate only when the answer would change at least one of these:

- user-observable behavior or approved scope;
- a public API, schema, transport, or persisted contract;
- persistence ownership, lifecycle, migration meaning, or potential data loss;
- authorization, privacy, redaction, or security;
- transaction boundaries, canonical lock order, concurrency, idempotency, or replay semantics;
- a load-bearing System, rules-kernel, authoring, Builder, Sheet, Encounter, or VTT ownership boundary;
- a frozen gate scenario or acceptance criterion;
- an accepted ADR or explicit architect ruling;
- a dependency, service, infrastructure component, or operational cost; or
- a contradiction where approved requirements cannot all be satisfied.

Do not escalate naming, file placement, helper extraction, ordinary module organization, test-file
structure, fixture construction, assertion style, use of an established repository pattern, a bug fix
whose behavior is already dictated by the contract, values derivable from authoritative System data,
or internal DTO composition that does not change a public or persisted contract.

Workers report potential escalations to the integration owner. The integration owner first checks the
approved plan, canonical guides, ADRs, source, and tests. If those sources answer the question, the
integration owner decides and work continues. If the question is genuinely uncovered, freeze only the
affected slice, continue unrelated approved work, and send the architect one concise packet containing
evidence, the conflicting requirements, viable options, and a recommendation. Record the resolution in
canonical documentation when it changes a load-bearing contract.

## Communication

Before editing, state the approach only for non-trivial tasks.

During complex work, keep updates short:

- what was found
- what changed
- what risk remains

After work, summarize:

- what changed
- files touched
- validation run, or why skipped
- remaining risk

Keep summaries short. Do not explain obvious edits.

Oververbosity:low

## Storybook MCP Rules

When working on UI components, stories, or design-system-backed props, use the Storybook MCP tools when they are available in the active tool list.

- Query the Storybook component/documentation surface before adding or changing props on shared UI, Mantine-backed wrappers, or story patterns.
- Do not assume component props from memory or naming conventions. Verify them through Storybook MCP documentation, existing stories, or source before using them.
- Use the Storybook MCP story instructions tool when creating or updating stories, if that tool is available.
- If Storybook MCP tools are not available in the current session, fall back to source inspection plus the normal local gates instead of guessing.
- Validate meaningful UI/story changes with the focused Storybook, Playwright, or test commands that cover the touched surface.

## Design Context

The default product register is `product`.

Key design principles live in [PRODUCT.md](PRODUCT.md).
Visual system guidance lives in [DESIGN.md](DESIGN.md).

- Reference both of these whenever doing UI/UX work.

## Web Folder Organization

- `apps/web/src/ui/primitives`: low-level reusable controls such as select, link, spinner, collapse, rich text, and theme toggle.
- `apps/web/src/ui/overlays`: reusable modal, drawer, and overlay infrastructure.
- `apps/web/src/components`: app-level reusable composites and patterns such as authored lists.
- `apps/web/src/forms`: the canonical frontend authoring form platform, including app-form composition, field primitives, node-driven rendering, authoring layout, editor modal shell, validation, and hooks.
- `apps/web/src/domains`: active rebuilt authored domains only.
- `apps/web/src/auth`, `marketing`, `home`, and `shell`: top-level app features or app system areas.
- `apps/web/src/data`: frontend API/query adapters by domain.
- Do not reintroduce `apps/web/src/legacy`; deleted legacy should stay deleted unless a future tranche intentionally rebuilds a replacement.

Prefer colocated `components`, `hooks`, `utils`, `validation`, `stories`, and `tests` folders inside the owning feature or component package. For the form platform, use `apps/web/src/forms` as the canonical home and keep internal folders lowercase. Do not add new form hooks to the global `src/hooks` folder unless they are genuinely app-wide and not owned by a feature.

Deleted legacy pockets such as old global `src/hooks`, `src/store`, `components/Form`, and `src/legacy` must not be recreated as compatibility shims. Future stateful or form-heavy surfaces should be rebuilt intentionally in their owning phase.

- Shared node maps plus backend node-runtime resolution define authored form `steps -> sections -> nodes`, including visibility, required state, options, hidden clearing, object groups, and array groups.
- Only top-level domain form containers and isolated Storybook/test harnesses should call `useAppForm`.
- Domain forms should stay thin: create the top-level TanStack form, load/save/activate through `apps/apis`, register authoring page state, and render `AuthoringFormLayout` plus a domain adapter created by `createAuthoringFormRenderer`.
- The shared renderer maps resolved nodes directly to real `form.AppField` controls. Domain adapters should only provide default values and item/object factories. Do not add separate resolved-field wrappers, duplicate section shells, generic array/object wrappers, or "just in case" props.
- Array/object group nodes should stay connected to TanStack Form state. Use TanStack field APIs directly in the renderer/editor path; do not create local Zustand draft state or nested local forms.
- `AuthoringEditorModal` is the one fullscreen editor shell for resolved group nodes. Do not create domain-local modal/form resolver stacks.
- Keep `ui/primitives` and `ui/overlays` as the canonical homes for primitive controls and overlay infrastructure. Do not add duplicate wrappers in `components`.
- Authored detail pages are reader/reference surfaces. Direct authored `/:id` routes should render shared `AuthoredDetail` pages, list view actions should navigate to detail, edit actions should navigate to `/edit`, and domain detail pages should use shared detail primitives plus domain-specific presenter mappers rather than authoring-form wrappers.
- Remove the word `runtime` from frontend names unless the name refers to the backend/API node-runtime contract.
- Component files should export React components only. Move helpers, constants, types, factories, and static models to separate non-component files to satisfy Fast Refresh.
- Do not call hooks conditionally, define React components inside React components, pass fake TanStack form/field objects as props, or use `AnyFieldApi`, `any`, `as never`, unused exports, dead code, or compatibility aliases in active form code.

## Commands

Common repo commands:

- `yarn dev`
- `yarn dev:session-worker`
- `yarn build:web`
- `yarn build:apis`
- `yarn build:shared`
- `yarn build:schema`
- `yarn build:session-worker`
- `yarn validate:pre-staging:local`
- `yarn test:web`
- `yarn test:web:e2e`
- `yarn turbo:test:authoring`
- `yarn turbo:typecheck:web`
- `yarn storybook:web`
- `node scripts/acceptanceProgress.mjs [--json]` (validate the Phase 8.2 acceptance ledger and report case/criteria progress)

Web workspace commands:

- `yarn workspace @artificer-toolkit/web typecheck:app`
- `yarn workspace @artificer-toolkit/web typecheck:stories`
- `yarn workspace @artificer-toolkit/web typecheck:tests`
- `yarn workspace @artificer-toolkit/web typecheck:config`
- `yarn workspace @artificer-toolkit/web typecheck:diagnostics`
- `yarn workspace @artificer-toolkit/web storybook`
- `yarn workspace @artificer-toolkit/web test`
- `yarn workspace @artificer-toolkit/web test:forms`
- `yarn workspace @artificer-toolkit/web test:authoring`
- `yarn workspace @artificer-toolkit/web test:e2e:app`
- `yarn workspace @artificer-toolkit/web test:e2e:authoring-storybook`
- `yarn workspace @artificer-toolkit/web test:e2e:storybook`

Convex and Worker commands:

- `yarn workspace @artificer-toolkit/apis test:convex`
- `yarn workspace @artificer-toolkit/apis codegen:convex`
- `yarn workspace @artificer-toolkit/apis seed:srd:convex:local`
- `yarn workspace @artificer-toolkit/apis audit:srd:convex:local`
- `yarn workspace @artificer-toolkit/session-worker test`
- `yarn workspace @artificer-toolkit/rules-runtime build`

## TypeScript Quality Rules

- Do not introduce `any` in new or modified active code.
- Prefer `unknown`, generics, discriminated unions, or schema-derived types instead of `any`.
- If an existing legacy file already contains `any`, do not expand it. Quarantine it as legacy or replace it when touching that surface.
- Active frontend and API code should use focused package imports instead of package root barrels: prefer `@artificer-toolkit/schema/api/...`, `@artificer-toolkit/schema/subjects/...`, `@artificer-toolkit/schema/grants/...`, `@artificer-toolkit/shared/core`, `@artificer-toolkit/shared/maps`, `@artificer-toolkit/shared/authored`, or other narrow subpaths over `@artificer-toolkit/schema` and `@artificer-toolkit/shared`.
- Root `@artificer-toolkit/schema` and `@artificer-toolkit/shared` imports remain compatibility surfaces only. Treat new root-barrel imports in active web, Convex or Worker code as type-graph regressions unless there is a documented reason.
- Keep very large inferred DTOs localized at package boundaries. Prefer explicit exported DTO/input types for app-facing payloads when repeated `z.infer` expansion would spread through web, Convex and Worker layers.
- Do not leave unused variables, unused imports, dead code, commented-out code, or temporary debug logging.
- Treat TypeScript, lint, and test warnings in touched active code as blockers unless they are already documented legacy non-blockers.

## When in Doubt

- Trust the repo docs over memory.
- Trust locked Figma work over stale placeholder frontend code.
- Trust explicit shared contracts over inferred behavior.
