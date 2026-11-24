# UAT-ACCOUNTS-8: Private profiles stay private; Public profiles show only public fields

Private profiles stay private; Public profiles show only public fields.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Group (GM, P1, P2) · Path position 11 of 191

## Prerequisites

- **P1** has an account whose profile is Private (the default).
- **P2** and **GM** each have an account and are signed in on their own devices.

## Accounts and windows

- **Roles used:** GM, P1, P2
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open `<STAGING_URL>/settings/profile`. Check **Profile visibility** says Private.
2. [ ] **P1:** Type a short unique text such as "UAT bio 123" in **Bio**, but do not save yet. Reload the page.
3. [ ] **P1:** Type the bio again and choose **Save profile**.
4. [ ] **P2:** Open P1's profile page at `<STAGING_URL>/profiles/P1`.
5. [ ] **P1:** Set **Profile visibility** to Public and choose **Save profile**.
6. [ ] **P2 and GM:** Reload (or open) P1's profile page.
7. [ ] **P1:** Set **Profile visibility** back to Private and save.
8. [ ] **P2 and GM:** Reload P1's profile page.

## Expected

- Step 2: the unsaved bio is lost on reload (it was not saved), and the page does not show anyone else's data.
- Step 4: P2 sees "Profile unavailable" (or similar), no bio and no details.
- Step 6: P2 and the GM see P1's username, avatar and the bio "UAT bio 123", and no email address.
- Step 8: access is gone at once ("Profile unavailable").

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
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
