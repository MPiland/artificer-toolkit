# UAT-DEVICES-9: Tabletop limits on a phone and a tablet

Tabletop limits on a phone and a tablet.

Device pass · Feature DEVICES · Mode: Solo (P1) · Device pass position 9 of 9

## Prerequisites

- **Needs a build that contains VTT_UI-6 (the live tabletop on large tablets and computers only). On any earlier build, including the frozen staging build, this scenario is BLOCKED: record BLOCKED and the build, and do not run the steps.**
- The account **P1** exists and is seated in **The Campaign** with Aria ([UAT-CAMPAIGN-9](../CAMPAIGN/UAT-CAMPAIGN-9.md)).
- On a computer, open the tabletop from The Campaign once and copy its address from the address bar. It looks like `/tabletop/campaigns/<campaign id>`. You need it in steps 3 and 6.
- Aria's Sheet exists ([UAT-BUILDER-1](../BUILDER/UAT-BUILDER-1.md)).

## Accounts and windows

- **Roles used:** P1
- **Windows:** One browser, signed in as P1.
- **Settings:** For the phone steps, a real phone, or the browser device toolbar set to a phone preset (375 px wide). For the tablet steps, a real large tablet, or the device toolbar set to 768 x 1024 (portrait) and 1024 x 768 (landscape). Use a device preset, not a narrowed desktop window: the screen decides, not the window.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

1. [ ] **P1 (phone):** Open The Campaign's session page. Look in the **Live tabletop** panel for **Open tabletop window**.
2. [ ] **P1 (phone):** Open Aria's Sheet and look for **Open live tabletop window**.
3. [ ] **P1 (phone):** Open the tabletop address you copied.
4. [ ] **P1 (phone):** On the message that appears, choose the link back to the Campaign.
5. [ ] **P1 (tablet, portrait 768 x 1024):** Open the Campaign's session page and choose **Open tabletop window**, or open the tabletop address.
6. [ ] **P1 (tablet, portrait):** Read the prompt that covers the tabletop.
7. [ ] **P1 (tablet):** Rotate to landscape (1024 x 768) without reloading the page.
8. [ ] **P1 (tablet, landscape):** Look at the tabletop, then rotate back to portrait.

## Expected

- Steps 1 and 2: on the phone neither **Open tabletop window** nor **Open live tabletop window** is shown, and nothing is left behind such as an empty gap or a disabled button. On the tablet both are shown (step 5).
- Step 3: the tabletop does not open. A message says the live tabletop needs a large tablet or a computer, and offers a link back to the Campaign. P1 is not shown as present in the room to anyone else.
- Step 4: the link goes to The Campaign's page.
- Step 6: in portrait the tabletop is covered by a prompt to turn the tablet to landscape or widen the window.
- Step 7 and 8: rotating to landscape removes the prompt and shows the tabletop without a reload; rotating back brings the prompt back.

## Other users see

- **GM, P2, P3:** if open in the live room, must NOT see P1 appear as present while P1 is on the phone message or behind the rotate prompt.

## ACs covered

VTT_UI-6.1, VTT_UI-6.2, VTT_UI-6.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Device:** (desktop, tablet or phone; browser; real device or emulated width)
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
