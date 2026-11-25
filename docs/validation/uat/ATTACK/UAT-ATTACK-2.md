# UAT-ATTACK-2: Players control only their own actors

Players control only their own actors.

Level 3 (Core play) · Feature ATTACK · Mode: Group (GM, P1, P2, P3) · Path position 96 of 195

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- **The Campaign** has Aria (P1), Bryn (P2) and Cade (P3), level 1 Fighters each player built, seated; Assisted mode with the Speed Factor initiative; and a running Encounter in round 2 with tokens for the three Fighters, a Wolf and a Goblin, as the GM built it in [UAT-ENCOUNTER-1](../ENCOUNTER/UAT-ENCOUNTER-1.md) (steps 12 to 16) and played on.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P1 and P2:** Switch **Auto-roll** ON in the tabletop header.

1. [ ] **GM:** Advance to Aria's turn.
2. [ ] **P2:** Try to attack with Aria (open the drawer, or select Aria's token and try to use an action). Read the refusal.
3. [ ] **P2:** Try to move Aria's token. Read the refusal.
4. [ ] **P1:** Try to act for the Wolf (select its token and try an action). Read the refusal.
5. [ ] **P1:** While it is still Aria's turn, use an action for Aria. Confirm it works.
6. [ ] **GM:** Advance to Bryn's turn.
7. [ ] **P1:** Try to attack with Aria out of turn. Read the refusal.
8. [ ] **GM:** Mark the Goblin's token hidden from players. **P2:** On Bryn's turn, open the target list and confirm the Goblin is not listed.
9. [ ] **P1:** Start an attack and, before confirming, quickly click confirm twice (double-click). Confirm only one attack resolves and that you cannot have two Encounter commands in flight.
10. [ ] **GM:** Open the Goblin's **Controllers** and give P2 control, then advance to the Goblin's turn. **P2:** Confirm you can now act for the Goblin and end its turn.
11. [ ] **GM:** Advance to the Goblin's next turn and remove P2 from the Goblin's controllers. Confirm P2 can no longer act for it.
12. [ ] **P2:** Try again to act for the Goblin. Read the refusal.

## Expected

- Acting for another player's Character, an uncontrolled creature, acting out of turn, or targeting a hidden creature is refused with a plain message, and nothing changes in the history.
- A granted creature works until the GM revokes control.
- A second click while a command is in flight does not produce a second action.

## Other users see

- **GM:** Sees refusals not at all in history (rejections change nothing); sees granted and revoked actions normally.
- **P3:** Sees only accepted actions on the table.

## ACs covered

ATTACK-2.2, ATTACK-2.3, ATTACK-2.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
