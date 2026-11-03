# UAT-CAMPAIGN-1: Create, edit, copy, archive and delete a Campaign

Create, edit, copy, archive and delete a Campaign.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Solo (GM) · Path position 52 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the four review Campaigns, which this scenario does not touch (you make your own Campaigns).

## Accounts and windows

- **Roles used:** GM
- **Windows:** One browser window, signed in as GM with the account from your set. Your normal browser is fine.

## Steps

1. **GM:** Open **Campaigns** and choose **Create a Campaign** (or **Start your first table**).
2. **GM:** Enter a **Campaign name** such as "UAT Sandbox", a description, choose a **Game System** and create it.
3. **GM:** On the new Campaign page open **Settings**, change the description, and wait for "Saved.".
4. **GM:** Open the notes area, add a notes section called "Plot" with one line of text.
5. **GM:** Choose **Copy Campaign**. Leave the notebook content unticked, create the copy, and open it.
6. **GM:** Go back to the original and copy it again, this time ticking **Notebook content to copy** for the "Plot" section.
7. **GM:** Open each copy and compare name, description and notes.
8. **GM:** On the original Campaign, archive it. Open the archive list (**View archive**) and confirm it is there.
9. **GM:** Try to edit the archived Campaign.
10. **GM:** Delete the first copy (the one without notes) and wait for **Campaign deleted.** Keep the second copy (with the "Plot" section) for the later scenarios.
11. **GM:** Reload **Campaigns** and check the active list and the archive list.

## Expected

- The new Campaign is listed on **Campaigns** and opens with the name and description you gave.
- The first copy has the same game metadata (name pattern, description) but no notes; the second copy has the "Plot" section too.
- The archived Campaign is read-only ("This Campaign is read-only.") and moves from the active list to the archive.
- The deleted copy is gone after a reload; deletion shows progress and then disappears. The second copy and the archived original remain.

## Other users see

- Not applicable: single user.

## ACs covered

CAMPAIGN-1.1, CAMPAIGN-1.2

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
