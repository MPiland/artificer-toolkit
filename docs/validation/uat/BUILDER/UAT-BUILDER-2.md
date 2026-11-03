# UAT-BUILDER-2: Two windows on one draft cannot overwrite each other

Two windows on one draft cannot overwrite each other.

Level 1 (Single-user basics) · Feature BUILDER · Run order 37 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-BUILDER-1](UAT-BUILDER-1.md): "UAT Dara" exists as a committed Character, and a saved draft is needed: create a quick draft named "UAT Race Condition" in the Builder and save it before step 1.

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.

## Steps

S1. **P1:** Open http://localhost:3000/characters, choose **Create Character**, enter the name "UAT Race Condition", and choose **Save Character Draft**. This is the saved draft the steps use.

1. **P1:** Open the draft in window A and in window B (two tabs of the same account).
2. **P1:** In window A change the Character Name to "UAT RC One" and choose **Save Character Draft**.
3. **P1:** In window B (still showing the old version) change the name to "UAT RC Two" and choose **Save Character Draft**.
4. **P1:** Reload window B.
5. **P1:** Finish the draft in window A to **Activate** it.
6. **P1:** In window B (still open), try to **Activate** the same draft.
7. **P1:** Check the Characters list.

## Expected

- Step 3: the save from the older window is refused with a message that a newer version exists; the draft keeps "UAT RC One".
- Step 4: window B now shows "UAT RC One".
- Step 5: the Character is created.
- Step 6: the second commit is refused because the draft was already consumed; no second Character is created.
- Step 7: exactly one "UAT RC One" Character exists.

## Other users see

- Not applicable: single user.

## ACs covered

BUILDER-1.2, BUILDER-2.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
