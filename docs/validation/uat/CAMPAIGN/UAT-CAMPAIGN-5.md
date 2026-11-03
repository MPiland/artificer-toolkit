# UAT-CAMPAIGN-5: Party inventory and Vehicles

Party inventory and Vehicles.

Level 2 (GM setup) · Feature CAMPAIGN · Run order 58 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-9](UAT-CAMPAIGN-9.md): P1 is a member of the Sandbox Campaign with "UAT Dara" assigned.

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Open http://localhost:3000/vehicles/new, create a Vehicle named "UAT Party Wagon" and **Activate** it, so one exists to choose.

1. **GM:** Open the Campaign **Inventory** area and add an item and some currency to the party inventory.
2. **P1:** Open the Campaign and view the party inventory.
3. **P1:** Move an item from your Character's inventory to the party inventory, then move one back.
4. **GM:** Create a Vehicle for the Campaign by choosing a Vehicle definition.
5. **GM:** Place cargo in the Vehicle from the party inventory.
6. **GM:** Mark the Vehicle unavailable, then restore it.
7. **GM:** Return the cargo, then destroy the Vehicle.
8. **P1:** Reload and check where the cargo is.

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
- **Tester:**
- **Failed step:**
- **Notes:**
