# UAT-SOCIAL-6: Plan limits and capacity

Plan limits and capacity.

Level 5 (Reliability, performance and release) · Feature SOCIAL · Run order 185 of 188

## Prerequisites

- The review data provides the account **SUPERADMIN** (`Review_Admin_Sol`), a superadmin who is a member of no Campaign.
- The review data provides the account **P1** (`Review_Pl_Aria`), who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox.
- The review data provides the account **GM** (`Review_Gm_Rowan`), owner of the four review Campaigns.
- The review data provides the Accounts table in the [README](../README.md#accounts) for the tiers.

## Accounts and windows

- **Accounts:** P1, GM, SUPERADMIN (Review_Admin_Sol)
- **Windows:** One browser profile per account, each signed in as its own account ([how](../README.md#running-several-users-side-by-side)).

## Steps

1. **P1:** Open Settings and Account, and read the plan, limits and current usage (**EntitlementSummary**).
2. **GM:** Open the same page and compare.
3. **P1:** Create new homebrew items or Characters until you reach the limit shown for one of them (use the cheapest: a homebrew Feat).
4. **P1:** Try to create one more beyond the limit.
5. **P1:** Delete one and create it again, then delete the Feats you made for this scenario.
6. **P1:** Try to host a Campaign beyond the hosted-Campaign limit, or add a seat beyond the seat limit, if the free tier has one.
7. **SUPERADMIN:** Downgrade P1's tier and open the Account page.

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
- **Failed step:**
- **Notes:**
