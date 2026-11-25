# UAT-CAMPAIGN-5: Party inventory and Vehicles

Party inventory and Vehicles.

Level 2 (GM setup) · Feature CAMPAIGN · Mode: Group (GM, P1) · Path position 56 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria assigned in The Campaign (done in [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md)).

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Open `<STAGING_URL>/vehicles/new`, create a Vehicle named "UAT Party Wagon" and **Activate** it, so one exists to choose.

1. [ ] **GM:** Open the Campaign **Inventory** area and add an item and some currency to the party inventory.
2. [ ] **P1:** Open the Campaign and view the party inventory.
3. [ ] **P1:** Move an item from your Character's inventory to the party inventory, then move one back.
4. [ ] **GM:** Create a Vehicle for the Campaign by choosing a Vehicle definition.
5. [ ] **GM:** Place cargo in the Vehicle from the party inventory.
6. [ ] **GM:** Mark the Vehicle unavailable, then restore it.
7. [ ] **GM:** Return the cargo, then destroy the Vehicle.
8. [ ] **P1:** Reload and check where the cargo is.

## Expected

- Movement between a Character, the party inventory and the Vehicle never creates or loses an item or coin; totals before equal totals after.
- Cargo in an unavailable or destroyed Vehicle is returned to a valid place, never lost.
- Players see the party inventory but not any GM-private inventory entries.

## Other users see

- **P1:** sees party inventory and Vehicles the GM made visible; must NOT see GM-private or audit-only entries.

## ACs covered

CAMPAIGN-4.1, CAMPAIGN-5.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
