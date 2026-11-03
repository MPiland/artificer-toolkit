# UAT-AUTHORING-8: Author a Feat, a Race and a Vehicle

Author a Feat, a Race and a Vehicle.

Level 1 (Single-user basics) · Feature AUTHORING · Mode: Group (P1, P2) · Path position 31 of 188

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.

## Accounts and windows

- **Roles used:** P1, P2
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Open `<STAGING_URL>/feats/new`; create "UAT Sharp Eyes", save the draft, reload, then **Activate**.
2. **P1:** Search Feats for it, **Export JSON**, then **Duplicate** it and **Discard draft** on the copy.
3. **P1:** Open `<STAGING_URL>/races/new`; create "UAT Dwarf Line", save and **Activate**.
4. **P1:** Create a subrace of it, "UAT Dwarf Line Hill", that inherits from "UAT Dwarf Line" and **Activate** it.
5. **P1:** Edit "UAT Dwarf Line", change one trait, **Activate**, then open the subrace and check the trait.
6. **P1:** Try to delete "UAT Dwarf Line" while the subrace exists.
7. **P1:** Open `<STAGING_URL>/vehicles/new`; create "UAT Cart", save, **Activate**, upload artwork, and **Export JSON**.
8. **P1:** Delete the Vehicle.

## Expected

- Feats, Races and Vehicles each save as a draft, survive reload, and become active on **Activate**; exports download JSON.
- The subrace shows the changed parent trait after the parent is republished.
- Deleting a parent Race that has a published subrace is refused; deleting the subrace first works.
- The deleted Vehicle disappears from the list.

## Other users see

- **P2:** None of these appears in P2's Feats, Races or Vehicles lists.

## ACs covered

AUTHORING-7.1, AUTHORING-8.1, AUTHORING-10.1, AUTHORING-5.1

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
