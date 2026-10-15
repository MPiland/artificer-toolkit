# Slice workbook: ATTACK-17.T2 and T3 (players target only what they see, from the map or the list)

**Status:** WAITING on ATTACK-9.T1 and SPELLS-22 (both edit `CampaignTabletopActionDrawer.tsx`) (written 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` after those merges.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

One session does T2, then T3. Commit after each task.

Before any work, confirm that your worktree is based on `codex/phase-08-2-convex-cutover` and contains the ATTACK-9.T1 and SPELLS-22 merges. If it is based on `main`, merge the lane branch first. Session cards can't carry the base branch.

Build the UI to [DESIGN.md](../../DESIGN.md) and [PRODUCT.md](../../PRODUCT.md). No mockup gate: the user reviews UI and design at RELEASE-8, after all code is green.

## T2 brief (AC 17.3): a player's list shows only creatures they can see

Today `projectPlayerEncounterProjection` (`packages/rules-runtime/src/encounterPlayerProjection.ts`) filters actors by `actor.public` alone. A public actor whose token is hidden or fogged still reaches the player. It shows up in both the drawer's Target select (`CampaignTabletopActionDrawer.tsx`, about line 643) and the Encounter drawer's initiative list. The map already hides those tokens (`isSceneEntityVisibleToViewer` and `projectSceneForViewer` in `packages/shared/src/domains/vtt/sceneReducer.ts`).

Rulings (integration owner, 2026-10-14):

- **Redact on the server, per viewer.** A hidden creature never reaches a player's client. The player projection is already built per viewer (`sessionReads.ts`, about line 97). Filtering only in the web is not allowed.
- **One visibility rule.** A player sees an actor in the Encounter when any of these holds:
  - they control it;
  - its token on the active scene is visible to them under the exact predicate the map uses, imported and not copied;
  - the GM revealed it (below).
  
  A public actor with no token on the active scene stays listed, as today, because there's nothing to see or hide. If the map's draw decision also uses sense or light perception (VTT_UI-5), the list uses the same rule. If the map and the attack-perception rule disagree, report it instead of choosing.
- **GM reveal:**
  - Add one persisted per-actor setting to the Encounter actor contract in `packages/schema`: not revealed (the default), revealed unnamed, or revealed by name. Name it to match the contract's style.
  - "Revealed unnamed" lists the actor to players as "Unseen creature", with no name, portrait, hit points or conditions.
  - "Revealed by name" lists the name. In both cases the token is still not drawn, because its square stays secret (guessing a square is ATTACK-17.4).
  - The GM sets it from the actor's row in the Encounter drawer. Only the GM can change it; it's a GM command with authorization in the owning Convex and Worker path.
  - Pre-launch: no migration. Development data gets the default.
- **The turn of an unlisted actor** reveals no more than a non-public actor's turn does today. Reuse that existing handling.
- **Admission:** a player's command that targets an actor they can't see is refused, the same way a non-public target is refused today (`packages/encounter-persistence/src/actionAdmission.ts`, about line 184), using the same visibility rule.
- **The Convex fallback** for scene bindings (`loadCampaignSceneEncounterBindings`) filters like the room's `ACTOR_TOKEN_BINDINGS` read. Verify this, and fix it if it doesn't.
- **The Target select** also drops the acting actor when the action's `choice.target.self` refuses it.

## T3 brief (ACs 17.1 and 17.2): targeting from the map or the list

What exists:

- the range ring and target ring (VTT_UI-3.1): `actionPreviewOverlays` and `stageOverlays` in `CampaignVttStage.model.ts`;
- shared distance and range bands: `measureSceneTokenFootprintDistance` and `sceneRangeBand` from `@artificer-toolkit/shared/vtt`;
- token hover and select callbacks in `vttSceneRenderer.ts` (about lines 1637 and 1725);
- the area-aim mode pattern (D103 and SPELLS-13): the drawer's "Pick on map", the stage's `aimingArea`, and Escape to cancel.

- **Targeting mode.** Choosing an action whose target is ACTOR enters targeting mode on the map, following the area-aim pattern:
  - the range ring;
  - the targetable tokens highlighted, through a token-presentation flag next to `halo` and `marked`;
  - a hover readout of distance and roll modifiers;
  - a click on a targetable token targets it;
  - Esc cancels.
- **Roll modifiers in the readout show only what the Character believes** (ATTACK-10.1 ruling, D100). Never show the true mode before commit.
  - Add one Encounter read that returns, for one action, each listed target's believed d20 mode and its player-safe reasons. It's produced by the same mechanics preparation and `encounterAttackD20Belief` that the roll prompt uses.
  - It's a room read with the same Convex fallback pattern as `ACTION_CHOICES`, fetched once when targeting mode starts, never per hover.
  - Put the DTO in `packages/schema`. No modifier logic in the web.
  - If the preparation can't run without side effects or a write transaction, stop and escalate.
- **The list is the target list** (user decision 2026-10-09: one persistent, collapsible list, not a second pane). While targeting, the Encounter drawer's actor list:
  - sorts by distance and shows the range;
  - marks out-of-range entries;
  - goes back to initiative order when targeting ends.
  
  A revealed actor with no drawn token sorts last as "distance unknown". The map and the list share one selection. The list is the keyboard, screen-reader and no-map path, so it needs real buttons and labels.
- **Out of scope:** attacking an empty square (ATTACK-17.4) and the per-user roll card (ATTACK-17.T1).

Escalate (`SendMessage` to the main session) only for the AGENTS.md triggers. In particular:

- if per-viewer redaction needs a fan-out or transport change in the Worker; or
- if the believed-mode read needs a write transaction.

Read first:

- D62, D63, D100, D103, and the VTT_UI-3.1, VTT_UI-5 and SPELLS-13 entries in `docs/handoffs/phase-08-2-decisions.md`.
- `docs/architecture/` guides for the live session and VTT.
- DESIGN.md.

## Closes

- AC ATTACK-17.3 (task ATTACK-17.T2).
- ACs ATTACK-17.1 and ATTACK-17.2 (task ATTACK-17.T3).

## File scope

- `packages/schema`: the reveal setting, the reveal command and the believed-mode read DTO.
- `packages/rules-runtime`: the player projection and the believed-mode read.
- `packages/encounter-persistence`: session reads, admission, and the reveal command.
- `apps/session-worker`: room reads and the reveal command.
- `apps/apis/convex`: the fallback reads and the reveal command.
- `apps/web/src/domains/campaigns/vtt`: the drawers, the stage, the renderer and the token presentation, with stories and tests.
- A live-backend browser journey under `apps/web/tests/live-backend/`.

## Red-first checklist

T2:

1. **Projection, unit:**
   - A public actor whose token is hidden, or sits in unexplored fog, is absent from a player's projection.
   - It's present in the GM's projection.
   - It's present for the player who controls it.
   - It's listed as "Unseen creature" with no name, portrait, hit points or conditions when revealed unnamed.
   - It's listed by name when revealed by name.
2. **Admission:** a player's attack on an actor they can't see is refused. The same attack succeeds after the GM reveals that actor.
3. **The Convex fallback bindings** omit the hidden token.
4. **Journey:** a Worker Encounter journey through real code.
   - The GM hides a public creature's token. The player's list and Target choices drop it.
   - The GM reveals it unnamed. The player sees "Unseen creature" and can target it.

T3:

5. **Model, unit:**
   - In targeting mode, the target list sorts by distance, marks out-of-range entries, puts unknown distances last, and returns to initiative order when targeting ends.
   - The targetable flag is set exactly on listed, in-range-or-long tokens.
6. **Believed-mode read:** an attacker whose Character can't see the target shows the believed mode, not the true one, whenever they differ (reuse an ATTACK-10.1 fixture). A long-range target shows disadvantage.
7. **Component tests:**
   - Clicking a token selects the same target in the list, and the other way around.
   - Esc cancels and restores the drawer.
8. **Browser journey (live backend):** a player picks an attack, sees the range ring and highlighted targets, and hovers to read distance and modifiers. They click a token, resolve the attack, and the roll card shows that target.
9. **Stories:** a story for targeting mode. List it for the main session to run, since Storybook can't start in a worktree.
10. **Regression:** the existing drawer, area-aim and VTT_UI-3.1 preview tests pass unchanged.

## Status log

- 2026-10-14: workbook written; waiting on ATTACK-9.T1 and SPELLS-22.

## Proposed ledger edits (filled by the slice session)
