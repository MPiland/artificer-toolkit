# UAT-RELIABILITY-12: Core pages open with their data

Core pages open with their data.

Level 5 (Reliability, performance and release) · Feature RELIABILITY · Run order 180 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides a local backend that has not just been restarted.

## Accounts and windows

- **Accounts:** GM, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **GM:** Open the authoring tools (`/spells`, then a Class or Feature editor). Confirm each opens and lists its data.
2. **P1:** Open Aria's Sheet. Confirm it opens and every tab shows data.
3. **GM:** In **Review: Party in the Field**, open the party inventory and its equipment picker. Confirm the options list.
4. **GM:** Open the live table of the Campaign with the active Encounter. Confirm it opens and the Encounter appears.
5. **GM:** Read the browser console for timeout or limit errors on each page.

## Expected

- Each page opens with its data and no timeout, "limit exceeded" or blank-screen error.

## Other users see

- **P1:** Opens the Sheet and the live table the same way, with the same data.

## ACs covered

RELIABILITY-21.1, RELIABILITY-21.2, RELIABILITY-21.3, RELIABILITY-21.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
