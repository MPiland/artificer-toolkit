# UAT-SOCIAL-4: Private profiles and masking

Private profiles and masking.

Level 4 (Advanced play) · Feature SOCIAL · Run order 147 of 188

## Prerequisites

- The review data provides the account **P2** (`Review_Pl_Bryn`), who owns Bryn (in Review: Party in the Field) and Pyra (in Review: Fire and Thunder) and is also a member of Review: Sandbox.
- The review data provides the account **SPARE1** (`Review_Pl_Dara`), a player who is a member of no Campaign and owns no Character.
- Done in [UAT-SOCIAL-1](UAT-SOCIAL-1.md): the "UAT Table" listing exists and P1 has an application.

## Accounts and windows

- **Accounts:** P1, P2, SPARE1 (Review_Pl_Dara)
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** Open Settings and Profile, fill in at least one private field (for example age or safety practices), and set the profile visibility to a private option (**ProfileVisibilitySetting**).
2. **P2:** Open P1's Social profile address.
3. **P2:** Open the "UAT Table" listing from [UAT-SOCIAL-1](UAT-SOCIAL-1.md) and look for P1's application, name and message.
4. **P1:** Set the profile back to public.
5. **P2:** Reload P1's profile.
6. **SPARE1 (signed out):** Without signing in, open P1's profile address and the listing address.
7. **SPARE1:** Sign in and open them again.

## Expected

- Private information (age, safety practices, any field marked private) does not appear to other users or to a signed-out visitor.
- Pages and any shared link show only the public basics.
- Step 3: P2 sees the listing but none of P1's application details.
- Steps 6-7: a signed-out visitor is sent to sign in.

## Other users see

- **P2:** must NOT see fields P1 marked private, in the profile, the listing, or the tab title.
- **SPARE1:** must NOT see profile or listing data until signed in, and then only the public part.

## ACs covered

SOCIAL-1.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failed step:**
- **Notes:**
