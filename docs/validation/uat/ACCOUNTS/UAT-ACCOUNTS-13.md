# UAT-ACCOUNTS-13: Campaign text follows the same language rules as usernames

Campaign text follows the same language rules as usernames.

Level 1 (Single-user basics) · Feature ACCOUNTS · Run order 12 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.

## Accounts and windows

- **Accounts:** GM
- **Windows:** One browser window signed in as the account above.

## Steps

1. **GM:** Open http://localhost:3000/campaigns/new.
2. **GM:** In **Campaign name** type `ass_muncher` and try to continue or save.
3. **GM:** Replace it with `Cassandra's Classic Table` and try to continue or save, but do not finish creating the Campaign (leave the page).
4. **GM:** Open any existing Campaign's notes and try to save a note containing `AssMuncher`, then remove the text.

## Expected

- Step 2: refused with a visible message about the text; no Campaign is created.
- Step 3: accepted as ordinary text (ordinary names containing "ass" inside words are not refused).
- Step 4: the blocked note text is refused and the note is not saved with it.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-7.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
