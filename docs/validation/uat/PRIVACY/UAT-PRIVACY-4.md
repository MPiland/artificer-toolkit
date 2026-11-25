# UAT-PRIVACY-4: Ownership transfer changes who sees what

Ownership transfer changes who sees what.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1) · Path position 133 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Add a hidden Goblin token and a hidden Wolf token to the presented Scene if they are not there ([UAT-PRIVACY-1](UAT-PRIVACY-1.md) step 4), then make a Private roll for a monster (as in [UAT-PRIVACY-2](UAT-PRIVACY-2.md) step 1).
2. [ ] **P1:** Note what the tabletop shows. Run an action as P1 and note its command card in chat (for example roll a skill).
3. [ ] **GM:** Transfer ownership to P1 ([UAT-CAMPAIGN-2](../CAMPAIGN/UAT-CAMPAIGN-2.md) steps 12 to 13) and have **P1** accept.
4. [ ] **P1 (new GM):** Reload the tabletop window.
5. [ ] **GM (now a player):** Reload the tabletop window.
6. [ ] **GM (now a player):** Check history and chat for the action P1 ran and for the Private roll made before the transfer.
7. [ ] **P1 (new GM):** Check the same history. Then transfer ownership back ([UAT-CAMPAIGN-2](../CAMPAIGN/UAT-CAMPAIGN-2.md) step 15) and have the original GM accept.
8. [ ] **GM (owner again):** Reload and check the history again.
       R1. If step 7 did not complete: **P1:** Transfer the Campaign ownership back to the GM with the same control, and **GM:** accept. Both then confirm the Campaign lists the GM as owner.

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
