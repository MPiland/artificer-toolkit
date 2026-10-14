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
- Every compile, test, codegen or Wrangler run takes `local-validation/.validation.lock` in the main checkout (`D:/dev/artificer-toolkit`), per AGENTS.md. One planned batch per acquisition, about 20 minutes at most, then delete your lock even on failure; debug and edit between batches without holding it, because every other slice session queues behind you. Never delete a lock you did not create; report it instead.
- Use in-memory convex-test. Run codegen only under the lock. Never deploy, reset or reseed the local backend; the main session does that after merge.
- Build `packages/schema`, `packages/rules-runtime` and `packages/encounter-persistence` before tests that import changed modules (tests read `dist`).
- Source-data changes need `yarn workspace @artificer-toolkit/apis generate:srd:manifest` (the manifest is tracked).
- Verify Convex test typing with `yarn tsc -p convex/tsconfig.json --noEmit` from `apps/apis`. After moving an export, typecheck every importing workspace explicitly. `turbo:affected:typecheck` filters `[HEAD]` and runs nothing on a clean tree; use `turbo run typecheck --filter="[<base>]"`.
- Storybook cannot start in a worktree. List story runs you could not do in the status log; the main session runs them after merge.
- No `any`, no compatibility aliases, no dead code. Surgical edits only. Never weaken, delete or reorder an assertion to make a test pass; a premise change is flagged in the status log.
- A denied command means stop and report; never retry it through another command.
- Do not touch the ledger, the dashboard or the main handoff. Propose ledger edits in the workbook.
- Other slice sessions run in parallel on other files. Stay inside your workbook's file scope. Before committing, merge the base branch and rerun the tests you touched.
- Escalate to the main session (`SendMessage`), not the user, only for the triggers in AGENTS.md "Architect Escalation".

## Report

When green, commit on your branch and report to the main session: commits, the checklist with red and green log names, validation run, deviations, and open risks.
