# Accounts — UAT scenarios

Feature `ACCOUNTS` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves a GM and players can sign in and out safely, that two people on one machine never see each other's account, that strangers cannot sign up or read private profiles, and that usernames and account deletion follow the rules. Accounts here: see [README](README.md#accounts).

## UAT-ACCOUNTS-1: Sign in, reload, sign out, sign back in by username

- **Covers:** ACCOUNTS-1.1, ACCOUNTS-1.2, ACCOUNTS-5.1
- **Accounts:** P1
- **Preconditions:** Review data built; signed out.

**Steps**

1. **P1:** Open http://localhost:3000/characters while signed out.
2. **P1:** Note that you land on the sign-in page.
3. **P1:** In **Email or username** type `review_pl_aria@example.invalid`, enter the review password in **Password**, and sign in.
4. **P1:** Confirm you arrive on the Characters page you originally asked for.
5. **P1:** Reload the page (F5).
6. **P1:** Open http://localhost:3000/logout (or use the account menu's sign-out control).
7. **P1:** After the "Signing you out" page, open http://localhost:3000/characters again.
8. **P1:** Sign in again, this time typing the username `Review_Pl_Aria` in **Email or username**.
9. **P1:** Open http://localhost:3000/settings/profile and check the **Username** field.

**Expected**

- Step 2: the signed-out visit redirects to sign-in rather than showing Characters.
- Step 4: after signing in you are returned to the Characters page, not to a generic home.
- Step 5: still signed in and the page renders fully (no blank screen).
- Step 7: signed out again; the protected page redirects to sign-in.
- Step 8-9: username sign-in works and the profile shows Review_Pl_Aria.

**Other users see**

- Not applicable: single user.

## UAT-ACCOUNTS-2: Wrong password and unknown account are refused

- **Covers:** ACCOUNTS-5.1
- **Accounts:** P1
- **Preconditions:** Signed out.

**Steps**

1. **P1:** Open http://localhost:3000/sign-in.
2. **P1:** Enter `review_pl_aria@example.invalid` and a wrong password; submit.
3. **P1:** Enter an unknown username `nobody_here_uat` and any password; submit.
4. **P1:** Submit with both fields empty.
5. **P1:** Sign in correctly.

**Expected**

- Steps 2 and 3 show the same message: "Check your email or username and password, then try again." You stay signed out and on the sign-in page.
- Step 4 shows a field-level prompt instead of signing in.
- Step 5 succeeds.

**Other users see**

- Not applicable: single user.

## UAT-ACCOUNTS-3: Two accounts at once stay isolated, and sign-out ends every tab

