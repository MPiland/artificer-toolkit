# UAT tester guide

For a tester running **Solo** scenarios on staging. What UAT is, the levels and what each role sees are on the [Start here page](README.md); the full ordered list is the [tracker](TRACKER.md). The owner prepares staging and your set ([OPERATOR.md](OPERATOR.md)).

## What the owner sends you

The owner sends these privately, outside this repository (for example in a direct message). Nothing here or in any scenario file holds a password.

- The staging address. Scenarios write it as `<STAGING_URL>`.
- Your **set number** and the roles you are assigned (GM, P1, P2, P3 or SPARE).
- The email address or username of each account in your set, and the set's **one password**, shared by its five accounts. Keep it to yourself and never write it in a Result block, a note or a screenshot.
- Before the account-security scenarios, the invitation emails described [below](#create-your-own-account).

Read the [alpha play guide](../../guides/alpha-play-guide.md) before your first scenario.

## Sign in to your prebuilt account

1. Open `<STAGING_URL>`, choose sign in, and enter the account's email or username and the set password. The accounts are already verified, so signing in needs no email.
2. Your set's Campaigns carry `(set N)` in their names, with your set number. You only ever see your own set's accounts and Campaigns.
3. Use one prebuilt account at a time in your normal browser. Never change a prebuilt account's password or email, and never delete it.

Your first scenario is [UAT-ORIENTATION-1](ORIENTATION/UAT-ORIENTATION-1.md): it checks that each account sees what [Roles and what each sees](README.md#roles-and-what-each-sees) lists.

## Create your own account

The account-security scenarios run on **OWN**, an account you create with your own email address. Public sign-up is closed, so it starts from an invitation.

1. Before the session, give the owner your email address and a second address you own (a `+tag` of the same inbox works, for example `you+uat2@example.com`). The owner sends an invitation to each.
2. [UAT-ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md) creates OWN from the first invitation. Every later OWN scenario uses that account.
3. Sign in to OWN in the same browser after signing out of the prebuilt account, or in a second browser profile.

## Reading email

Staging sends real email. Read it in the inbox of the address on the account: your own inbox for OWN. Email to a prebuilt account goes to the owner's mailbox; a step that needs it says so, and the owner reads it for you. The local email sink is an operator fallback only ([Reading local email](OPERATOR.md#reading-local-email)).

For every email a scenario sends, check and record:

- **Arrival:** it arrives within a few minutes. Note the received time.
- **Branding:** it shows the product name and branding, and the sender and subject make sense.
- **Links:** every link and button opens the right page on `<STAGING_URL>`; a code in the email works where the scenario uses it.
- **Spam:** it is in the inbox, not in spam or junk. If it is in spam, the step fails; write down which folder it landed in.

## Run order

Run your Solo scenarios once, in [tracker](TRACKER.md) order, level by level. The fixed points:

1. [UAT-ORIENTATION-1](ORIENTATION/UAT-ORIENTATION-1.md) first, then the exploratory tasks [EXPLORATORY-1](EXPLORATORY/EXPLORATORY-1.md) to [EXPLORATORY-7](EXPLORATORY/EXPLORATORY-7.md). They need a facilitator; open no scenario file for them before you start.
2. Level 1 opens with the prebuilt-account sign-in checks [UAT-ACCOUNTS-1](ACCOUNTS/UAT-ACCOUNTS-1.md), [UAT-ACCOUNTS-2](ACCOUNTS/UAT-ACCOUNTS-2.md) and [UAT-ACCOUNTS-4](ACCOUNTS/UAT-ACCOUNTS-4.md).
3. The OWN chain, in this order: [UAT-ACCOUNTS-6](ACCOUNTS/UAT-ACCOUNTS-6.md) (create OWN), [UAT-ACCOUNTS-5](ACCOUNTS/UAT-ACCOUNTS-5.md) (forgotten password), [UAT-ACCOUNTS-14](ACCOUNTS/UAT-ACCOUNTS-14.md) (change password), [UAT-ACCOUNTS-15](ACCOUNTS/UAT-ACCOUNTS-15.md) (change email), [UAT-ACCOUNTS-7](ACCOUNTS/UAT-ACCOUNTS-7.md) (username).
4. The rest of Level 1 in tracker order, from [UAT-ACCOUNTS-13](ACCOUNTS/UAT-ACCOUNTS-13.md) to [UAT-SHEET-10](SHEET/UAT-SHEET-10.md).
5. Level 2 starts with [UAT-CAMPAIGN-1](CAMPAIGN/UAT-CAMPAIGN-1.md). [UAT-SCENE-1](SCENE/UAT-SCENE-1.md), [UAT-SCENE-2](SCENE/UAT-SCENE-2.md) and [UAT-RELIABILITY-4](RELIABILITY/UAT-RELIABILITY-4.md) wait until the owner has run session G2 on your set; the owner tells you when.
6. Level 3: [UAT-SHEET-5](SHEET/UAT-SHEET-5.md), [UAT-AUTHORING-6](AUTHORING/UAT-AUTHORING-6.md), [UAT-RELIABILITY-8](RELIABILITY/UAT-RELIABILITY-8.md).
7. Last of all, [UAT-ACCOUNTS-12](ACCOUNTS/UAT-ACCOUNTS-12.md) deletes OWN. Run nothing on OWN after it.

Each scenario's **Prerequisites** say what must come first. If one is missing, mark the scenario BLOCKED and move on. A scenario that changes shared state ends with restore steps (R1, R2 …); run them even when the scenario failed ([One pass](README.md#one-pass)).

## Recording results

- Fill in the **Result** block at the end of the scenario's file: **Status** (NOT RUN, PASSED, FAILED, BLOCKED or SKIPPED), **Date**, **Build**, **Tester** (your name), **Set** (your set number), **Role** (the role you played, for example P1 or OWN), **Failed step** and **Notes**. The scenario ID is the file name, so every note stays tied to its context.
- Then tick the scenario in the [tracker](TRACKER.md) and set the same status there.
- **PASSED** means every Expected line held and the owner has run its "Other users see" or "Cross-role check" lines. Take at least one screenshot per scenario of its final state, named with the scenario ID and your set number; for Group scenarios, one per role window.
- A behaviour listed in the play guide's [known gaps](../../guides/alpha-play-guide.md#known-gaps) is not a failure; note it only if it hurt the session.
- When the owner accepts a feature, the orchestrator sets each of its ledger `uat` items to PASSED with the tracker as evidence.

### When a scenario fails

The Result block names the date, the build (commit or staging build name), the tester, the set, the role and the step number, and gives the details the [play guide's feedback list](../../guides/alpha-play-guide.md#sending-feedback) asks for: Campaign, Scene, round and turn, mode and auto-roll, expected, actual with the exact wording of any message, and whether it repeats. For an email failure, add the email checks above. Every failure is fixed or registered in the ledger before the feature is accepted.
