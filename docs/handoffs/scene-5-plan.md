# SCENE-5 plan: the shared table screen

Status: **draft for the product owner (2026-10-19).** Nothing here is decided until the owner answers the questions at the end. SCENE-5's ledger tasks T1-T4 are provisional until then.

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

## Where the earlier model breaks

The 2026-10-12 decision treats the screen as a player identity that acts for the covered Characters, and the 2026-10-19 amendment gives that identity to a real member. Both leave the screen as a person's account. That person then gets their own private information on the TV, or has to run two windows. In pattern 1, the most common one, nobody at the table holds a device anyway, so the GM is the one driving.

## Proposal: the screen is a display, not a player

- **The GM opens the table display** from their own Session view ("Open table display"), on the TV or a second monitor, with no extra account or seat. The server projects that connection as the display, never as the GM: only what the main Character (or the selected covered token) sees, no GM-only layers, no hidden rolls, whispers or GM notes, and no GM controls. Because the server does the projection, a display connection can't see GM data even though the GM opened it.
- **Who drives the tokens:**
  - **Default (pattern 1):** the GM moves covered tokens from their own screen, as they can today.
  - **Optional "players use the display" switch (patterns 3 and 4):** the display accepts mouse or touch input for the covered Characters. Outside an Encounter it can move any of them; in an Encounter, only the one whose turn it is. It can choose actions and answer roll prompts for them, as the 2026-10-12 decision requires.
- **Players with phones keep their own accounts** and stay ordinary players (pattern 3). The display is in addition to their phones, not instead. Any covered Character whose player is connected gets its private information on that player's device.
- **Private information for a covered Character whose player has no device** goes to the GM, never to the display. AC 5.3 is met by construction: the display never receives private information.
- **Vision** keeps the 2026-10-12 rule: the main Character, a single selected covered token switches the view, and clearing or a multi-select returns to the main Character. The explored map shown is the viewed Character's.
- **Later, not in SCENE-5 (future enhancements):** a fixed grid scale for physical minis (Lock View), a vision-off "map board" mode, and touch gestures beyond tap and drag.

## Effect on the ACs and tasks

The ACs still hold. Only 5.1's "the GM launches a Session" reading changes: the display is opened from the running Session instead of being chosen at launch. The tasks would become:

| Task | Delivers                                                                                                                               | Size |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| T1   | The GM opens the table display; the server projects it as the display (main Character's vision, no GM data, no private data)           | 5    |
| T2   | View switching by a single selected covered token                                                                                      | 3    |
| T3   | The "players use the display" switch: moving covered tokens, and in an Encounter acting and answering prompts for the turn's Character | 5    |
| T4   | Private-information routing for covered Characters without a connected player (to the GM)                                              | 2    |

## Questions for the product owner

1. **Display instead of a member with a table role?** This replaces the 2026-10-19 amendment. Recommended: yes.
2. **Opened from the running Session instead of chosen at launch?** It changes 5.1's wording. Recommended: yes, so the GM can open it, close it or move it to another device mid-Session.
3. **Is "players use the display" (input on the TV) in scope for launch,** or does the display start view-only, with the GM driving? Recommended: in scope. AC 5.2 already requires it, and it's what removes the GM bottleneck.
4. **Fixed grid scale for physical minis:** post-launch enhancement, or in SCENE-5? Recommended: post-launch.
