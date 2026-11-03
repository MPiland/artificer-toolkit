# UAT-BUILDER-7: Build the Characters P2 and P3 will use in the Sandbox Campaign

Build the Characters P2 and P3 will use in the Sandbox Campaign.

Level 1 (Single-user basics) · Feature BUILDER · Run order 39 of 188

## Prerequisites

- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** P2, P3
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P2:** Open http://localhost:3000/characters and choose **Create Character**. Name it "UAT Bryn Sandbox", choose any Race, the Fighter Class and any Background, take the default ability method and equipment, and save the draft.
2. **P2:** Go to the **Review** step, fix anything listed under **Needs attention**, and choose **Activate**.
3. **P3:** Repeat steps 1 and 2 for a Fighter named "UAT Cade Sandbox".
4. **P2 and P3:** Open **Characters** and check the new Character is listed once.

## Expected

- Each Character commits, opens a Sheet with the chosen Class and hit points at maximum, and is listed once.
- Neither Character is in any Campaign yet (the Campaign scenarios assign them).

## Other users see

- **P1:** Nothing of these Characters: private Characters are not visible to other players.

## ACs covered

none (set-up for the GM-setup and play scenarios; no acceptance criterion)

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
