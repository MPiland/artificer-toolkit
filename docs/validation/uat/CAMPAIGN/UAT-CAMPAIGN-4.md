# UAT-CAMPAIGN-4: Campaign content, sources and removals

Campaign content, sources and removals.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1) · Path position 54 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria assigned in The Campaign (done in [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md)).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Open `<STAGING_URL>/spells/new`, create a homebrew Spell named "UAT GM Spark" (level 1, any school and casting time) and **Activate** it.
S2. **GM:** Open `<STAGING_URL>/races/new`, create a homebrew Race named "UAT GM Folk" and **Activate** it.

1. [ ] **GM:** Open the Campaign **Settings** and read **Primary Rules Catalogue** and **Additional Rules Catalogues**.
2. [ ] **GM:** Add the homebrew Spell's parent source (if the Spell is built on an official Spell, share the parent first) so the homebrew Spell is available in this Campaign.
3. [ ] **GM:** Reload the Settings page and check that the share persisted.
4. [ ] **P1:** Open the Builder for a new Character in this Campaign and check which content is offered.
5. [ ] **GM:** Open Campaign **Content** and try to share the homebrew Spell without its parent source being shared, if you skipped that in step 2. (A share from a different Game System cannot be tried: only one Game System exists locally.)
6. [ ] **P1:** Build a Character that uses the homebrew Spell and, on the Campaign Party panel, choose **Change Character** to assign it in place of Aria.
7. [ ] **GM:** Try to remove the homebrew Spell from the Campaign.
8. [ ] **P1:** Choose **Change Character** and put Aria back, then delete the Character you built in step 6 from **Characters** (P1 is back to 1 of 6). **GM:** Then remove the Spell from the Campaign.
9. [ ] **GM:** Reload the Settings page.
10. [ ] **GM:** In Settings, change the text presentation option (for example mature content wording) if offered, then view a shared item as P1 and as yourself.

## Expected

- Settings changes save with a "Saved." message and persist on reload.
- A homebrew item without its parent source is refused with a message naming the missing parent (step 5, or step 2 if you try the share before the parent).
- Removing a source still used by a Character, draft or optional combat definition is refused and names what uses it. After the Character no longer uses it, the removal works and stays removed after reload.
- Text presentation applies to the shared copies; private notes keep their original text.

## Other users see

- **P1:** sees the added content in the Builder and in the Campaign; does NOT see content the GM has not shared, nor GM-only Settings.

## ACs covered

CAMPAIGN-3.1, CAMPAIGN-3.2, CAMPAIGN-3.3, CAMPAIGN-3.4, CAMPAIGN-3.5

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
