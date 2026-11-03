# UAT-REACTION-7: Reconnect while a decision is open

Reconnect while a decision is open.

Level 3 (Core play) · Feature REACTION · Mode: Group (GM, P1) · Path position 110 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the Campaign **Review: Shield and Hold** (owner GM; member P1 with Ember, who has Shield and Hold Person; a Wolf and a Goblin; Assisted mode; the review Encounter started with the Goblin held by Ember's Hold Person and Ember's Shield reaction already used this round).
- Done in [UAT-REACTION-1](UAT-REACTION-1.md): steps 1 to 3 left a pending reaction prompt for P1.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **P1:** In your browser's Network panel set throttling to "Offline" for 30 seconds, then back to "No throttling".
2. **P1:** Confirm the page reconnects by itself and the Shield prompt is still waiting.
3. **GM:** Meanwhile confirm the attack is still held.
4. **P1:** Answer **Use**. Confirm the result is applied once.

## Expected

- The decision survives reconnect; temporary previews may vanish but the decision does not.

## Other users see

- **GM:** Sees the attack stay held throughout and sees no duplicate prompt for P1 after P1 returns.

## ACs covered

REACTION-1.1, REACTION-1.2

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
