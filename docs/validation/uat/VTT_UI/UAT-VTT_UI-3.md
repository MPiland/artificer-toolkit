# UAT-VTT_UI-3: Light, fog, senses and the GM's view preview

Light, fog, senses and the GM's view preview.

Level 3 (Core play) · Feature VTT_UI · Mode: Group (GM, P1) · Path position 138 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- Done in [UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md): P1, P2 and P3 are seated in the Sandbox Campaign with their Characters.
- Done in [UAT-SCENE-1](../SCENE/UAT-SCENE-1.md): "UAT Cavern" exists.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** Open the Scene settings and set ambient illumination to Bright. Confirm the map shows as authored.
2. **GM:** Set to Dim. Confirm the map is visibly darkened. Set to Dark. Confirm it is black beyond lights and senses.
3. **GM:** Add a light with a bright and a dim radius and a colour. Confirm both radii show, tinted by the colour without washing out the map art.
4. **GM:** Add a magical darkness area. Confirm it stays black inside light.
5. **GM:** Add an obscurement. Confirm it draws as its own layer.
6. **GM:** Use the view preview to see as a chosen token. Confirm you see that token's view.
7. **P1:** With the darkvision Character assigned, confirm that within the darkvision range darkness shows as dim light in greys and dim light shows as bright in colour.
8. **GM:** Give P1 control of a second token (the Giant Bat) in its **Controllers**. **P1:** Select that token, then P1's Character's token. Confirm the view changes to the selected token's senses, one token at a time.
9. **P1:** Select the Giant Bat and confirm its blindsight reveals within range regardless of light. **GM:** Give a token truesight (or use a creature that has it) and confirm magical darkness shows through it.
10. **GM:** Assign the Warlock with Devil's Sight to P1's seat. **P1:** Confirm within its range it sees in colour in both ordinary and magical darkness, does not see invisible creatures, and magical darkness is marked by a dotted outline and faint tint.
11. **GM:** Open the view preview for the Wolf. Confirm it uses the Wolf's stat-block senses like a Character does (compare with the senses printed on its stat block).

## Expected

- Ambient levels, light radii, magical darkness, obscurement and senses render as described; the GM can see everything; a player's view uses one token's senses at a time.

## Other users see

- **P1:** Sees only their own token's view; never the GM's full view.

## ACs covered

VTT_UI-3.2, VTT_UI-3.4, VTT_UI-3.5, VTT_UI-5.2

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
