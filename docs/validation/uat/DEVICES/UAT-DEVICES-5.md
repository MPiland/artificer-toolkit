# UAT-DEVICES-5: Campaign chat on a phone

Campaign chat on a phone.

Device pass · Feature DEVICES · Mode: Group (P1, GM) · Device pass position 5 of 9

## Prerequisites

- **The Campaign** exists, hosted by GM, with P1 seated as a player ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).

## Accounts and windows

- **Roles used:** P1, GM
- **Windows:** P1 uses a phone (a real phone, or a browser device toolbar set to 375 px wide). GM uses a desktop browser. Each is signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** On the phone open The Campaign and choose **Open Campaign chat**.
2. [ ] **P1:** Read the **Chat** drawer: the **Campaign conversations** navigation (table, party and direct messages) and the message history.
3. [ ] **P1:** Pick the table conversation. Tap the message field and type "Phone check". Send it.
4. [ ] **P1:** Scroll the history up and down, then rotate the phone (or the device toolbar) to landscape and back.
5. [ ] **GM:** On desktop open the Campaign chat and read the message.
6. [ ] **GM:** Reply "Got it".
7. [ ] **P1:** Check the reply arrives without a reload.
8. [ ] **P1:** Open **Message actions** on your own "Phone check" message and unsend it. Close the chat drawer.

## Expected

- The chat drawer fills the phone screen, the conversation navigation is reachable, and the message field and send control stay visible above the on-screen keyboard.
- The message appears for GM, and GM's reply appears for P1 live.
- Rotation keeps the typed text and the scroll position usable.
- After step 8 "Phone check" is removed or shown as unsent, as the product does on desktop.

## Other users see

- **GM:** sees "Phone check" in step 5 and sees it unsent after step 8.
- **P2, P3, P4:** see the table conversation only. They do not see any direct message.

## ACs covered

Not tied to an AC: device coverage.

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
