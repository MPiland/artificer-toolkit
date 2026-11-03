# UAT-ROOM-6: Notes — private and shared

Notes — private and shared.

Level 3 (Core play) · Feature ROOM · Mode: Group (GM, P1, P2) · Path position 82 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Party in the Field** (owner GM; members P1, P2 and P3 with Aria, Bryn and Cade, Level 1 Fighters, on the presented Scene; Assisted mode with the Speed Factor initiative; a Wolf token and a Goblin token; the review Encounter started and in round 2).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Open the Campaign notes and create an entry titled "P1 secret"; leave it **Private**.
2. **P1:** Create a second entry "P1 shared" and set it **Shared**.
3. **P2:** Open the notes and look for both entries.
4. **GM:** Open the notes and look for both entries.
5. **P1:** Change "P1 secret" to Shared; **P2:** reload the notes and look for it. Then **P1:** change it back to Private; **P2:** reload again.
6. **P2:** Try to change visibility on "P1 shared" and try to edit its text; then copy the address of "P1 secret" from P1's window (if an entry has its own address) and open it in P2's window.
7. **P1:** Open "P1 shared" in two tabs (A and B). In tab A change the text and save. In tab B (not reloaded) change the text differently and save.
8. **P1:** Delete "P1 secret".

## Expected

- Private entries are visible only to their author and the GM. Shared entries are visible to every member.
- Step 5: P2 sees "P1 secret" only while it is Shared.
- Step 6: P2 cannot change visibility; P2's attempt to open the private entry by address is refused. Record whether P2 may edit the text of a shared entry (the criterion only forbids reading or editing another member's private entry).
- Step 7: the save from the stale tab B is refused with a version-conflict message or shows tab A's change; tab A's text is not silently lost.
- Deleting removes it for everyone who could see it.

## Other users see

- **P2:** sees "P1 shared" but NOT "P1 secret".
- **GM:** sees both entries.

## ACs covered

ROOM-3.2, ROOM-3.5

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
