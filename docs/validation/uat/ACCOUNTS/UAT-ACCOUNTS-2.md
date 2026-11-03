# UAT-ACCOUNTS-2: Wrong password and unknown account are refused

Wrong password and unknown account are refused.

Level 1 (Single-user basics) · Feature ACCOUNTS · Run order 10 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox; you are signed out.

## Accounts and windows

- **Accounts:** P1
- **Windows:** One browser window signed in as the account above.

## Steps

1. **P1:** Open http://localhost:3000/sign-in.
2. **P1:** Enter `review_pl_aria@example.invalid` and a wrong password; submit.
3. **P1:** Enter an unknown username `nobody_here_uat` and any password; submit.
4. **P1:** Submit with both fields empty.
5. **P1:** Sign in correctly.

## Expected

- Steps 2 and 3 show the same message: "Check your email or username and password, then try again." You stay signed out and on the sign-in page.
- Step 4 shows a field-level prompt instead of signing in.
- Step 5 succeeds.

## Other users see

- Not applicable: single user.

## ACs covered

ACCOUNTS-5.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
