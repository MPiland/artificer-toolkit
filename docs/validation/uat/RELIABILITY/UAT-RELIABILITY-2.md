# UAT-RELIABILITY-2: Two users act at the same moment

Two users act at the same moment.

Level 3 (Core play) · Feature RELIABILITY · Mode: Group (GM, P1, P2) · Path position 118 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** In Review: Shield and Hold use **Next turn** until a new round starts and Ember's Shield reaction is available again. (steps 1 to 7).

1. **GM:** In **Review: Shield and Hold**, open the live table and use **Next turn** until the Wolf is current. Have the Wolf attack Ember (roll if asked) so that a Shield prompt appears for Ember's player.
2. **P1:** Open the Shield prompt and leave it unanswered.
3. **GM:** Open the same prompt (the GM can answer for anyone).
4. **P1 and GM, together on "go":** P1 clicks **Use** while the GM clicks **Decline**.
5. **P1:** Read the screen after both clicks settle.
6. **GM:** Read the screen, then open Encounter history.
7. **GM:** Check Ember's spell slots and whether the attack hit or missed.
8. Switch both to **Review: Party in the Field**. **P1 and P2, together on "go":** P1 drags Aria's token and P2 drags Bryn's token to different empty squares.
9. **P1 and GM, together on "go":** P1 drags Aria's token to one empty square while the GM drags the same Aria token to a different empty square.
10. **GM, P1 and P2:** Look at Aria's position in each window, then reload each window and look again.
11. **GM:** Open Encounter history and read the movement entries from steps 8 and 9.
12. **GM (in Shield and Hold) and P2 (in Party in the Field), together on "go":** the GM presses **Next turn** in Shield and Hold while P2 drags Bryn's token in Party in the Field.
13. **GM (tab A and tab B, in the Sandbox), together on "go":** tab A presents Scene 1 while tab B presents Scene 2.
14. **GM and P1:** Reload both windows and read which Scene is presented.
15. **GM (tab A and tab B), together on "go":** both choose **Complete encounter** on the Sandbox Run. **GM:** Read the Encounter history.

## Expected

- Steps 5-7: only one answer wins. The other person sees a message that the choice was already answered or is out of date, and the stale click does not undo the winner. History records one reaction outcome, Ember loses at most one first-level slot, and Ember's reaction is spent once. The hit or miss matches the winning answer.
- Step 8: both moves succeed; each token ends on its own target square in every window.
- Step 9: one move wins and the other is refused or applies after it in order. Which one wins can vary; Aria is never in two places and never ends on a square occupied by another token.
- Step 10: all windows, before and after reload, show the same position for Aria and Bryn.
- Step 11: history shows each movement once, with no duplicate or half-finished entry.
- Step 12: both actions succeed independently (independent Runs do not block each other), and Bryn's move and the turn change each appear once.
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
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
