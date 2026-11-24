# UAT-PRIVACY-9: A hidden Concentration source stays hidden

A hidden Concentration source stays hidden.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1, P2) · Path position 119 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has switched to Ember in The Campaign (Change Character), who has Shield and Hold Person.
- An Encounter is running in The Campaign in Assisted mode with a Wolf, a Goblin and Ember ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5).

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Add a hidden Mage creature to the Scene. Have it cast a Concentration spell (for example Hold Person on Ember) so the hidden caster concentrates. **P1:** Roll my dice automatically OFF.

1. [ ] **GM:** Add a creature that is hidden from players and cast a Concentration spell with it (or give it a concentrating effect).
2. [ ] **GM:** Deal damage to the hidden creature outside its own turn so its Concentration check fails.
3. [ ] **P1 and P2:** Read the chat and history notice about the dropped Concentration.
4. [ ] **GM:** Read the same notice.
       R1. **GM:** Remove the creatures you added from the Encounter, so the Encounter is again the Wolf, the Goblin and the three Characters.

## Expected

- The GM's notice names the hidden creature or spell source.
- Players' notice says that Concentration ended without the hidden source's name.

## Other users see

- **P1:** must NOT see the hidden creature's name, token or spell source in the notice or anywhere, including after a reload.
- **P2:** must NOT see the hidden creature's name, token or spell source either.

## ACs covered

PRIVACY-4.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
