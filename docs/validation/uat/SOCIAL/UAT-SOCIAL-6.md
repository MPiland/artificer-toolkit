# UAT-SOCIAL-6: Plan limits and capacity

Plan limits and capacity.

Level 5 (Reliability, performance and release) · Feature SOCIAL · Mode: Group (GM, P1, SUPERADMIN) · Path position 187 of 191

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1, P2, P3 and P4 seated as players ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- **SUPERADMIN** is a superadmin account and a member of no Campaign.
- All accounts are on the FREE plan: 1 active hosted Campaign per account, 5 player seats per Campaign, 5 Scenes per Campaign and 6 personal Characters per account.

## Accounts and windows

- **Roles used:** GM, P1, SUPERADMIN
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** Open Settings and Account, and read the plan, limits and current usage (**EntitlementSummary**).
2. [ ] **GM:** Open the same page and compare.
3. [ ] **P1:** Create new homebrew items or Characters until you reach the limit shown for one of them (use the cheapest: a homebrew Feat).
4. [ ] **P1:** Try to create one more beyond the limit.
5. [ ] **P1:** Delete one and create it again, then delete the Feats you made for this scenario.
6. [ ] **GM:** GM already hosts The Campaign, so try to create a second hosted Campaign (the FREE plan allows one). Then try to raise the number of player seats of The Campaign above 5.
7. [ ] **SUPERADMIN:** Downgrade P1's tier and open the Account page.

## Expected

- The Account page shows tier, shared policy limits and counters for homebrew, Characters, hosted Campaigns, seats, listings, storage and Blueprints.
- Step 4 is refused with a message naming the limit and nothing is created.
- Freed capacity can be used again; counters change immediately.
- Step 7: existing items remain but new ones are refused.

## Other users see

- **GM:** sees their own limits, not P1's.

## ACs covered

SOCIAL-3.1, SOCIAL-3.2

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
