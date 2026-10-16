# ATTACK-10.T5 Hide browser journey (AC ATTACK-10.6), 2026-10-16

**Result:** passed ("Native Hide observer editor journey passed.") against the local Docker Convex container.

- **Command:** `node scripts/runLocalBrowserProof.mjs --name=t5-hide-12 --proof=hide-browser` in the heavy lane (`withValidationLock.ps1`). Source: the ATTACK-10.T5 branch merged with `codex/phase-08-2-convex-cutover` at `e9be5207a`.
- **Journey:** `apps/web/tests/live-backend/encounterHide.ts` driven by `apps/apis/tests/developmentEncounterHide.ts`. The GM hides the Wolf with a natural 20, sees "Hidden from X" / "Noticed by Y" with their controls in the turn-order drawer, stops hiding it from one observer (`SET_CONCEALMENT_OBSERVERS`), and the player's page and every frame the room sent it carry no `"concealment"`, `"observerActorIds"` or effect id.
- **Evidence (ignored, local):** `local-validation/local-convex-proofs/hide-vtt-browser-20261015/browser/attempt-1792127956340/` (`hide-diagnostics.json`, `hide-owner-observers-2.png`, `hide-owner-observers-3.png`, `hide-player-turn-order.png`) and `local-validation/browser-proof/t5-hide-12/` (Worker, web app and proof logs).

## Environment findings fixed on the way

- The local deployment held a pre-ATTACK-10.T1 `systemVocabularySnapshots` document and a changed canonical corpus; it was reset and reseeded with `scripts/resetLocalConvex.ps1` (backups: `local-validation/convex-reset/attack-10-t5-vocab-repair.before.zip` and `attack-10-t5-reset.before.zip`/`.after.zip`).
- The local deployment's `LIVE_SESSION_WORKER_URL` was `http://127.0.0.1:8787`, which the container cannot reach (bridge network); it is now `http://host.docker.internal:8787` (proved reachable from the container).
- The proof's evidence directory must be short: a Worker durable-object state path over the Windows 260-character limit makes workerd fail with `internal error` on the Session room upgrade (a 500, then close 1006). Use a short `--name` in a worktree.
