# UAT-SOCIAL-2: Invitations and Social Hub navigation

Invitations and Social Hub navigation.

Level 2 (GM setup) · Feature SOCIAL · Mode: Group (P3, P5) · Path position 52 of 195

## Prerequisites

- **P3** hosts "P3's Campaign" (see [UAT-SOCIAL-1](UAT-SOCIAL-1.md): P1 is its only player and it is full).
- **P5** has an account and is a member of no Campaign.

## Accounts and windows

- **Roles used:** P3, P5
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **P3:** Open the Settings of P3's Campaign and raise the number of player seats to 3 so a free seat exists. P5 is not a member.

1. [ ] **P3:** Open another player's social profile (P5's) and choose to invite them to the Campaign, adding a short message.
2. [ ] **P5:** Open **Social**, then **Received invitations**.
3. [ ] **P5:** Open the invitation, read it, and **Decline** it.
4. [ ] **P3:** Open the sent invitations view and check the invitation's status.
5. [ ] **P3:** Send the invitation again; **P5:** accept it.
6. [ ] **P5:** Open **Campaigns** and check the new Campaign is listed.

## Expected

- A declined invitation shows as declined to the host and disappears from the invitee's list; a re-invite is allowed.
- Accepting makes the invitee a member immediately.
- Social Hub navigation labels (Hosted listings, My applications, Received invitations, Blocked profiles) each show a list or the matching "No ..." empty text.

## Other users see

- **P3 (host):** sees only the invitation's status, not any private data on P5's profile beyond what P5 made public.

## ACs covered

SOCIAL-1.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
