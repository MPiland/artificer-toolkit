# UAT-BUILDER-6: Imported custom items keep their kind, properties and damage

Imported custom items keep their kind, properties and damage.

Level 1 (Single-user basics) · Feature BUILDER · Mode: Solo (P1) · Path position 38 of 191

## Prerequisites

- The account **P1** exists.
- Use the provided file [assets/foundry-uat-fighter.json](../assets/foundry-uat-fighter.json): a Foundry dnd5e Actor JSON with SRD Human, Soldier and Fighter plus three custom items: UAT Ironwood Greatsword (equipped, two-handed, magical), UAT Ironwood Chain Mail (equipped, medium armor, AC 14) and UAT Ironwood Shield (equipped).

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open `<STAGING_URL>/library/import`.
2. [ ] **P1:** Under **Choose a source** pick the Foundry source type and choose the JSON file [foundry-uat-fighter.json](../assets/foundry-uat-fighter.json).
3. [ ] **P1:** Review the preview. All three custom items are listed under **Drafts required (3)** (they are imported as drafts; there is no per-item Active or Draft choice for them). Note the section each item is in and import.
4. [ ] **P1:** Open the imported Character's Sheet.
5. [ ] **P1:** Open the custom weapon, armor and shield in Equipment (`<STAGING_URL>/equipment`).
6. [ ] **P1:** On the Sheet inventory check which hand holds the weapon and shield and what is worn.
7. [ ] **P1:** Make an attack with the custom weapon from the Sheet.
8. [ ] **P1:** Delete the imported Character from **Characters** (confirm). P1 is back to 1 of 6 personal Characters (Aria).

## Expected

- The weapon is listed as a weapon (not generic gear) with its properties such as two-handed or versatile.
- The weapon attack uses the imported dice, damage type, ability modifier and magic bonus.
- The armor is listed as armor with its base AC, DEX rule and magic bonus; the shield as a shield; rarity shows when the System knows it.
- The equipped weapon and shield are in hands and the armor is worn; AC on the Sheet reflects them.

## Other users see

- Not applicable: single user.

## Known issue

The Foundry importer does not read a magic bonus or a rarity from the file (`mapFoundryEquipment` sets neither), so the Expected lines about a magic bonus on the attack and on AC, and about rarity, cannot be met through the Foundry source. They are kept unchanged; expect them to FAIL until the importer reads these fields or the owner revises the scenario. A D&D Beyond link would carry them but cannot be fetched offline, and no JSON file can stand in for it. Record the outcome in the Result block.

## ACs covered

BUILDER-4.1, BUILDER-4.2, BUILDER-4.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
