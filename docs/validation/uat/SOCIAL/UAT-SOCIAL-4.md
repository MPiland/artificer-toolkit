# UAT-SOCIAL-4: Private profiles and masking

Private profiles and masking.

Level 4 (Advanced play) · Feature SOCIAL · Mode: Group (P1, P2, P5) · Path position 152 of 191

## Prerequisites

- **P3** hosts "P3's Campaign" with a listing and **P1** has an application to it (done in [UAT-SOCIAL-1](UAT-SOCIAL-1.md)).
- **P2** has an account and is a member of The Campaign.
- **P5** has an account and is a member of no Campaign.

## Accounts and windows

- **Roles used:** P1, P2, P5
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open Settings and Profile, fill in at least one private field (for example age or safety practices), and set the profile visibility to a private option (**ProfileVisibilitySetting**).
2. [ ] **P2:** Open P1's Social profile address.
3. [ ] **P2:** Open the listing of P3's Campaign from [UAT-SOCIAL-1](UAT-SOCIAL-1.md) and look for P1's application, name and message.
4. [ ] **P1:** Set the profile back to public.
5. [ ] **P2:** Reload P1's profile.
6. [ ] **P5 (in a private window, not signed in):** Without signing in, open P1's profile address and the listing address.
7. [ ] **P5:** Sign in to your own account in that window and open them again.

## Expected

- Private information (age, safety practices, any field marked private) does not appear to other users or to a signed-out visitor.
- Pages and any shared link show only the public basics.
- Step 3: P2 sees the listing but none of P1's application details.
- Steps 6-7: a signed-out visitor is sent to sign in.

## Other users see

- **P2:** must NOT see fields P1 marked private, in the profile, the listing, or the tab title.
- **P5:** must NOT see profile or listing data until signed in, and then only the public part.

## ACs covered

SOCIAL-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
