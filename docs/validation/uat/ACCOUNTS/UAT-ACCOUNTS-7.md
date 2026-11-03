# UAT-ACCOUNTS-7: Choose, change and protect a username

Choose, change and protect a username.

Level 1 (Single-user basics) · Feature ACCOUNTS · Run order 13 of 188

## Prerequisites

- The review data provides the account **P3** (`Review_Pl_Cade`), who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** P3, P1
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P3:** Open http://localhost:3000/settings/profile.
2. **P3:** In **Username** type `Review_Pl_Aria` (P1's name). Note the availability message and try to save with **Save profile**.
3. **P3:** Type `review_pl_aria` (different case only) and try again.
4. **P3:** Type `ass_muncher`, then `AssMuncher`, then `Ass1Muncher`, then `assmuncher`; try to save each.
5. **P3:** Type `Cassandra`, then `Classic`, then `Glasshouse`; check the availability message for each without saving.
6. **P3:** Type `Review_Pl_Cade_Two` and choose **Save profile**.
7. **P3:** Reload the page. Sign out and sign in using `Review_Pl_Cade_Two`.
8. **P3:** Change the username to `review_pl_cade` (case change of the original) and save; then change to `Review_Pl_Cade` and save.
9. **P3:** Reload and check the exact capitalisation shown.

## Expected

- Step 2: the name is shown as taken or the save is refused; nothing changes.
- Step 3: also refused as taken (names are not case-sensitive).
- Step 4: all four are refused as not allowed.
- Step 5: all three are acceptable (no "not allowed" message).
- Step 6-7: the new name is saved, survives reload, and works for sign-in.
- Step 8-9: case-only changes are allowed and the display keeps the capitalisation you saved, ending as Review_Pl_Cade.

## Other users see

- **P1:** Still signed in as Review_Pl_Aria throughout; P3's attempts to take that name do not affect P1's account.

## ACs covered

ACCOUNTS-7.1, ACCOUNTS-7.2, ACCOUNTS-7.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
