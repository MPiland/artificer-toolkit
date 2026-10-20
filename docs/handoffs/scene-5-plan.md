# SCENE-5 plan: the shared table screen

Status: **MVP confirmed by the product owner (2026-10-19)** and sent to the orchestrator to register. This supersedes the earlier drafts of this doc.

## What in-person groups actually do

Research on Foundry VTT, Roll20, Owlbear Rodeo, Fantasy Grounds and D&D Beyond Maps (2026-10-19; mostly community guides and forum threads, not usage data) found five patterns:

1. **A GM-driven TV; the players have no devices.** The GM shows a second window or a dummy player account on the TV and moves every token. This is the most common pattern. Pain: the GM is the bottleneck, secrets leak when the TV is the GM's own window, and mirrored zoom breaks the scale for minis.
2. **A flat TV under physical minis.** The VTT is a map and fog board. Vision is often off, or the GM paints fog by hand. Foundry needs Lock View (a fixed grid scale) and Monk's Common Display for this.
3. **A TV plus phones.** Players use their phones for sheets and rolls, and sometimes for tokens. Phone sheets are slower than paper.
4. **A touch table.** This is niche and fragile: touch modules break, and many TVs aren't truly touch.
5. **A shared "hive mind" account.** One account owns every Character. Pain: selecting all the tokens moves them all, and vision follows only one token.

Two findings shape the design:

- No major VTT has a first-party table mode. All of them rely on dummy accounts and modules. A clean, built-in one is a real differentiator, which fits the goal of being smoother than the Foundry baseline.
- Almost nobody handles hidden rolls or whispers on the shared screen. Groups push them to physical dice, or to the players' own phones.

## Why the scope shrank

Earlier drafts tried to make Assisted rules with private prompts work on one shared screen: a table role with its own projection, global prompts on any page, presence, a "no other window open" fallback and moving chat out of the tabletop. Walking the owner's scenarios (all remote; same room, everyone with a device; same room, no devices, Manual) showed that machinery serves an edge case. The owner's real game, and the common pattern in the research, is a TV map, someone moving the party's tokens, physical dice and the GM tracking the rest: a Manual game. Every VTT leaves private prompts on a shared screen to the group. SCENE-5 follows Foundry instead (owner, 2026-10-19).

## MVP (confirmed by the product owner, 2026-10-19)

- **Control, not a role.** The GM gives a Campaign member control of other players' Characters and can take it back at any time; the owners keep control. It is Campaign-level and persists until revoked, like Foundry ownership. No special role, window or projection mode. That member opens the tabletop on the TV and moves the party's tokens. The GM may grant it to anyone, including for a TV they drive themselves.
- **Existing seam.** GM-granted control already exists per Encounter Run (`controllerUserIds`, ADR 0034, at most 8; the assigned player is always a controller), and controllers already move, act for and answer prompts for the actor. Outside an Encounter only the owner moves a Character's token. T1 lifts the grant to the Campaign and keeps one source of truth for Run actors' controllers.
- **Vision** keeps the 2026-10-12 rule: a member who controls several Characters sees through one main Character, which they pick on the tabletop (default: their own Character); a single selected controlled token switches the view; clearing or a multi-select returns to the main Character.
- **Zoom for minis.** No Lock View or calibration: the person at the TV zooms until squares fit the minis, by wheel or by typing a percentage. Every viewer's zoom persists on their device.
- **Documented limitation, not engineered around.** In an Assisted game a controlled Character's prompts reach every controller, the TV included, as in Foundry. Manual play has no prompts. Groups that mind let the GM drive the TV or play Manual.

## ACs (confirmed)

- **5.1** (replaces 5.1-5.3): "The GM can give a Campaign member control of other players' Characters and take it back at any time; the owners keep control. A member moves a controlled Character's token on the tabletop as its owner can, and in every Encounter they are one of its controllers."
- **5.2:** "A member who controls several Characters sees the Scene through one main Character's senses, which they pick on the tabletop and which defaults to their own Character. Selecting a single token they control switches the view to that token's senses; clearing or multi-selecting returns to the main Character. They never see what the viewed Character cannot see."
- **5.3:** "Every tabletop viewer can set the zoom by typing a percentage or stepping it, and their tabletop window keeps that zoom on that device across reloads, reconnects and view switches. The tabletop opens in a window sized to the screen and offers a Full screen button."
- **Removed:** the old 5.3 (private information not shown on the table screen), replaced by the documented limitation above.

## Tasks

| Task | Delivers                                                                                                                                                                                                    | AC  | Size | After |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ---- | ----- |
| T1   | The GM grants and revokes Campaign-level control of a Character; granted members move its tokens outside Encounters and are its controllers in every Run (one source of truth with the per-Run controllers) | 5.1 | 5    |       |
| T2   | Main-Character picker on the tabletop and view switching by a single selected controlled token                                                                                                              | 5.2 | 3    | T1    |
| T3   | Zoom control (percentage and steps) with per-device zoom for every viewer, a screen-sized tabletop popup and a Full screen button                                                                           | 5.3 | 3    |       |

## Post-launch (future enhancements)

Prompts that follow a member to any app page, presence (online = any non-VTT app page open), the "no other app window" prompt fallback for the tabletop, moving chat out of the tabletop, OS notifications (Notification API) for a waiting prompt, a vision-off map board, and touch gestures beyond tap and drag.
