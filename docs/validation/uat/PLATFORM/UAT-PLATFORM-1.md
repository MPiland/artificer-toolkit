# UAT-PLATFORM-1: SRD content is present and browsable

SRD content is present and browsable.

Level 1 (Single-user basics) · Feature PLATFORM · Run order 18 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.

## Accounts and windows

- **Accounts:** GM
- **Windows:** One browser window signed in as the account above.

## Steps

1. **GM:** Sign in and open http://localhost:3000/systems.
2. **GM:** Note how many Game Systems are listed, then open the SRD System.
3. **GM:** On the System page, look through the catalogues it shows (for example Rules Catalogues and reusable definitions) and open one entry.
4. **GM:** Open http://localhost:3000/spells. In **Search spells**, type "Fireball" and open the result.
5. **GM:** Open http://localhost:3000/creatures, search "Wolf", open it, go back, search "Goblin", open it.
6. **GM:** Open http://localhost:3000/classes and find Fighter. Open http://localhost:3000/races and find the Dragonborn. Open http://localhost:3000/backgrounds, http://localhost:3000/feats, http://localhost:3000/vehicles and confirm each list has entries.
7. **GM:** Open http://localhost:3000/equipment, search "Healer" and open "Healer's Kit".
8. **GM:** Reload the Fireball page and the Wolf page.

## Expected

- The Systems list shows the SRD System, and its page opens without an error.
- Every catalogue above lists SRD entries and each entry opens a read-only detail page with its full text (no empty or "not found" page).
- Searching narrows the list to matching names; clearing the search restores the list.
- Reloading a detail page shows the same content.
- The SRD entries are marked as SRD content (not Homebrew) and show no edit controls other than the copy action ("Duplicate to edit"); see [AUTHORING](../AUTHORING/README.md) for the lock and copy checks.

## Other users see

- Not applicable: single user.

## ACs covered

PLATFORM-2.3, PLATFORM-5.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
