# UAT-PRIVACY-3: Non-members, removed players and signed-out visitors

Non-members, removed players and signed-out visitors.

Level 3 (Core play) · Feature PRIVACY · Mode: Group (GM, P1, P2, SPARE) · Path position 128 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2**, who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **SPARE**, a player who is a member of no Campaign and owns no Character.
- The review data provides the Campaign **Review: Fire and Thunder** (owner GM; member P2 with Pyra, who has Fireball and Thunderwave; a Wolf and three Goblins; Assisted mode; the review Encounter started; P1 and P3 are not members).
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.

## Accounts and windows

- **Roles used:** GM, P1, P2, SPARE
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** Open the address of Review: Fire and Thunder and try its tabletop address.
2. **P1:** Search listings for Fire and Thunder and open its public listing page, if one exists.
3. **GM:** In the Sandbox, remove P2 while P2's tabletop window is open ([UAT-CAMPAIGN-2](../CAMPAIGN/UAT-CAMPAIGN-2.md) shows the removal control).
4. **P2:** Watch the tabletop window, then reload it.
5. **P2:** Try the old tabletop address and the Campaign address.
6. **P2:** Try to open the Sheet addresses for P1's Character and for P2's own old Character in the Sandbox.
7. **Signed-out window:** Open the Sandbox tabletop address while signed out (a private window needs no spare account).
8. **SPARE:** Sign in with an account that is not a member and open the tabletop address.
   R1. **GM:** Re-seat the player you removed in steps 3 to 6 as in [CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md).

## Expected

- Steps 1 and 5 to 8 give a clear refusal (for example "Campaign membership is no longer available.", not found, or sign in required; record the exact wording), and no Campaign data appears.
- The open tabletop window of P2 stops receiving updates after removal and closes or shows an access message.
- P2 cannot read Character Sheets from a Campaign they have left.

## Other users see

- **P1 (not a member):** must NOT see any Fire and Thunder tokens, chat, notes, announcements or roster.
- **P2 (removed):** must NOT see any Encounter data, chat, notes or roster after removal.
- **Signed-out window and SPARE:** must NOT see anything.

## ACs covered

PRIVACY-1.2

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
