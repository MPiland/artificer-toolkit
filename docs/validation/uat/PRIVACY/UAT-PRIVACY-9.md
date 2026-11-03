# UAT-PRIVACY-9: A hidden Concentration source stays hidden

A hidden Concentration source stays hidden.

Level 3 (Core play) · Feature PRIVACY · Run order 114 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

S1. **GM:** Add a hidden Mage creature to the Scene. Have it cast a Concentration spell (for example Hold Person on Ember) so the hidden caster concentrates. **P1:** Roll my dice automatically OFF.

1. **GM:** Add a creature that is hidden from players and cast a Concentration spell with it (or give it a concentrating effect).
2. **GM:** Deal damage to the hidden creature outside its own turn so its Concentration check fails.
3. **P1:** Read the chat and history notice about the dropped Concentration.
4. **GM:** Read the same notice.
   R1. **GM:** Remove the creatures you added from the Encounter, so the Encounter is again the Wolf, the Goblin and the three Characters.

## Expected

- The GM's notice names the hidden creature or spell source.
- Players' notice says that Concentration ended without the hidden source's name.

## Other users see

- **P1:** must NOT see the hidden creature's name, token or spell source in the notice or anywhere, including after a reload.
- **P2:** not a member of Shield and Hold; sees nothing of it.

## ACs covered

PRIVACY-4.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
