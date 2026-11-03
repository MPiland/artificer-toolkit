# UAT-SOCIAL-2: Invitations and Social Hub navigation

Invitations and Social Hub navigation.

Level 2 (GM setup) · Feature SOCIAL · Mode: Group (GM, P3) · Path position 58 of 190

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P3**, who owns Cade (in Review: Party in the Field) and is also a member of Review: Sandbox.
- Done in [UAT-SOCIAL-1](UAT-SOCIAL-1.md): "UAT Table" exists with P1 as its only player and is full.

## Accounts and windows

- **Roles used:** GM, P3
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

S1. **GM:** Open the "UAT Table" Settings and raise the number of player seats to 3 so a free seat exists. P3 is not a member.

1. **GM:** Open another player's social profile (for example P3's) and choose to invite them to the Campaign, adding a short message.
2. **P3:** Open **Social**, then **Received invitations**.
3. **P3:** Open the invitation, read it, and **Decline** it.
4. **GM:** Open the sent invitations view and check the invitation's status.
5. **GM:** Send the invitation again; **P3:** accept it.
6. **P3:** Open **Campaigns** and check the new Campaign is listed.

## Expected

- A declined invitation shows as declined to the host and disappears from the invitee's list; a re-invite is allowed.
- Accepting makes the invitee a member immediately.
- Social Hub navigation labels (Hosted listings, My applications, Received invitations, Blocked profiles) each show a list or the matching "No ..." empty text.

## Other users see

- **GM:** sees only the invitation's status, not any private data on P3's profile beyond what P3 made public.

## ACs covered

SOCIAL-1.1

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Set:**
- **Role:**
- **Failed step:**
- **Notes:**
