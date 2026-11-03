# UAT-AUTHORING-7: Equipment variants, inheritance and item names

Equipment variants, inheritance and item names.

Level 1 (Single-user basics) · Feature AUTHORING · Run order 28 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** Open http://localhost:3000/equipment, search "Healer" and open the SRD item.
2. **P1:** Read its name and look for its uses/charges.
3. **P1:** Search "Arrows", "Crossbow Bolts", "Sling Bullets", "Blowgun Needles", "Iron Spikes" and read each name and price.
4. **P1:** Duplicate the SRD Longsword to a draft, name it "UAT Blade", and **Activate** it.
5. **P1:** Create a variant of "UAT Blade" named "UAT Blade +1" that inherits from it and adds a bonus; **Activate** it.
6. **P1:** Edit "UAT Blade" (change the damage dice) and **Activate** the new version.
7. **P1:** Open "UAT Blade +1" and look at its damage.
8. **P1:** Try to delete "UAT Blade" while the variant exists.
9. **P1:** Delete the variant first, then the base.

## Expected

- Step 1-2: the item is named "Healer's Kit" with no number in the name; its 10 uses appear as charges.
- Step 3: names carry no bundle counts (for example "Arrows", not "Arrows (20)"); price is per piece.
- Step 5-7: the variant inherits the base; after the base is republished the variant shows the new damage dice without being edited.
- Step 8: deletion of the base is refused naming the published variant.
- Step 9: deletion succeeds in that order.

## Other users see

- **P2:** Searching Equipment for "UAT Blade" finds nothing at any point.

## ACs covered

AUTHORING-6.1, AUTHORING-6.2, AUTHORING-13.3, AUTHORING-16.1, AUTHORING-16.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
