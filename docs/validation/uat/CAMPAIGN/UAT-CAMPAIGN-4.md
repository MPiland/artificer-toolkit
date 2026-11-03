# UAT-CAMPAIGN-4: Campaign content, sources and removals

Campaign content, sources and removals.

Level 2 (GM setup) · Feature CAMPAIGN · Run order 57 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md): P1 is a member of the Sandbox Campaign with "UAT Dara" assigned and GM is the owner.

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Open http://localhost:3000/spells/new, create a homebrew Spell named "UAT GM Spark" (level 1, any school and casting time) and **Activate** it.
S2. **GM:** Open http://localhost:3000/races/new, create a homebrew Race named "UAT GM Folk" and **Activate** it.

1. **GM:** Open the Campaign **Settings** and read **Primary Rules Catalogue** and **Additional Rules Catalogues**.
2. **GM:** Add the homebrew Spell's parent source (if the Spell is built on an official Spell, share the parent first) so the homebrew Spell is available in this Campaign.
3. **GM:** Reload the Settings page and check that the share persisted.
4. **P1:** Open the Builder for a new Character in this Campaign and check which content is offered.
5. **GM:** Open Campaign **Content** and try to share the homebrew Spell without its parent source being shared, if you skipped that in step 2. (A share from a different Game System cannot be tried: only one Game System exists locally.)
6. **P1:** Build a Character that uses the homebrew Spell and, on the Campaign Party panel, choose **Change Character** to assign it in place of "UAT Dara".
7. **GM:** Try to remove the homebrew Spell from the Campaign.
8. **P1:** Choose **Change Character** and put "UAT Dara" back. **GM:** Then remove the Spell from the Campaign.
9. **GM:** Reload the Settings page.
10. **GM:** In Settings, change the text presentation option (for example mature content wording) if offered, then view a shared item as P1 and as yourself.

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
- **Failed step:**
- **Notes:**
