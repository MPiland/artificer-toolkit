# Lane 3: VTT UI handoff

> Living handoff for the lane-3 VTT UI work (branch `claude/lane3-vtt-ui-3d94bf`). Scope: ledger ACs VTT_UI-1.1, 1.2, 3.1, 3.2, 3.3, 4.1 and 4.2. Held: VTT_UI-1.3 (needs ATTACK-12/13) and VTT_UI-2.1 (needs ATTACK-15 and ENCOUNTER-6).
>
> Updated: 2026-10-12.

## Audit (before building)

The old Gate 4 evidence (`CampaignVttPresentation.stories.tsx`) drives the real renderer with hand-written presentations and overlays, so it never runs `buildVttTokenPresentations`. That is why the rebaseline left every AC unaccepted. Proof below must build presentations from real fixtures through the model, and journeys run the real `CampaignTabletopWindow` stories.

| AC | Verdict | What exists | Gap |
| --- | --- | --- | --- |
| 1.1 Art, identity, colour precedence | Partly met | `vttTokenPresentation.model.ts`: fill is defeated, then GM health band, then a deterministic identity colour; outline is current turn, then actor control, then white. `CampaignVttStage.tsx` loads art for actor-bound tokens (Character portrait or creature image, only when the Scene token's `assetId` is null or matches). Unit tests cover precedence. | No browser proof through the model. Actor `disposition` (D13, D17) is not shown, while the [mockup](../mockups/phase-08-vtt-production-tracer.png) rings tokens by side: open question [Q3](phase-08-2-open-questions.md). Unbound Scene tokens with an `assetId` never get art; there is no token-art delivery contract for them. |
| 1.2 Conditions, halos, ordering, overflow | Met in code | Statuses from conditions, grants, defeat, GM health band and a pending movement reaction; stable kind order; reaction halo beats current-turn halo; the renderer draws four badges and a `+N` overflow badge. | Proof only. |
| 3.1 Range, target, path, aura, trap previews | Partly met | The renderer draws CIRCLE, PATH and POLYGON overlays. Live, only the area aim overlay and the movement drag path are wired. | No range ring or target marker is wired live; the action's range is text in the action drawer, which this lane does not own. No aura geometry or trap exists in any contract: those parts need a contract from lane 1. |
| 3.2 Light, darkness, obscurement, senses | Largely unbuilt | Lights draw one visibility-clipped glow; darkness zones draw a flat polygon at their opacity; fog and vision reveal work. | Bright and dim radii are not distinguished; magical darkness, obscurement and ambient illumination are not shown; vision cones and senses are not drawn. |
| 3.3 Footprints, large tokens, drag, rotation | Partly met, one bug | Tokens draw at their width and height; moves clamp by half footprint and check barriers; rotation turns the facing marker; drag paths and waypoints commit. | **Bug:** a drag on a token with a presentation is cancelled by any renderer update (the drag stores an appearance key without the presentation, the preserve check compares one with it). Live presence, chat and roll updates hit this. |
| 4.1 Low zoom, not colour alone | Partly met | Zoom 0.02 to 8; the LowZoom story checks only the zoom scale. Accessible descriptions name statuses. | Colour-only cues on the canvas: every health band badge is `!`; reaction and current-turn halos differ by colour; the controlled outline is colour only; Reaction and Restrained both show `R`. Badges shrink with the world at low zoom. |
| 4.2 Evidence, conflicts, keyboard, screen reader, selectors | Partly met | Canvas `role="img"` with a live "Visible tokens" description; polite status regions; a Scene token list with Focus and a keyboard nudge pad; zoom buttons with labels; the evidence roll row; stale-version conflicts reported in the outcome. | No test journey proves these together through the window. |

### VTT_UI-2.1 reaction state

The reaction-state part of 2.1 is presentable now: a pending movement reaction already gives the reactor's token a `REACTION` status and a halo that beats the current-turn halo, with unit proof. It is not split out: the AC also covers injuries and morale, which stay held behind ATTACK-15 and ENCOUNTER-6. Lane 3 stops there.

## Plan

1. VTT_UI-3.3: red-first regression for the drag bug, fix, then footprint and rotation proof.
2. VTT_UI-1.2 (and 1.1 apart from Q3): model-built presentations in the presentation stories, plus a window journey.
3. VTT_UI-4.1 and 4.2: non-colour cues and the accessibility journey.
4. VTT_UI-3.2: light, darkness, obscurement and vision rendering.
5. VTT_UI-3.1: range, target and path previews; aura and trap wait on a contract from lane 1.

## Progress

- Baseline browser run failed only because the worktree's `packages/shared/dist` was stale; rebuilt.
