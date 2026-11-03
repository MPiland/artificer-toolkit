# UAT-ACCOUNTS-8: Private profiles stay private; Public profiles show only public fields

Private profiles stay private; Public profiles show only public fields.

Level 1 (Single-user basics) · Feature ACCOUNTS · Run order 14 of 188

## Prerequisites

- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox, whose profile is Private by default.
- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.

## Accounts and windows

- **Accounts:** P1, P2
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** Open http://localhost:3000/settings/profile. Check **Profile visibility** says Private.
2. **P1:** Type a short unique text such as "UAT bio 123" in **Bio**, but do not save yet. Reload the page.
3. **P1:** Type the bio again and choose **Save profile**.
4. **P2:** Open http://localhost:3000/profiles/Review_Pl_Aria.
5. **P1:** Set **Profile visibility** to Public and choose **Save profile**.
6. **P2:** Reload the profile page.
7. **P1:** Set **Profile visibility** back to Private and save.
8. **P2:** Reload the profile page.
9. **P2:** Without reloading, sign out and sign in as P1 in the same browser profile, then open P1's settings.

## Expected

- Step 2: the unsaved bio is lost on reload (it was not saved), and the page does not show anyone else's data.
- Step 4: P2 sees "Profile unavailable" (or similar), no bio and no details.
- Step 6: P2 sees P1's username, avatar and the bio "UAT bio 123", and no email address.
- Step 8: access is gone at once ("Profile unavailable").
- Step 9: after switching accounts in one browser, P1 sees only P1's own bio and username; nothing from P2's session leaks.

## Other users see

- **P2:** See above: nothing while Private, public fields only while Public.
- **GM:** Same as P2 (any signed-in account sees the same).

## ACs covered

ACCOUNTS-8.2, ACCOUNTS-8.3, ACCOUNTS-8.4

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
