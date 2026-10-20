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

## T2: Main Character on the tabletop (AC SCENE-5.2)

- **Picker.** A member who controls more than one Character gets a "Main Character" select in the Stage header. It lists
  the Characters they control (`controlledCharacters`, the D162 predicate over the Campaign memberships), their own
  first, and defaults to their own. A pick that is no longer controlled falls back to the default.
- **View.** The viewed token is the main Character's token (the Encounter-bound token, else the unbound token whose
  `characterId` matches), unless the member selects a token they control, which wins. Clearing the selection returns to
  the main Character. The renderer exposes single selection only, so there is no multi-select path: anything other than
  one selected controlled token falls back to the main Character.
- **No leak.** The client only chooses which token to view; the server decides what it may know. For vision, fog
  exploration and projection the room derives `controlledByUserIds` from the Character grants
  (`withCharacterControllers`, `NativeLiveSessionRoom.#controlledScene` and `prepareStagedSceneCommit`), so a grantee's
  fog layer and visible tokens follow the Characters they control and never include anything else. The stored Scene
  keeps the GM's own controller list; the augmentation is a derived copy. The web applies the same helper so
  `canControlSceneToken` and the token presentation agree with the room.
- **Proofs.** `characterControl.test.ts` (helper), `roomSceneSensesProjection.test.ts` (projection),
  `nativeLiveSessionRoom.test.ts` (a granted token's move explores for the grantee, whose sync carries only their
  layer), `CampaignVttStage.model.test.ts` and `CampaignVttStage.mainCharacter.test.tsx` (picker, default, switch).
