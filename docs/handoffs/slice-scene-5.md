# SCENE-5 workbook

## T1: Campaign Character control grants (AC SCENE-5.1)

- **D162 (orchestrator ruling).** Derived at read time (Option A). The Campaign grants are the only source; one shared
  merge helper (`packages/shared/src/domains/campaign/characterControl.ts`) serves Convex, the player projection and the
  room. Revoke is immediate; per-Run grants survive a revoke. CAMPAIGN and PLAY revisions bump on grant and revoke.
  The 8-controller cap applies only to the per-Run list (ADR 0034 amendment).
- **Storage refinement.** Grants live on the `campaignCharacterAssignments` row as optional `controllerUserIds`, not in a
  new table. The GM-only mutation is `campaigns/characterControllers:setControllers`; departure strips the member.
- **Unbound tokens.** The predicate "token controllers include the owner" was rejected. `SceneToken.characterId`
  (optional) links a token to a Character; a grantee moves an unbound token only for a Character granted to them. The GM
  sets it in the token inspector ("Linked Character"). No production path places a token from a Character yet; any
  such path must set `characterId`.
- **Revisions.** `campaignCharacterAssignments` writes refresh the CAMPAIGN scope (rooms reload their authorization
  cache from it) and the PLAY scope; both are asserted in `apps/apis/convex/campaigns/characterControllers.test.ts`.
- **T2 notes.** The vision picker and token vision `controlledByUserIds` need the same `characterId` link.
