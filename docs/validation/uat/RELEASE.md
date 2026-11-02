# Release — UAT scenarios

Feature `RELEASE` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

These scenarios check the alpha play guide against the running build and record the owner's UI review sign-off. Staging and production steps are not local UAT.

## UAT-RELEASE-1: Exact cleanup and final acceptance

- **Covers:** RELEASE-7.1, RELEASE-7.2, RELEASE-7.3, RELEASE-8.1, RELEASE-8.2
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Review data loaded ([review data](README.md#review-data)) and all four accounts available. The owner signs in as GM. Keep the [alpha play guide](../../guides/alpha-play-guide.md) open beside the app. For each guide statement below, record "matches", "differs" (write what differs) or "can't check" in your results ([recording results](README.md#recording-results)).

**Steps**

1. **GM and P1:** Open the Campaign's session page and choose **Open tabletop window** in the **Live tabletop** panel. Check the guide's "Joining the live table" list: the **GM** or **Player** badge, "Live editing available" for the GM and "Play view" for the player, and the **Auto-roll** switch.
2. **GM:** In a Sandbox Campaign with no presented Scene (Heavy setup: G5; the review Campaigns all have one), check players see "The GM has not presented a scene yet."
3. **P1:** Open **Open live tabletop window** from Aria's Sheet and confirm it reaches the same room.
4. **P1:** Open Settings, Preferences and find **Roll my dice automatically**. With it OFF, check you get a roll prompt with **Roll dice** and a place to type physical faces. Switch it ON and check there is no prompt but reactions still ask.
5. **GM:** In the Campaign's table settings confirm **Assisted** and **Manual** exist. In Assisted, trigger a rule problem and check the warning has **Do it anyway**.
6. **P1:** Drag Aria's token. Check the readout "used / budget ft", the yellow "N ft over" when exceeded, and that the app does not stop you.
7. **P1:** Drag Aria away from the Wolf. Check the **Pending decision** with **Use reaction** and **Decline reaction**, and "Waiting on a movement decision." for other moves.
8. **GM:** Check the turn controls exist: Current turn, Previous turn, Next turn, Undo last action, Complete encounter.
9. **P1:** Attack from the action drawer. Check advantage or disadvantage reasons are shown, and that hidden or unseen targets are refused.
10. **P1:** In **Review: Shield and Hold**, check spell rows read like "Name (Nth level)", rituals show as unavailable, and reaction spells such as Shield appear as prompts.
11. **P2:** In **Review: Fire and Thunder**, cast a spell that catches several creatures and check each creature gets its own save prompt (the GM answers for monsters).
12. **GM:** Check the **Public / Private** switch (**Roll visibility**), the **My rolls** and **Enemy rolls** areas, and the **Show roll** and **Show that I rolled** buttons (each works once).
13. **GM:** Check **Undo last token move** (stage icon) and **Undo last action**. Confirm players have neither.
14. **GM:** Read the guide's contents and check it has a Player section and a GM section that together cover joining a Session, Scenes, tokens and movement, Manual versus Assisted, initiative, the turn stages (Recharge, death saves, start-of-turn effects), attacks, saves, spells and reactions, Public and Private rolls and reveals, the auto-roll preference, and what can and cannot be undone. Record any flow with no section.
15. **P1, P2, P3:** Read the guide's "Known gaps" and mark any item the build contradicts, or any gap you hit that is not listed.
16. **P1:** Follow "Sending feedback" and check every item it asks for (Campaign, Scene, round and turn, mode, what you expected, what happened, repeatable) can be found in the app.
17. **GM (owner):** Send one real piece of feedback using that list, or write down where the list was not enough.
18. **GM (owner):** Check the three review Campaigns exist with members, Scenes with tokens and a started Encounter, as the README describes.
19. **GM (owner):** For each play surface (party, creatures, areas, spells and slots, conditions, Concentration, reactions, initiative, roll cards) record a finding: fine, fix, or register as new work.
20. **GM (owner):** Last of all, after every other UAT file has been recorded (this resets the review data): rebuild the review data once as the README says and check the same Campaigns, members, Scenes and Encounters return.
21. **GM (owner):** Write the sign-off line in the results: "UI review signed off, findings fixed or registered", with the date and your name. If you cannot sign off, list the blocking findings.

**Expected**

- Every statement in the guide matches the build, or the difference is written down so the guide is corrected before alpha invites go out.
- The guide has Player and GM sections covering every flow named in RELEASE-7.1, lists the known gaps, and says how to send feedback.
- The review data reproduces after a rebuild.
- A sign-off line exists, or a list of blocking findings exists; each finding is fixed or registered.

**Other users see**

- **P1, P2, P3:** Where a step names them, they see what the guide says for a player: "Play view", no undo controls, no GM private rolls.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC          | Why not a UAT step                                        |
| ----------- | --------------------------------------------------------- |
| RELEASE-1.1 | Documentation and ADR status text; link and wording audit |
| RELEASE-1.2 | Deployment guides and runbook; document review            |
| RELEASE-1.3 | Link audit script                                         |
| RELEASE-2.1 | Lifecycle run from a fresh isolated deployment; harness   |
| RELEASE-2.2 | Lifecycle on one source state; harness                    |
| RELEASE-2.3 | Rule-corpus and gameplay proof; harness                   |
| RELEASE-5.1 | Release check on deployment configuration                 |
| RELEASE-6.1 | Live-backend test observing typed rejection shape         |

## Not coverable by UAT

| AC          | Gap                    | Reason                                                                  |
| ----------- | ---------------------- | ----------------------------------------------------------------------- |
| RELEASE-3.1 | G4 (staging)           | Staging promotion needs managed credentials and is not a local UAT step |
| RELEASE-3.2 | none (decision record) | A recorded decision, not tester-visible behaviour                       |
| RELEASE-4.1 | none (production)      | Production deployment is not a local UAT step                           |
| RELEASE-4.2 | none (production)      | Production smoke is not a local UAT step                                |
