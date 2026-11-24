# UAT-SPELLS-17: Two Concentrations with an authored ring

Two Concentrations with an authored ring.

Level 4 (Advanced play) · Feature SPELLS · Mode: Group (GM, P1, P2) · Path position 171 of 191

## Prerequisites

- **The Campaign** is hosted by GM with P1, P2 and P3 seated as players.
- Done in [UAT-SPELLS-2](UAT-SPELLS-2.md): the arena Encounter from SPELLS-2 is running in The Campaign with Sage (P1), Hale (P2) and Vex (P3).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** In the item authoring forms build the ring as the steps describe. If the form cannot express a rule, mark the scenario BLOCKED and report which rule is missing. The Sheet lists each held Concentration with its own End Concentration button (SPELLS-12.T4b). Known gap: the once-per-dawn use counter display is unverified; do not assert it.

1. [ ] **GM:** In authoring create the homebrew ring described above and give it to Sage. **P1:** Equip it on Sage's Sheet.
2. [ ] **P1:** In the Encounter cast **Hold Person** on a Goblin, then **Fear** on the Wolf. Confirm both are held and the second cast does not replace the first.
3. [ ] **P1:** Cast **Charm Person** (a third Concentration). Confirm the prompt **End which Concentration?** and that choosing Hold Person ends only it and its grants.
4. [ ] **GM:** Damage Sage. Confirm one Concentration save per spell, in casting order, each prompted to **P1**.
5. [ ] **GM:** Fail the second save. Confirm only that spell ends.
6. [ ] **GM:** With only one spell held, damage Sage and confirm the ring's advantage is named on the save. With two held, damage Sage by more than 10 plus the second spell's level and confirm the disadvantage on the second spell's save is named.
7. [ ] **GM:** While two are held, confirm Sage has vulnerability to psychic damage (a psychic hit is doubled); end one and confirm the vulnerability goes.
8. [ ] **P1:** With the ring's one use per dawn already spent, cast a new Concentration and confirm it replaces the old one instead of keeping both.
9. [ ] **P1:** Unequip the ring, cast a new Concentration and confirm it replaces the old.

## Expected

- Authored rule only; without the ring or with no uses left, a new Concentration replaces the old.
- Each spell's Concentration save is separate; a failed save ends only its own spell and that spell's grants.

## Other users see

- **P2:** Sees which spells Sage concentrates on as badges on her token; must NOT see Sage's Concentration roll prompts.

## ACs covered

SPELLS-12.1, SPELLS-12.2, SPELLS-12.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
