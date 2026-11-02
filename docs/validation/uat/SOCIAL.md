# Social and notifications — UAT scenarios

Feature `SOCIAL` in the [phase ledger](../../roadmap/08-phase-ledger.json). Set up first: [README](README.md#setup).

Proves players can find a table, apply, be accepted or refused, block and be blocked, receive notifications they chose, and that plan limits stop over-use without destroying data. Accounts: [README](README.md#accounts). Several windows: [README](README.md#running-several-users-side-by-side). Record results: [README](README.md#recording-results). Email is not readable on this build (gap G1, see [README](README.md#known-uat-gaps)).

## UAT-SOCIAL-1: Create a listing, apply, accept and fill a table

- **Covers:** SOCIAL-1.1
- **Accounts:** GM, P1, P2, P3
- **Preconditions:** Review data loaded. The GM makes a new Campaign "UAT Table" with room for exactly one player seat (not a review Campaign: P1 joins it in step 6). P3 is a member of no UAT Table seat; P1, P2 and P3 have no application to it yet.

**Steps**

1. **GM:** Open **Social** and choose to host a new listing. Fill in the table details (title, **Game style**, **Tone**, **Table needs**, **Content guidance**) and publish it with one open seat.
2. **P1:** Open **Social** and find the GM's listing (use **Show results** after setting filters if offered). Open it.
3. **P1:** Choose **Apply to join**, type a **Message to the host**, and submit.
4. **P2:** Do the same for the same listing.
5. **P1:** Open **My applications** and check the status of your application.
6. **GM:** Open the hosted listing's applications. Accept P1.
7. **GM:** Try to accept P2 while the table is full.
8. **P2:** Reload **My applications**.
9. **P3:** Open the listing and try to apply.
10. **P1:** Withdraw your own application from **My applications** if still open, otherwise open the Campaign.
11. **GM:** Reload the hosted listing's applications.

**Expected**

- The listing shows in search; the application shows as pending (SUBMITTED) for the applicant and in the host's list.
- Accepting P1 makes P1 a member of the Campaign (visible under **Campaigns** for P1).
- Step 7 is refused with a full-table message because the seat is taken (**Table full**).
- P3 sees **Table full** and cannot apply.
- Withdrawn or declined applications show their final status and the host's list reflects it.

**Other users see**

- **P2:** sees the final decision on their application only. Must NOT see P1's message or details about P1's application.
- **P3:** must NOT see anyone's applications or messages.

## UAT-SOCIAL-2: Invitations and Social Hub navigation

- **Covers:** SOCIAL-1.1
- **Accounts:** GM, P3
- **Preconditions:** A GM-owned Campaign with a free seat that P3 is not in. "UAT Table" from UAT-SOCIAL-1 is full after P1 joins, so either raise its seat count first or use the sandbox Campaign from UAT-CAMPAIGN-2. Do not use a review Campaign.

**Steps**

1. **GM:** Open another player's social profile (for example P3's) and choose to invite them to the Campaign, adding a short message.
2. **P3:** Open **Social**, then **Received invitations**.
3. **P3:** Open the invitation, read it, and **Decline** it.
4. **GM:** Open the sent invitations view and check the invitation's status.
5. **GM:** Send the invitation again; **P3:** accept it.
6. **P3:** Open **Campaigns** and check the new Campaign is listed.

**Expected**

- A declined invitation shows as declined to the host and disappears from the invitee's list; a re-invite is allowed.
- Accepting makes the invitee a member immediately.
- Social Hub navigation labels (Hosted listings, My applications, Received invitations, Blocked profiles) each show a list or the matching "No ..." empty text.

**Other users see**

- **GM:** sees only the invitation's status, not any private data on P3's profile beyond what P3 made public.

## UAT-SOCIAL-3: Blocks and what they do

- **Covers:** SOCIAL-1.5
- **Accounts:** GM, P1, P2, SUPERADMIN (gap G2, step 8 only)
- **Preconditions:** P1 and P2 are members of Review: Party in the Field. Their membership must still be there after the block. Steps 1-7 are runnable now; step 8 (the moderation half of SOCIAL-1.5) is blocked: G2.

**Steps**

1. **P1:** Open P2's Social Hub profile and choose **Block**; confirm.
2. **P1:** Open the **Blocked profiles** panel and check P2 is listed.
3. **P2:** Try to open P1's Social profile.
4. **P2:** Try to invite P1 to a Campaign P2 owns, if P2 owns one; P1 hosts no table, so record the apply check as not applicable.
5. **P1 and P2:** Open Review: Party in the Field and its Campaign chat; each posts one line in the Table conversation.
6. **P1:** In **Blocked profiles**, choose **Unblock** next to P2.
7. **P2:** Reload P1's profile.
8. **SUPERADMIN (blocked: G2):** Moderate P2 (suspend or restrict the profile) and check P1 and P2 stay members of Review: Party in the Field; then reverse the moderation.

**Expected**

- The block succeeds with a message; the Blocked profiles panel lists P2, and **Unblock** reverses it.
- While blocked, P2 sees an "unavailable" profile for P1 and cannot invite or apply to P1.
- Both players remain members of Review: Party in the Field and can still chat and play together: a block never removes accepted membership.
- After unblocking, profile and invitation actions work again.
- Step 8 (blocked: G2): moderation leaves accepted membership in place, as a block does.

**Other users see**

- **P2:** must NOT see that P1 blocked them beyond the "unavailable" or refusal message.
- **GM:** sees both players still in the Party at every step.

## UAT-SOCIAL-4: Private profiles and masking

- **Covers:** SOCIAL-1.2
- **Accounts:** P1, P2, OUTSIDER (gap G3)
- **Preconditions:** Steps 1-5 run now with P2. Steps 6-7 are (blocked: G3). Run after UAT-SOCIAL-1 so the "UAT Table" listing and P1's application exist.

**Steps**

1. **P1:** Open Settings and Profile, fill in at least one private field (for example age or safety practices), and set the profile visibility to a private option (**ProfileVisibilitySetting**).
2. **P2:** Open P1's Social profile address.
3. **P2:** Open the "UAT Table" listing from UAT-SOCIAL-1 and look for P1's application, name and message.
4. **P1:** Set the profile back to public.
5. **P2:** Reload P1's profile.
6. **OUTSIDER (blocked: G3):** Without signing in, open P1's profile address and the listing address.
7. **OUTSIDER (blocked: G3):** Sign in and open them again.

**Expected**

- Private information (age, safety practices, any field marked private) does not appear to other users or to a signed-out visitor.
- Pages and any shared link show only the public basics.
- Step 3: P2 sees the listing but none of P1's application details.
- Steps 6-7 (blocked: G3): a signed-out visitor is sent to sign in.

**Other users see**

- **P2:** must NOT see fields P1 marked private, in the profile, the listing, or the tab title.
- **OUTSIDER (blocked: G3):** must NOT see profile or listing data until signed in, and then only the public part.

## UAT-SOCIAL-5: Notification feed, read state and preferences

- **Covers:** SOCIAL-2.1, SOCIAL-2.2, SOCIAL-2.3
- **Accounts:** GM, P1, P2
- **Preconditions:** Review: Party in the Field. Email delivery cannot be read (gap G1), so check only the in-app feed here; the "delivered once" email evidence for SOCIAL-2.3 is a harness result.

**Steps**

1. **P1 and P2:** Open the notifications page and note the unread count.
2. **GM:** Publish an announcement in Review: Party in the Field (Announcements).
3. **P1:** Watch the notification count in the header without reloading, then open Notifications.
4. **P1:** Open the notification; confirm it opens the announcement and is marked read.
5. **P1:** Open notification preferences and switch off both channels (in-app and email).
6. **GM:** Publish a second announcement.
7. **P1:** Check Notifications.
8. **P2:** Check Notifications.
9. **GM:** Publish announcements one after another until P2 has been sent more than 25 in total (count P2's earlier ones; this is slow, roughly 26 small announcements). Then count the entries in P2's feed. Stop and record the count reached if you cannot finish.
10. **P1:** Turn the channels back on.
11. **GM:** Publish another announcement and check P1 gets it.

**Expected**

- The new announcement arrives live as an unread notification; opening it marks it read.
- With both channels off P1 gets no notification for the second announcement; P2 still does.
- Step 9: P2's feed holds 25 entries, the latest 25; the oldest are gone. (The announcements stay in the Campaign.)
- Email: not checked here (gap G1); the in-app result is the evidence for turning both channels off.
- After re-enabling channels P1 gets the next one.

**Other users see**

- **P2:** gets their own notifications regardless of P1's preferences. Must NOT see anything addressed to P1 only.

## UAT-SOCIAL-6: Plan limits and capacity

- **Covers:** SOCIAL-3.1, SOCIAL-3.2
- **Accounts:** P1, GM, SUPERADMIN (gap G2)
- **Preconditions:** The review accounts' tiers are whatever the README Accounts table lists; read them in step 1 and record them. Steps 1-6 run now; step 7 is (blocked: G2) because a downgrade cannot be done from the app. If the limit in step 3 is too high to reach by hand (more than about 20), record the number and mark steps 3-5 not run.

**Steps**

1. **P1:** Open Settings and Account, and read the plan, limits and current usage (**EntitlementSummary**).
2. **GM:** Open the same page and compare.
3. **P1:** Create new homebrew items or Characters until you reach the limit shown for one of them (use the cheapest: a homebrew Feat).
4. **P1:** Try to create one more beyond the limit.
5. **P1:** Delete one and create it again, then delete the Feats you made for this scenario.
6. **P1:** Try to host a Campaign beyond the hosted-Campaign limit, or add a seat beyond the seat limit, if the free tier has one.
7. **SUPERADMIN (blocked: G2):** Downgrade P1's tier and open the Account page.

**Expected**

- The Account page shows tier, shared policy limits and counters for homebrew, Characters, hosted Campaigns, seats, listings, storage and Blueprints.
- Step 4 is refused with a message naming the limit and nothing is created.
- Freed capacity can be used again; counters change immediately.
- Step 7 (blocked: G2): existing items remain but new ones are refused.

**Other users see**

- **GM:** sees their own limits, not P1's.

## Covered elsewhere

ACs with no tester-visible behaviour (internal refactors, measurements, CI or contract checks). Their ledger proof is the evidence.

| AC | Why not a UAT step |
| -- | ------------------ |
| SOCIAL-1.3 | Needs two final-slot actions committing in the same instant, which a person cannot cause by hand; an OCC harness. The sequential full-table refusal is UAT-SOCIAL-1 step 7. |
| SOCIAL-1.4 | Retention and cleanup run on a schedule over aged rows; nothing in the app brings a row to its purge age. |
| SOCIAL-3.3 | Parallel final-slot race needs a harness; the sequential over-limit refusal is UAT-SOCIAL-6 step 4. |
