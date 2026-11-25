# UAT-DEVICES-7: Authoring editor on a phone

Authoring editor on a phone.

Device pass · Feature DEVICES · Mode: Solo (P1) · Device pass position 7 of 9

## Prerequisites

- The account **P1** exists and is signed in.
- P1 has no Background named "UAT Phone Background".

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.
- **Settings:** A real phone, or the browser device toolbar set to 375 px wide (press F12, then the device icon).

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1:** At phone width open `<STAGING_URL>/backgrounds/new`.
2. [ ] **P1:** Enter the name "UAT Phone Background" and fill the required fields, as in [UAT-AUTHORING-3](../AUTHORING/UAT-AUTHORING-3.md) step 3.
3. [ ] **P1:** Find a grouped field (a list of items you can add to) and open its editor. Edit one field inside it.
4. [ ] **P1:** Close the editor and check the change is shown in the form.
5. [ ] **P1:** Choose **Save Draft**, reload, and check the draft is listed at `<STAGING_URL>/backgrounds`.
6. [ ] **P1:** Open the draft, change the description, and choose **Save Draft** again.
7. [ ] **P1:** Choose Delete and confirm. If the page offers **Discard draft** instead, choose that and confirm.

## Expected

- The form fits the phone width. A grouped field's editor opens as a drawer or full-screen panel that can be closed, and its fields are reachable without sideways scrolling.
- Saving works from the phone and the draft survives a reload.
- After step 7 "UAT Phone Background" is gone from the list.

## Other users see

- Not applicable: single user; the draft is private and is removed at the end.

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
