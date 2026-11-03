# UAT-ACCOUNTS-3: Two accounts at once stay isolated, and sign-out ends every tab

Two accounts at once stay isolated, and sign-out ends every tab.

Level 1 (Single-user basics) · Feature ACCOUNTS · Mode: Group (GM, P1) · Path position 17 of 188

## Prerequisites

- The review data provides the account **GM**, owner of the four review Campaigns.
- The review data provides the account **P1**, who owns Aria (in Review: Party in the Field) and Ember (in Review: Shield and Hold) and is also a member of Review: Sandbox, who owns Aria and Ember.

## Accounts and windows

- **Roles used:** GM, P1
- **Windows:** Owner-run: one browser profile per role ([Role setup](../README.md#role-setup-for-the-owner)); the owner drives every window and switches role by switching profile, never by signing out.

## Steps

1. **GM:** In profile A, sign in as GM and open `<STAGING_URL>/campaigns`.
2. **P1:** In profile B, sign in as P1 and open `<STAGING_URL>/campaigns`.
3. **P1:** Open `<STAGING_URL>/characters` and note the Characters listed.
4. **GM:** Open `<STAGING_URL>/characters` and note the Characters listed.
5. **P1:** Open a second tab in profile B on `<STAGING_URL>/home`.
6. **P1:** In the second tab, sign out (open /logout).
7. **P1:** Switch to the first tab and click any navigation link (for example Characters).
8. **GM:** Reload your page in profile A.

## Expected

- Step 3 shows Aria and Ember; step 4 shows the GM's own list and none of P1's private Characters.
- Step 7: the first tab ends up on the sign-in page (or shows the signed-out state); it does not stay on a blank page and does not keep showing P1's data.
- Step 8: the GM is still signed in and unaffected.

## Other users see

- **GM:** Signing out P1 does not sign out or change anything for the GM.

## ACs covered

ACCOUNTS-1.1, ACCOUNTS-1.2, ACCOUNTS-5.2, ACCOUNTS-5.3, ACCOUNTS-7.3

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
