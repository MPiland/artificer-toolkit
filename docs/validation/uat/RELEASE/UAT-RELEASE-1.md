# UAT-RELEASE-1: Exact cleanup and final acceptance

Exact cleanup and final acceptance.

Level 5 (Reliability, performance and release) · Feature RELEASE · Mode: Group (GM, P1, P2, P3) · Path position 193 of 195

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- P1 has Aria, P2 has Bryn and P3 has Cade as their Characters in The Campaign (each a Level 1 Fighter, built by their player in the Character Builder).
- The Campaign has a Scene presented and an Encounter started in Assisted mode with a Wolf, a Goblin and the party's Characters, in round 2 ([UAT-ENCOUNTER-3](../ENCOUNTER/UAT-ENCOUNTER-3.md) steps 3 to 5, then **Next turn** until round 2).
- **P3's Campaign** exists, hosted by P3, with P1 as a member and no presented Scene (done in [UAT-SOCIAL-1](../SOCIAL/UAT-SOCIAL-1.md); [UAT-RELIABILITY-2](../RELIABILITY/UAT-RELIABILITY-2.md) removed its Scene). P3 hosts it because GM already hosts The Campaign and the FREE plan allows one active hosted Campaign per account.
- P2 has Pyra (built in [UAT-VTT_UI-2](../VTT_UI/UAT-VTT_UI-2.md)) and P1 has Ember (built in [UAT-REACTION-1](../REACTION/UAT-REACTION-1.md)); both are benched in The Campaign, and Aria and Bryn are the Active Characters.
- The [alpha play guide](../../../guides/alpha-play-guide.md) is open beside the app.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **GM and P1:** Open the Campaign's session page and choose **Open tabletop window** in the **Live tabletop** panel. Check the guide's "Joining the live table" list: the **GM** or **Player** badge, "Live editing available" for the GM and "Play view" for the player, and the **Auto-roll** switch.
2. [ ] **P1:** Open the tabletop of P3's Campaign (no Scene presented; P1 is a member there) and check you see "The GM has not presented a scene yet."
3. [ ] **P1:** Open **Open live tabletop window** from Aria's Sheet and confirm it reaches the same room.
4. [ ] **P1:** Open Settings, Preferences and find **Roll my dice automatically**. With it OFF, check you get a roll prompt with **Roll dice** and a place to type physical faces. Switch it ON and check there is no prompt but reactions still ask.
5. [ ] **GM:** In the Campaign's table settings confirm **Assisted** and **Manual** exist. In Assisted, trigger a rule problem and check the warning has **Do it anyway**.
6. [ ] **P1:** Drag Aria's token. Check the readout "used / budget ft", the yellow "N ft over" when exceeded, and that the app does not stop you.
7. [ ] **P1:** Drag Aria away from the Wolf. Check the **Pending decision** with **Use reaction** and **Decline reaction**, and "Waiting on a movement decision." for other moves.
8. [ ] **GM:** Check the turn controls exist: Current turn, Previous turn, Next turn, Undo last action, Complete encounter.
9. [ ] **P1:** Attack from the action drawer. Check advantage or disadvantage reasons are shown, and that hidden or unseen targets are refused.
10. [ ] **P1:** Choose **Mark active** on Ember on the Party roster (Aria is in the running Encounter, so this sends a request: the roster shows "Requested, waiting for the GM"). **GM:** Approve it from the Party roster or the header **Character swap request** button; Ember takes Aria's place in the fight. **P1:** Then check spell rows read like "Name (Nth level)", rituals show as unavailable, and reaction spells such as Shield appear as prompts.
11. [ ] **P2:** Choose **Mark active** on Pyra and have the **GM** approve the request as in step 10 (Pyra takes Bryn's place), then cast Fireball so that it catches both the Wolf and the Goblin, and check each creature gets its own save prompt (the GM answers for monsters).
12. [ ] **GM:** Check the **Public / Private** switch (**Roll visibility**), the **My rolls** and **Enemy rolls** areas, and the **Show roll** and **Show that I rolled** buttons (each works once).
13. [ ] **GM:** Check **Undo last token move** (stage icon) and **Undo last action**. Confirm players have neither.
14. [ ] **GM:** Read the guide's contents and check it has a Player section and a GM section that together cover joining a Session, Scenes, tokens and movement, Manual versus Assisted, initiative, the turn stages (Recharge, death saves, start-of-turn effects), attacks, saves, spells and reactions, Public and Private rolls and reveals, the auto-roll preference, and what can and cannot be undone. Record any flow with no section.
15. [ ] **P1, P2, P3:** Read the guide's "Known gaps" and mark any item the build contradicts, or any gap you hit that is not listed.
16. [ ] **P1:** Follow "Sending feedback" and check every item it asks for (Campaign, Scene, round and turn, mode, what you expected, what happened, repeatable) can be found in the app.
17. [ ] **GM:** Send one real piece of feedback using that list, or write down where the list was not enough.
18. [ ] **GM:** Check that The Campaign, built by the earlier scenarios, has its members with their Characters, a presented Scene with tokens and a started Encounter, and that together they exercise each play surface listed in step 19. For any surface the data built so far does not show (for example an area, a condition or Concentration), build it by hand with the scenario that creates it, then continue.
19. [ ] **GM:** For each play surface (party, creatures, areas, spells and slots, conditions, Concentration, reactions, initiative, roll cards) record a finding: fine, fix, or register as new work.
20. [ ] **GM:** Write the sign-off line in the results: "UI review signed off, findings fixed or registered", with the date and your name. If you cannot sign off, list the blocking findings.

## Expected

- Every statement in the guide matches the build, or the difference is written down so the guide is corrected before alpha invites go out.
- The guide has Player and GM sections covering every flow named in RELEASE-7.1, lists the known gaps, and says how to send feedback.
- A sign-off line exists, or a list of blocking findings exists; each finding is fixed or registered.

## Other users see

- **P1, P2, P3:** Where a step names them, they see what the guide says for a player: "Play view", no undo controls, no GM private rolls.

## ACs covered

RELEASE-7.1, RELEASE-7.2, RELEASE-7.3, RELEASE-8.1, RELEASE-8.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
