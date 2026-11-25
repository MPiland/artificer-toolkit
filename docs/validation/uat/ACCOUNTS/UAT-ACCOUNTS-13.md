# UAT-ACCOUNTS-13: Campaign text follows the same language rules as usernames

Campaign text follows the same language rules as usernames.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Solo (GM) · Path position 10 of 195

## Prerequisites

- **GM** has an account and has not created a Campaign yet (a free account hosts one active Campaign; this scenario creates and deletes its own).

## Accounts and windows

- **Roles used:** GM
- **Windows:** One browser, signed in as GM.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM:** Open `<STAGING_URL>/campaigns/new`.
2. [ ] **GM:** In **Campaign name** type `ass_muncher` and try to continue or save.
3. [ ] **GM:** Replace it with `Cassandra's Classic Table` and create the Campaign.
4. [ ] **GM:** Open that Campaign's notes and try to save a note containing `AssMuncher`, then remove the text.
5. [ ] **GM:** Delete "Cassandra's Classic Table" and wait for **Campaign deleted.**, so you have no Campaign again for [UAT-CAMPAIGN-1](../CAMPAIGN/UAT-CAMPAIGN-1.md).

## Expected

- Step 2: refused with a visible message about the text; no Campaign is created.
- Step 3: accepted as ordinary text (ordinary names containing "ass" inside words are not refused) and the Campaign is created.
- Step 4: the blocked note text is refused and the note is not saved with it.
- Step 5: the Campaign is deleted and disappears from your list.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-7.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
