# UAT-CAMPAIGN-1: Create, edit, copy, archive and delete a Campaign

Create, edit, copy, archive and delete a Campaign.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Solo (GM) · Path position 47 of 195

## Prerequisites

- **GM** has an account and hosts no Campaign yet.
- All accounts are on the FREE plan: 1 active hosted Campaign per account, 5 player seats per Campaign, 5 Scenes per Campaign and 6 personal Characters per account.

## Accounts and windows

- **Roles used:** GM
- **Windows:** One browser, signed in as GM.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open **Campaigns** and choose **Create a Campaign** (or **Start your first table**).
2. [ ] **GM:** Enter a **Campaign name** such as "Plot Campaign", a description, choose a **Game System** and create it.
3. [ ] **GM:** On the new Campaign page open **Settings**, change the description, and wait for "Saved.".
4. [ ] **GM:** Open the notes area, add a notes section called "Plot" with one line of text.
5. [ ] **GM:** Choose **Copy Campaign** while the original is still active. The FREE plan allows one active hosted Campaign, so expect a refusal naming that limit. Record the exact wording.
6. [ ] **GM:** Archive the original Campaign. Open the archive list (**View archive**) and confirm it is there. Check that **Campaigns** no longer lists it as active.
7. [ ] **GM:** Try to edit the archived Campaign.
8. [ ] **GM:** From the archive, choose **Copy Campaign** on the original. Leave the notebook content unticked, create the copy, and open it.
9. [ ] **GM:** Delete that first copy (the one without notes) and wait for **Campaign deleted.**
10. [ ] **GM:** Copy the archived original again, this time ticking **Notebook content to copy** for the "Plot" section. Open the copy and compare its name, description and notes with the original.
11. [ ] **GM:** In the second copy's **Settings** rename it to "The Campaign". This is The Campaign that the later scenarios use.
12. [ ] **GM:** Reload **Campaigns** and check the active list and the archive list.

## Expected

- The new Campaign is listed on **Campaigns** and opens with the name and description you gave.
- Step 5 is refused with a message that names the hosted-Campaign limit, and nothing is created.
- The archived Campaign is read-only ("This Campaign is read-only.") and moves from the active list to the archive.
- The first copy has the same game metadata (name pattern, description) but no notes; the second copy has the "Plot" section too.
- The deleted copy is gone after a reload; deletion shows progress and then disappears. "The Campaign" (the second copy) is the only active Campaign, and the archived original remains in the archive.

## Other users see

- Not applicable: one person acts in this scenario.

## ACs covered

CAMPAIGN-1.1, CAMPAIGN-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