- **Covers:** ACCOUNTS-1.1, ACCOUNTS-1.2, ACCOUNTS-5.2, ACCOUNTS-5.3, ACCOUNTS-7.3
- **Accounts:** GM, P1
- **Preconditions:** Review data built. Two browser profiles ([README](README.md#running-several-users-side-by-side)).

**Steps**

1. **GM:** In profile A, sign in as GM and open http://localhost:3000/campaigns.
2. **P1:** In profile B, sign in as P1 and open http://localhost:3000/campaigns.
3. **P1:** Open http://localhost:3000/characters and note the Characters listed.
4. **GM:** Open http://localhost:3000/characters and note the Characters listed.
5. **P1:** Open a second tab in profile B on http://localhost:3000/home.
6. **P1:** In the second tab, sign out (open /logout).
7. **P1:** Switch to the first tab and click any navigation link (for example Characters).
8. **GM:** Reload your page in profile A.

**Expected**

- Step 3 shows Aria and Ember; step 4 shows the GM's own list and none of P1's private Characters.
- Step 7: the first tab ends up on the sign-in page (or shows the signed-out state); it does not stay on a blank page and does not keep showing P1's data.
- Step 8: the GM is still signed in and unaffected.

**Other users see**

- **GM:** Signing out P1 does not sign out or change anything for the GM.

## UAT-ACCOUNTS-4: Public sign-up is closed

- **Covers:** ACCOUNTS-2.1, ACCOUNTS-2.2
- **Accounts:** none (signed out)
- **Preconditions:** Signed out.

**Steps**

1. Open http://localhost:3000/sign-up.
2. Read the page title and message.
3. Look for any form that lets you choose a username and password.
4. Try to fill and submit it if one is present.

**Expected**

- The page says **Access is currently invite-only** (or equivalent) and offers no way to create an account without an invitation.
- If a form is present, submitting it creates no account and shows a refusal; signing in with the new details fails.

**Other users see**

- Not applicable: single user.

## UAT-ACCOUNTS-5: Reset a forgotten password (wrong code, mismatch, then success)

- **Covers:** ACCOUNTS-6.1, ACCOUNTS-6.2, ACCOUNTS-6.3
- **Accounts:** P3
- **Preconditions:** The six-digit code arrives by email; read it as [Reading local email](README.md#reading-local-email) describes. Step 10 restores the review password.

**Steps**

1. **P3:** Open http://localhost:3000/sign-in and go to **Reset your password**.
2. **P3:** Enter `review_pl_cade@example.invalid` and submit to reach **Verify your reset code**.
3. **P3:** Enter a wrong six-digit code such as 000000 and submit.
4. **P3:** Request a new code from the same page (resend) a few times in a row.
5. **P3:** Reload the page and look at the address bar.
6. **P3:** Before the reset, keep a second tab open and signed in as P3. Then enter the real code from the newest reset email to `review_pl_cade@example.invalid`.
7. **P3:** On **Update password**, type different values in **New password** and **Confirm password**; submit.
8. **P3:** Type the same new password in both fields; submit.
9. **P3:** Try to sign in with the old password, and reload the second tab.
10. **P3:** Sign in with the new password. Try the code from step 6 again. Then reset the password back to the review password the same way.
11. **GM:** Meanwhile, with the GM signed in on another profile, confirm the GM can still use the app.

**Expected**

- Step 3: "That verification code is invalid or has expired."
- Step 4: resends work a limited number of times, then are refused with a message; no crash.
- Step 5: the address bar carries no code or secret and the page still works after reload.
- Step 7: "Enter the same password in both fields." and nothing changes.
- Step 8: the password changes; you can sign in with it.
- Step 9: the old password is refused, and the second tab signed in as P3 before the reset is signed out after reload.
- Step 10: new password signs in; the code from step 6 is refused as invalid or already used.

**Other users see**

- **GM:** Unaffected.

## UAT-ACCOUNTS-6: Create an account from an invitation

- **Covers:** ACCOUNTS-3.1, ACCOUNTS-3.2, ACCOUNTS-3.3, ACCOUNTS-4.2
- **Accounts:** OUTSIDER (gap G3)
- **Preconditions:** Blocked until gap G3 is fixed: public sign-up is closed and invitations are issued only by the internal `authInvitations:issue` function, not from the app.

**Steps**

1. **OUTSIDER:** Open the invitation link from the invitation email.
2. **OUTSIDER:** On **Complete registration**, enter a username and a password and submit.
3. **OUTSIDER:** Open the email-confirmation link that arrives; you should land on the email-confirmed page.
4. **OUTSIDER:** Sign in with the new email, then sign out and sign in with the new username.
5. **OUTSIDER:** Open the same invitation link again.
6. **OUTSIDER:** Open an invitation link whose code you have altered by one character.
7. **OUTSIDER:** Open a second invitation addressed to a different email, and try to register with the first person's email address.
8. **OUTSIDER:** Try to register with a username that is already taken (for example Review_Pl_Aria).

**Expected**

- Step 2: the account is created and is an ordinary account (not an admin); a confirmation email is sent.
- Step 3: the confirmation page appears and the account becomes verified.
- Step 4: both logins work.
- Steps 5-7: **This invitation link is unavailable** with a hint that it may have expired or already been used; no second account is created.
- Step 8: the username is refused as taken and the invitation is still usable afterwards (the failed attempt did not use it up).

**Other users see**

- Not applicable: single user.

## UAT-ACCOUNTS-7: Choose, change and protect a username

- **Covers:** ACCOUNTS-7.1, ACCOUNTS-7.2, ACCOUNTS-7.4
- **Accounts:** P3, P1
- **Preconditions:** Review data built. Plan to rename P3 back to Review_Pl_Cade at the end.

**Steps**

1. **P3:** Open http://localhost:3000/settings/profile.
2. **P3:** In **Username** type `Review_Pl_Aria` (P1's name). Note the availability message and try to save with **Save profile**.
3. **P3:** Type `review_pl_aria` (different case only) and try again.
4. **P3:** Type `ass_muncher`, then `AssMuncher`, then `Ass1Muncher`, then `assmuncher`; try to save each.
5. **P3:** Type `Cassandra`, then `Classic`, then `Glasshouse`; check the availability message for each without saving.
6. **P3:** Type `Review_Pl_Cade_Two` and choose **Save profile**.
7. **P3:** Reload the page. Sign out and sign in using `Review_Pl_Cade_Two`.
8. **P3:** Change the username to `review_pl_cade` (case change of the original) and save; then change to `Review_Pl_Cade` and save.
9. **P3:** Reload and check the exact capitalisation shown.

**Expected**

- Step 2: the name is shown as taken or the save is refused; nothing changes.
- Step 3: also refused as taken (names are not case-sensitive).
- Step 4: all four are refused as not allowed.
- Step 5: all three are acceptable (no "not allowed" message).
- Step 6-7: the new name is saved, survives reload, and works for sign-in.
- Step 8-9: case-only changes are allowed and the display keeps the capitalisation you saved, ending as Review_Pl_Cade.

**Other users see**

- **P1:** Still signed in as Review_Pl_Aria throughout; P3's attempts to take that name do not affect P1's account.

## UAT-ACCOUNTS-8: Private profiles stay private; Public profiles show only public fields

- **Covers:** ACCOUNTS-8.2, ACCOUNTS-8.3, ACCOUNTS-8.4
- **Accounts:** P1, P2
- **Preconditions:** Review data built; two browser profiles. P1's profile is Private by default.

**Steps**

1. **P1:** Open http://localhost:3000/settings/profile. Check **Profile visibility** says Private.
2. **P1:** Type a short unique text such as "UAT bio 123" in **Bio**, but do not save yet. Reload the page.
3. **P1:** Type the bio again and choose **Save profile**.
4. **P2:** Open http://localhost:3000/profiles/Review_Pl_Aria.
5. **P1:** Set **Profile visibility** to Public and choose **Save profile**.
6. **P2:** Reload the profile page.
7. **P1:** Set **Profile visibility** back to Private and save.
8. **P2:** Reload the profile page.
9. **P2:** Without reloading, sign out and sign in as P1 in the same browser profile, then open P1's settings.

**Expected**

- Step 2: the unsaved bio is lost on reload (it was not saved), and the page does not show anyone else's data.
- Step 4: P2 sees "Profile unavailable" (or similar), no bio and no details.
- Step 6: P2 sees P1's username, avatar and the bio "UAT bio 123", and no email address.
- Step 8: access is gone at once ("Profile unavailable").
- Step 9: after switching accounts in one browser, P1 sees only P1's own bio and username; nothing from P2's session leaks.

**Other users see**

- **P2:** See above: nothing while Private, public fields only while Public.
- **GM:** Same as P2 (any signed-in account sees the same).

## UAT-ACCOUNTS-9: Ordinary users cannot use superadmin tools

- **Covers:** ACCOUNTS-9.2, ACCOUNTS-9.4
- **Accounts:** GM, P1
- **Preconditions:** Review data built.

**Steps**

1. **GM:** Open http://localhost:3000/social/moderation.
2. **P1:** Open http://localhost:3000/social/moderation.
3. **GM:** Open http://localhost:3000/social and look for any moderation entry in the navigation.

**Expected**

- Steps 1 and 2: access is refused (a denied, not-found or redirect result); no moderation list or review actions are shown, even though the GM owns Campaigns and has a higher plan.
- Step 3: no moderation link is offered to the GM.

**Other users see**

- Not applicable: both are refused independently.

## UAT-ACCOUNTS-10: Superadmin moderation (blocked)

- **Covers:** ACCOUNTS-9.2, ACCOUNTS-9.4
- **Accounts:** SUPERADMIN (gap G2)
- **Preconditions:** Blocked until gap G2 is fixed: there is no superadmin account in the review data.

**Steps**

1. **SUPERADMIN:** Sign in and open http://localhost:3000/social/moderation.
2. **SUPERADMIN:** Read the list of items waiting for review.
3. **GM:** Create or report a Social listing so there is something to moderate, if the list is empty.
4. **SUPERADMIN:** Open an item and record a review decision.
5. **SUPERADMIN:** Reload the page.
6. **P1:** Sign in and check the affected listing.

**Expected**

- The moderation list loads for the superadmin and only for them.
- Opening and reviewing an item works and the decision persists after reload.
- The ordinary account sees the effect of the decision on the listing but never the moderation tools.

**Other users see**

- **P1:** Sees the listing outcome only; no moderation controls.

## UAT-ACCOUNTS-11: Refused account deletions

- **Covers:** ACCOUNTS-10.1
- **Accounts:** GM, SPARE (gap G3)
- **Preconditions:** Review data built. Steps 1-4 (GM, wrong password only) can be run now. Steps 5-8 (correct password while owning an active Campaign) are blocked until gap G3 is fixed: they need a spare account that owns a throwaway Campaign. Never enter the GM's correct password in the **Delete account** dialog: a deletion that succeeds would destroy the review data ([README](README.md#review-data)).

**Steps**

1. **GM:** Open http://localhost:3000/settings/account.
2. **GM:** Choose **Delete account** (the dialog opens).
3. **GM:** Read the dialog, type the account email as asked ("Type ... to confirm"), and enter a deliberately wrong password; confirm. Do not enter the real password.
4. **GM:** Close the dialog, reload the page and open http://localhost:3000/campaigns.
5. **SPARE:** (blocked: G3) Sign in, create a throwaway Campaign at http://localhost:3000/campaigns/new, then open http://localhost:3000/settings/account and choose **Delete account**.
6. **SPARE:** (blocked: G3) Type the account email, enter the correct password and confirm. The SPARE owns an active Campaign.
7. **SPARE:** (blocked: G3) Reload the page and open http://localhost:3000/campaigns.
8. **SPARE:** (blocked: G3) Archive the throwaway Campaign, repeat steps 5-6, and confirm the refusal still applies to an Archived Campaign. Then delete the Campaign.

**Expected**

- Step 3: refused ("Could not delete your account. Try again." or a wrong-password message); nothing is deleted.
- Step 4: still signed in; the three review Campaigns are intact.
- Step 6: refused because the SPARE owns an active Campaign; the message names the reason (hand over, archive or delete the Campaign first); no data is removed.
- Step 7: still signed in; the throwaway Campaign is listed.
- Step 8: the refusal also applies while the Campaign is Archived. Deleting the account itself is left to UAT-ACCOUNTS-12.

**Other users see**

- **P1:** Nothing changes; the Campaigns still list the GM.

## UAT-ACCOUNTS-12: Delete my account, shared history survives (blocked)

- **Covers:** ACCOUNTS-10.2, ACCOUNTS-10.3, ACCOUNTS-10.4, ACCOUNTS-10.5
- **Accounts:** OUTSIDER (gap G3), GM
- **Preconditions:** Blocked until gap G3 is fixed: a disposable spare account is needed (never delete a review account: it would destroy the review data). The OUTSIDER must be a member of a Campaign the GM owns, with chat and a played Encounter, and must own a private Character and a homebrew Spell. The GM adds the OUTSIDER to a new throwaway Campaign (Heavy setup: G5), not to a review Campaign.

**Steps**

1. **OUTSIDER:** Open the live tabletop of the shared Campaign and post a chat message and make one roll.
2. **OUTSIDER:** Note the Characters and homebrew you own.
3. **OUTSIDER:** Open http://localhost:3000/settings/account and choose **Delete account**.
4. **OUTSIDER:** Type the account email and the password; confirm.
5. **OUTSIDER:** Try to sign in again.
6. **GM:** Reload the tabletop and read the chat, roll history and Session log.
7. **GM:** Open the Encounter history and the member list.
8. **GM:** Reload the tabletop after a minute.

**Expected**

- Step 4: the account is deleted and every other tab is signed out.
- Step 5: sign-in fails for that account.
- Step 6: the earlier chat and roll remain, attributed to **Deleted user**.
- Step 7: the Encounter history and any finished Run remain; the deleted player's Character is gone from the member list and from the live table (its token is removed).
- Step 8: still gone and nothing reappears; the player's private Characters and homebrew no longer exist for anyone.

**Other users see**

- **GM:** See Steps 6-8. Any other member of the throwaway Campaign sees the deleted player's lines as **Deleted user** and no profile.

## UAT-ACCOUNTS-13: Campaign text follows the same language rules as usernames

- **Covers:** ACCOUNTS-7.5
- **Accounts:** GM
- **Preconditions:** Review data built.

**Steps**

1. **GM:** Open http://localhost:3000/campaigns/new.
2. **GM:** In **Campaign name** type `ass_muncher` and try to continue or save.
3. **GM:** Replace it with `Cassandra's Classic Table` and try to continue or save, but do not finish creating the Campaign (leave the page).
4. **GM:** Open any existing Campaign's notes and try to save a note containing `AssMuncher`, then remove the text.

**Expected**

- Step 2: refused with a visible message about the text; no Campaign is created.
- Step 3: accepted as ordinary text (ordinary names containing "ass" inside words are not refused).
- Step 4: the blocked note text is refused and the note is not saved with it.

**Other users see**

- Not applicable: single user.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC           | Why not a UAT step                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACCOUNTS-1.3 | Absence of legacy tRPC/Supabase requests and exact test-account cleanup; needs request inspection, run by the browser journey.                    |
| ACCOUNTS-1.4 | Typing before hydration completes; needs a blocked-hydration test hook, run by the browser journey. A tester cannot pause hydration.              |
| ACCOUNTS-4.1 | Invitations are issued only by the internal CLI with hashed tokens; there is no UI to see. Redemption is covered by UAT-ACCOUNTS-6 (blocked: G3). |
| ACCOUNTS-4.3 | Deployed HTTP origin and foreign-origin denial; a network-level test against a deployment.                                                        |
| ACCOUNTS-4.4 | Concurrent invitation redemption on personal dev; a harness run.                                                                                  |
| ACCOUNTS-8.1 | Native-client request authorization and spoofed user IDs; contract test (the browser-visible part is UAT-ACCOUNTS-8).                             |
| ACCOUNTS-9.1 | Role provisioning is the internal CLI only; there is no UI.                                                                                       |
| ACCOUNTS-9.3 | Provider-admin endpoints answer 404 to POST requests; a browser address bar sends GET, so a tester cannot exercise them.                          |
