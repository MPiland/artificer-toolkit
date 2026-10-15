# Slice workbook rules

Every slice session follows these rules. Its workbook (`docs/handoffs/slice-<id>.md`) holds the brief, the ACs and tasks it closes, the red-first checklist, the status log and proposed ledger edits. The main session (lane 1 integration owner) reviews, merges, deploys and updates the ledger and dashboard.

## Working rules

- Read AGENTS.md, then the decisions and docs the workbook names, before editing.
- Write each checklist test before the code and keep its red log under `local-validation/<slice>/`.
- Edit or Write tools only. No heredocs, sed, Python or other edit scripts.
- Inspect with the Read, Glob and Grep tools, never shell listing or grep (`ls`, `cat`, `Get-ChildItem`, `rg` chains): the permission classifier denies compound read-only shell commands. The shell runs only one documented build, test, codegen or lock command per call, through PowerShell. Check the lock with `Test-Path D:/dev/artificer-toolkit/local-validation/.validation.lock`, or simply try to take it; the Glob tool skips gitignored files and never shows it.
- No watcher, sleep or poll commands. Run each command once and wait for the completion notice.
- Never override the apis `maxWorkers`. For focused runs, pass explicit file paths, not folder filters.
- Run each test through its owning workspace command; the root `vitest.config.ts` excludes `apps/web` and `apps/apis/convex`, so a root run of those files silently runs nothing. Owning commands: `yarn workspace @artificer-toolkit/apis test:convex <apps/apis/...>`, `yarn workspace @artificer-toolkit/web test <src/...>`, `yarn workspace @artificer-toolkit/session-worker test`, `yarn workspace @artificer-toolkit/source-data test`, and `yarn vitest run --config vitest.config.ts <packages/...>` for packages. Confirm every listed file appears in the log's file count before calling a run green.
- A change to Creature, Character or Equipment publication, snapshots or SRD seed data reruns the whole apis `encounters` and `content` folders (the one folder-filter run allowed), not only the files you touched.
- Every compile, test, codegen or Wrangler run goes through the first-come-first-served runner, per AGENTS.md: write the batch to a script under your `local-validation/<slice>/`, then run `pwsh -NoProfile -File D:/dev/artificer-toolkit/scripts/withValidationLock.ps1 -Name <slice-step> -Script <batch.ps1>` in the background. Red/green iteration on a few named test files goes in the light lane (`-Lane light`: two at once, beside the heavy batch, no build, compile, codegen, seed or browser). For build, typecheck and broad-suite checkpoints, commit and `git push origin HEAD:ci/<slice>` (fast-forward only, never `main`, never force) and read the GitHub run with `gh run watch <id> --exit-status --interval 120` / `gh run view <id> --log-failed` (always `--interval 120`: the default 3-second poll from several sessions exhausts the account's 5,000 API requests an hour and breaks every session's `gh`); it runs in parallel with every other slice. A compile error fails only the run's first job, "Build packages"; fix every error it lists in one commit, not one push per error. Run live-backend checks (manifest, codegen push, deploy, seed, SRD audit) in CI too: push `HEAD:ci/merge-<slice>` or `gh workflow run live-backend.yml --ref ci/<slice>`, which uses an ephemeral backend container and no secrets (AGENTS.md Validation). Use the default heavy lane only for work that needs this machine: the Session Worker, Playwright and Storybook runs, and live proofs on the local container's review data. A batch stops at its first failing command. Never hand-roll a `New-Item` retry loop on the lock. One planned batch per run, about 10 minutes at most (a full Convex suite is the only longer hold, and only when the workbook requires it; pass `-TimeoutMinutes`). The runner deletes its own lock and ticket even on failure. Debug and edit between batches without holding it, because every other slice session queues behind you. Never delete a lock you did not create; report it instead.
- A failing test that passes on a rerun is not a pass. Do not rerun a failed CI job to get green. Read the failure. An assertion difference, unlike an infrastructure error, is a possible bug: find the cause or prove that the base fails the same way. Record it in the status log, and report a base failure to the main session.
- Keep working while your batch is queued: write the next tests and the fix instead of idling. Plan for as few acquisitions as possible, ideally one red batch and one final batch. You may take red and green in one hold: run the new tests with your production change stashed (`git stash push -- <production files>` in your own worktree) to capture the red log, restore it with `git stash pop`, then run green and the typecheck. Read each new test file over once before queuing, so setup typos don't cost a second trip through the queue.
- No full-suite timing baselines or parallelism trials mid-phase. They run at the end of the phase, unless a single test shows a real Convex or Cloudflare platform issue.
- Use in-memory convex-test. Run codegen only under the lock. Never deploy, reset or reseed the local backend; the main session does that after merge.
- Build in this order before tests that import changed modules (tests read `dist`): `packages/shared`, `packages/schema`, `packages/source-data`, `packages/authoring`, `packages/rules-runtime`, `packages/encounter-persistence`. A stale `source-data` or `authoring` dist fails tests that have nothing to do with your change (for example a `senses` ZodError, or `createNodeRuntimeSourceReader is not a function`).
- Source-data changes need `yarn workspace @artificer-toolkit/apis generate:srd:manifest` (the manifest is tracked).
- Verify Convex test typing with `yarn tsc -p convex/tsconfig.json --noEmit` from `apps/apis`. After moving an export, typecheck every importing workspace explicitly. `turbo:affected:typecheck` filters `[HEAD]` and runs nothing on a clean tree; use `turbo run typecheck --filter="[<base>]"`.
- Storybook cannot start in a worktree. List story runs you could not do in the status log; the main session runs them after merge.
- No `any`, no compatibility aliases, no dead code. Surgical edits only. Never weaken, delete or reorder an assertion to make a test pass; a premise change is flagged in the status log.
- A denied command means stop and report; never retry it through another command.
- Do not touch the ledger, the dashboard or the main handoff. Propose ledger edits in the workbook.
- Other slice sessions run in parallel on other files. Stay inside your workbook's file scope. Before committing, merge the base branch and rerun the tests you touched.
- Escalate to the main session (`SendMessage`), not the user, only for the triggers in AGENTS.md "Architect Escalation".

## Report

Before reporting, run one independent review. Spawn a read-only reviewer subagent with a fresh context (`model: "opus"`; it must not check out branches). Give it the diff against your base, the workbook's ACs, and any frozen review list, but not your own conclusions. Require it to do two things:

- map each AC to the test that proves it, and name any part left unproved (an untested branch, replay or idempotency path, or admission path);
- list band-aids, single-use helpers, duplicated logic, non-null assertions and hard-coded first-element picks.

Fix each finding, or record why it stands, in the status log. Then commit.

When green, commit on your branch and report to the main session: commits, the checklist with red and green log names, validation run, deviations, and open risks.
