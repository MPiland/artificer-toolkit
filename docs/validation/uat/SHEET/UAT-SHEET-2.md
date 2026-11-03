# UAT-SHEET-2: Short and long rest

Short and long rest.

Level 1 (Single-user basics) · Feature SHEET · Mode: Solo (P1) · Path position 47 of 190

## Prerequisites

- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-SHEET-1](UAT-SHEET-1.md): "UAT Dara" has taken damage (SHEET-1 step 3) and used Second Wind.

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser window, signed in as P1 with the account from your set. Your normal browser is fine.

## Steps

1. **P1:** On UAT Dara's Sheet, note hit points, hit dice, any spent resource, and any condition or exhaustion level.
2. **P1:** Open the rests section and start a short rest. Read the preview before confirming.
3. **P1:** In the preview, choose a number of hit dice to roll and roll them (with Roll my dice automatically OFF you are prompted; choose **Roll dice**).
4. **P1:** Confirm the short rest.
5. **P1:** Note hit points, hit dice, and which resources came back.
6. **P1:** Add a condition, then start a long rest, read the preview, and confirm it.
7. **P1:** Reload the page.

## Expected

- The short-rest preview lists the hit dice you may spend and what recovers; confirming adds the rolled healing to hit points and reduces remaining hit dice by the number rolled.
- Short-rest resources come back; long-rest-only resources do not come back on a short rest.
- After the long rest hit points are at maximum, spent resources and spell slots are restored, and only the hit dice and exhaustion changes the rest policy allows are applied.
- Effects that a rest should end (such as a reduced maximum hit points that ends on rest) are gone; effects that are not rest-ended stay.
- After reload the values are unchanged (no second rest effect is applied).

## Other users see

- Not applicable: single user.

## ACs covered

SHEET-2.1, SHEET-2.2, SHEET-2.3

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
