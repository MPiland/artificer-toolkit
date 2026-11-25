# UAT-RELIABILITY-2: Two users act at the same moment

Two users act at the same moment.

Level 3 (Core play) · Feature RELIABILITY · Mode: Group (GM, P1, P2, P3) · Path position 125 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1's Active Character in The Campaign is Ember, who has Shield and Hold Person. She is benched in The Campaign from [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md); P1 marks her active between Encounters, before the Encounter below starts (the party's wizard joins for this arc). P2 has Bryn and P3 has Cade.
- An Encounter is running in The Campaign in Assisted mode with a Wolf, a Goblin, Ember, Bryn and Cade ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5). Ember's Shield reaction has not been used this round.
- **P3's Campaign** exists, hosted by P3 (done in [UAT-SOCIAL-1](../SOCIAL/UAT-SOCIAL-1.md); P1 and P5 are members). P3 hosts it because GM already hosts The Campaign and the FREE plan allows one active hosted Campaign per account. It has no Scene yet.
- Three Scenes exist in The Campaign ("UAT Cavern" from [UAT-SCENE-1](../SCENE/UAT-SCENE-1.md) and the two from [UAT-RELIABILITY-4](UAT-RELIABILITY-4.md)).

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

S0. **P3:** In P3's Campaign add one Scene with a map (as in [UAT-SCENE-1](../SCENE/UAT-SCENE-1.md) steps 1 to 3) and present it, then start an Encounter with a Wolf and a Goblin only (as in [UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5; P3 has no Character there).
S1. **GM:** Check that Ember's Shield reaction is available (use **Next turn** until a new round starts if it was used).

1. [ ] **GM:** In The Campaign, open the live table and use **Next turn** until the Wolf is current. Have the Wolf attack Ember (roll if asked) so that a Shield prompt appears for Ember's player.
2. [ ] **P1:** Open the Shield prompt and leave it unanswered.
3. [ ] **GM:** Open the same prompt (the GM can answer for anyone).
4. [ ] **P1 and GM, together on "go":** P1 clicks **Use** while the GM clicks **Decline**.
5. [ ] **P1:** Read the screen after both clicks settle.
6. [ ] **GM:** Read the screen, then open Encounter history.
7. [ ] **GM:** Check Ember's spell slots and whether the attack hit or missed.
8. [ ] **P1 and P2, together on "go":** P1 drags Ember's token and P2 drags Bryn's token to different empty squares.
9. [ ] **P1 and GM, together on "go":** P1 drags Ember's token to one empty square while the GM drags the same Ember token to a different empty square.
10. [ ] **GM, P1 and P2:** Look at Ember's position in each window, then reload each window and look again.
11. [ ] **GM:** Open Encounter history and read the movement entries from steps 8 and 9.
12. [ ] **P3 (in P3's Campaign) and P2 (in The Campaign), together on "go":** P3 presses **Next turn** in P3's Campaign while P2 drags Bryn's token in The Campaign.
13. [ ] **GM (tab A and tab B, both in The Campaign), together on "go":** tab A presents Scene 1 while tab B presents Scene 2.
14. [ ] **GM and P1:** Reload both windows and read which Scene is presented.
15. [ ] **GM (tab A and tab B), together on "go":** both choose **Complete encounter** on the Run in The Campaign. **GM:** Read the Encounter history.
        R1. **P3:** Complete the Encounter in P3's Campaign and delete its Scene, so P3's Campaign has no Scene and no running Encounter again.

## Expected

- Steps 5-7: only one answer wins. The other person sees a message that the choice was already answered or is out of date, and the stale click does not undo the winner. History records one reaction outcome, Ember loses at most one first-level slot, and Ember's reaction is spent once. The hit or miss matches the winning answer.
- Step 8: both moves succeed; each token ends on its own target square in every window.
- Step 9: one move wins and the other is refused or applies after it in order. Which one wins can vary; Ember is never in two places and never ends on a square occupied by another token.
- Step 10: all windows, before and after reload, show the same position for Ember and Bryn.
- Step 11: history shows each movement once, with no duplicate or half-finished entry.
- Step 12: both actions succeed independently (Runs in different Campaigns do not block each other), and Bryn's move and the turn change each appear once.
- Steps 13-14: exactly one Scene ends up presented, the same in every window before and after reload; the other attempt is refused or applied after it in order.
- Step 15: the Run completes once; the second attempt is refused as already complete, and history shows one completion.

## Other users see

- **P1:** The same winning answer and final positions as the GM.
- **P2:** In steps 8-11 sees both tokens end where the winning commands put them; never a token in two places.

## ACs covered

RELIABILITY-2.1, RELIABILITY-2.2, RELIABILITY-2.3, RELIABILITY-2.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
