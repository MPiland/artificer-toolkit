# UAT-AUTHORING-8: Author a Feat, a Race and a Vehicle

Author a Feat, a Race and a Vehicle.

Level 1 (Single-user basics) · Feature AUTHORING · Mode: Solo (P1) · Path position 26 of 195

## Prerequisites

- The account **P1** exists (a free account).
- The account **P2** exists (a free account), used only for the cross-role check.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open `<STAGING_URL>/feats/new`; create "UAT Sharp Eyes", save the draft, reload, then **Activate**.
2. [ ] **P1:** Search Feats for it, **Export JSON**, then **Duplicate** it and **Discard draft** on the copy.
3. [ ] **P1:** Open `<STAGING_URL>/races/new`; create "UAT Dwarf Line", save and **Activate**.
4. [ ] **P1:** Create a subrace of it, "UAT Dwarf Line Hill", that inherits from "UAT Dwarf Line" and **Activate** it.
5. [ ] **P1:** Edit "UAT Dwarf Line", change one trait, **Activate**, then open the subrace and check the trait.
6. [ ] **P1:** Try to delete "UAT Dwarf Line" while the subrace exists.
7. [ ] **P1:** Open `<STAGING_URL>/vehicles/new`; create "UAT Cart", save, **Activate**, upload artwork, and **Export JSON**.
8. [ ] **P1:** Delete the Vehicle.

## Expected

- Feats, Races and Vehicles each save as a draft, survive reload, and become active on **Activate**; exports download JSON.
- The subrace shows the changed parent trait after the parent is republished.
- Deleting a parent Race that has a published subrace is refused; deleting the subrace first works.
- The deleted Vehicle disappears from the list.

## Cross-role check

Run by a second person after the tester finishes, signed in to their own P2 account in their own browser (not part of the tester's run):

- **P2:** None of these appears in P2's Feats, Races or Vehicles lists.

## ACs covered

AUTHORING-7.1, AUTHORING-8.1, AUTHORING-10.1, AUTHORING-5.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
