# SCENE-5 plan: the shared table screen

Status: **in planning with the product owner (2026-10-19).** The model below is agreed; the AC wording and the open questions at the end are not. SCENE-5's ledger tasks are provisional until the owner confirms.

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

## The owner's play pattern

The owner's last Campaign used pattern 2: one person logged in to a LAN Foundry instance, the GM gave them control of the party, 3D minis stood on the TV, and every roll happened off screen. That is a **Manual Run** here: it tracks initiative, hit points and conditions and raises no rules prompts, and the GM runs the enemies. No new mode is needed for it.

## Model (agreed with the owner, 2026-10-19)

- **The table is a role, not an account or a display.** The GM gives the table role to a Campaign member for the Session, at any time while it runs (not chosen at launch). The GM may give it to themselves. Rejected: a dedicated table account (2026-10-19), and the GM-opened display of the first draft.
- **The role changes only the holder's tabletop window.** On that account, the tabletop window becomes the table: the server projects it with the main Character's vision, and with no chat, whispers, roll prompts, private rolls, GM notes or GM-only data, including the holder's own. The holder's other pages (Sheet, Session page, anything else) stay theirs, so the holder needs no second account, and their own prompts reach them on their phone.
- **Vision** keeps the 2026-10-12 rule: the main Character's senses; a single selected covered token switches the view to its senses; clearing or a multi-select returns to the main Character. The explored map shown is the viewed Character's.
- **The table acts for the covered Characters.** It moves their tokens and opens the existing action drawer for them. Outside an Encounter it moves any covered token. In an Assisted Encounter it moves and acts only for the covered Character whose turn it is. In a Manual Run it moves any covered token, because a Manual Run only tracks and the GM adjudicates. Whoever drives the table asks the player where to go, or hands them the mouse.
- **Prompts follow the controller, not the table.** A roll prompt for a Character goes to its controller, on any signed-in page they have open: a global prompt modal over whatever they are viewing. Several open tabs or devices all show it, and answering in one clears the rest. A table window never shows prompts. Prompts raised by an action started at the table go to that Character's controller.
- **A "your turn" notification** shows on any signed-in page when one of the member's Characters starts its turn, using the existing Mantine notifications.
- **Assisted play assumes every covered Character's controller has a device.** A group without devices plays a Manual Run. There is no routing of private information to the GM for a player without a device. A controller who drops mid-Encounter is handled as today: their prompt waits, and the GM can skip it.
- **Cost:** prompts live in the Session room, so the global modal holds a room connection only while one of the member's Campaigns has an ACTIVE Session. One socket per tab; nothing when nobody is playing.

## Work

The prompt modal and the turn notification help every remote player, not only shared tables, and deliver a visible behaviour on their own. They become **a new PBI** ahead of SCENE-5 (id and feature assigned by the orchestrator). SCENE-5.T1 depends on its T1 so that the table window's exclusion is built once, in the global modal.

New PBI, "Prompts and turn notices follow the player to any page":

| Task | Delivers                                                                                                                                                                         | Size | After |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----- |
| T1   | A pending roll prompt for a member's Character shows in a global modal on any signed-in page while its Session is ACTIVE; answering it in one tab or device clears it everywhere | 5    |       |
| T2   | A "your turn" notification on any signed-in page when one of the member's Characters starts its turn                                                                             | 2    | T1    |

SCENE-5:

| Task | Delivers                                                                                                                                                                                                                                                                       | Size | After      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---------- |
| T1   | The GM gives the table role and names the covered and main Characters; the holder's tabletop window is server-projected as the table (main Character's vision; no chat, prompts, private rolls or GM data); it remembers its zoom on that device across reloads and reconnects | 5    | new PBI T1 |
| T2   | View switching by a single selected covered token; clearing or a multi-select returns to the main Character; a switch may pan but never changes the zoom                                                                                                                       | 3    | T1         |
| T3   | The table acts for covered Characters: moves (any outside an Encounter or in a Manual Run; the turn's one in an Assisted Encounter) and the action drawer for the turn's covered Character; other clients converge                                                             | 5    | T1         |
| T4   | A Chrome-style zoom control on the tabletop for every viewer: a zoom icon opens a percentage field with minus and plus, so a table can type the zoom that fits its minis                                                                                                       | 2    |            |

T3 needs a server change: room admission (`roomBoundTokenControl` and the Encounter action admission) must accept the table role's commands for covered Characters it does not own.

## AC wording (proposed, not confirmed; the owner asked to hold registration)

- **5.1:** the table mode is no longer chosen at launch: "During an ACTIVE Session the GM can give one member the table role, covering chosen player Characters with one as the main Character. That member's tabletop window shows the Scene through the main Character's senses …" (the vision sentences stay).
- **5.2:** the table no longer answers roll prompts: "The table acts for every covered Character: it moves their tokens (outside an Encounter or in a Manual Run any of them; in an Assisted Encounter the one whose turn it is) and chooses their actions; their roll prompts go to each Character's controller; every other client converges as for any player command."
- **5.3:** unchanged, but it now holds for every Character, the holder's own included.
- **New 5.4:** "Every tabletop viewer can set the zoom by typing a percentage or stepping it. The table window keeps its zoom on that device across reloads, reconnects and view switches, so squares stay sized to physical minis."
- **New PBI:** ACs for the global prompt modal (any page, cleared everywhere on answer, never in a table window) and the turn notification.

## Later, not in SCENE-5 (future enhancements)

- Push notifications for a locked phone or a backgrounded app.
- A vision-off "map board" mode, and touch gestures beyond tap and drag.

## Physical minis

No Lock View or calibration. Grids are fixed to the map, and the person at the TV zooms until squares fit the minis, by wheel or by typing a percentage (T4). The table window keeps that zoom across reloads (T1) and view switches (T2). An accidental wheel bump is not guarded against; re-zooming fixes it.

## Open question for the product owner

- **The AC wording above:** confirm when ready to register. This includes the new 5.4.
