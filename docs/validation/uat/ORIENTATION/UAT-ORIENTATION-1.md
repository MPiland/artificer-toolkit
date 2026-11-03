# UAT-ORIENTATION-1: Sign in as each role and find the review Campaigns

Sign in as each role and find the review Campaigns.

Level 0 (Orientation and exploratory tasks) · Feature ORIENTATION · Run order 1 of 188

## Prerequisites

- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- The review data provides the account **SUPERADMIN** (`Review_Admin_Sol`), a superadmin who is a member of no Campaign.
- The review data provides the account **SPARE1** (`Review_Pl_Dara`), a player who is a member of no Campaign and owns no Character.
- The review data provides the account **SPARE2** (`Review_Pl_Eli`), a player who is a member of no Campaign and owns no Character.
- The review data provides a browser at http://localhost:3000, with the review accounts listed in the [README](../README.md#accounts).

## Accounts and windows

- **Accounts:** GM, P1, P2, P3, SUPERADMIN, SPARE1, SPARE2 (one after another)
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **GM:** Open http://localhost:3000, choose sign in, and sign in as `Review_Gm_Rowan` with the review password from [Accounts](../README.md#accounts). Open **Campaigns**.
2. **GM:** Open each of the four review Campaigns in turn: **Review: Party in the Field**, **Review: Shield and Hold**, **Review: Fire and Thunder** and **Review: Sandbox**. On each, find the Party panel, the Live tabletop panel and the Sessions list. Sign out.
3. **P1:** Sign in as `Review_Pl_Aria`. Open **Campaigns** and find the Campaigns you can see. Open **Characters** and find Aria and Ember. Sign out.
4. **P2:** Sign in as `Review_Pl_Bryn`. Open **Campaigns** and **Characters** and find Bryn and Pyra. Sign out.
5. **P3:** Sign in as `Review_Pl_Cade`. Open **Campaigns** and **Characters** and find Cade and Kit. Sign out.
6. **SUPERADMIN:** Sign in as `Review_Admin_Sol`. Find the admin tools in the navigation. Check that you are a member of no Campaign. Sign out.
7. **SPARE1:** Sign in as `Review_Pl_Dara`. Check that **Campaigns** and **Characters** are empty. Sign out.
8. **SPARE2:** Sign in as `Review_Pl_Eli` and check the same. Sign out.
9. **GM:** Write down, in the Notes of the Result block, the Campaigns and Characters you found for each account.

## Expected

- Each of the seven accounts signs in with the review password and signs out again.
- GM sees four Campaigns. P1 sees Review: Party in the Field, Review: Shield and Hold and Review: Sandbox. P2 sees Review: Party in the Field, Review: Fire and Thunder and Review: Sandbox. P3 sees Review: Party in the Field and Review: Sandbox.
- Each player's Characters match the names in step 3 to 5. SUPERADMIN, SPARE1 and SPARE2 are in no Campaign and the spares own no Characters.
- Where what you see differs, the review data is not in the expected state: stop and ask the operator ([Operator setup](../OPERATOR.md#setup)).

## Other users see

- Nothing: this scenario signs in one account at a time.

## ACs covered

none (orientation; no acceptance criterion)

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
