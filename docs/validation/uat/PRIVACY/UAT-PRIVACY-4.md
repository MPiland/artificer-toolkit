# UAT-PRIVACY-4: Ownership transfer changes who sees what

Ownership transfer changes who sees what.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1) · Path position 126 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Sandbox** (owner GM; members P1, P2 and P3 with Iris, Juno and Kit; Manual mode; dim light and per-player fog; a wall with a closed door, a rubble line and one light; a visible Ogre in the east room and a hidden Goblin and a hidden Wolf; the review Encounter started and nobody has acted).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Confirm the hidden Goblin and Wolf tokens on the Scene (add another hidden token if you want), then make a Private roll for a monster (as in [UAT-PRIVACY-2](UAT-PRIVACY-2.md) step 1).
2. **P1:** Note what the tabletop shows. Run an action as P1 and note its command card in chat (for example roll a skill).
3. **GM:** Transfer ownership to P1 ([UAT-CAMPAIGN-2](../CAMPAIGN/UAT-CAMPAIGN-2.md) steps 12 to 13) and have **P1** accept.
4. **P1 (new GM):** Reload the tabletop window.
5. **GM (now a player):** Reload the tabletop window.
6. **GM (now a player):** Check history and chat for the action P1 ran and for the Private roll made before the transfer.
7. **P1 (new GM):** Check the same history. Then transfer ownership back ([UAT-CAMPAIGN-2](../CAMPAIGN/UAT-CAMPAIGN-2.md) step 15) and have the original GM accept.
8. **GM (owner again):** Reload and check the history again.
   R1. **P1:** Transfer the Campaign ownership back to the GM with the same control, and **GM:** accept. Both then confirm the Campaign lists the GM as owner.

## Expected

- After transfer P1 sees the hidden token and the GM-only controls; the former GM no longer sees them.
- A command replayed after transfer (history, chat entries) shows the redacted player view to the former owner, and the full GM view to the new owner (steps 6 and 7).
- After the ownership comes back (step 8), the original GM again sees the full view. (A short delay before roles switch on an open window is documented as accepted exposure; reload and re-check before calling it a failure.)

## Other users see

- **Former GM (now a player):** must NOT see the hidden token, hidden stat blocks, or the Private roll history after the transfer.

## ACs covered

PRIVACY-1.2, PRIVACY-1.7

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
