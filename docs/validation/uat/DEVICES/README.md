# Device pass

A short pass that runs the main flows on a phone-width screen, plus one scenario for the tabletop's device limits. The scripted scenarios elsewhere are written for a desktop browser; this folder proves the same product is usable on a small screen. [UAT-SHEET-10](../SHEET/UAT-SHEET-10.md) (Sheet at phone width) and [UAT-SPELLS-25](../SPELLS/UAT-SPELLS-25.md) already cover the Sheet and spell pages on a phone, so they are not repeated here.

## What it proves

- You can sign in, open the account menu and Settings, and sign out on a phone.
- The mobile footer, the search drawer and the account menu work with a thumb.
- The Character Builder can create, save a draft, resume and commit a Character on a phone.
- The Campaign pages work on a phone: joining from an invitation, the Party roster, the Active Character and the Campaign chat.
- The Social Hub, authoring editors, Library lists and authored detail pages are usable at phone width, with no sideways scrolling and no cut-off control.
- The live tabletop supports large tablets and computers only (screen longer side at least 1024 CSS px). On a phone its entry controls are absent and the tabletop address explains why; on a tablet held in portrait a rotate prompt covers the tabletop. This needs a build that contains [VTT_UI-6](UAT-DEVICES-9.md); on an earlier build that scenario is BLOCKED.

## How to run it

- **Phone scenarios (1 to 8):** use a real phone where you can. Otherwise open the browser's device toolbar (press F12, then the device icon) and set the width to 375 px. Say which in the **Device** line of each Result.
- **Tablet check (scenario 9):** a real tablet, or the device toolbar set to 768 x 1024 (portrait) and 1024 x 768 (landscape). The screen decides, not the window, so a narrowed desktop window is not a phone for this check: use the device toolbar's own device presets.
- Sign in with the existing accounts (GM, P1 to P5) and use the data earlier levels built: The Campaign, P3's Campaign, and Aria.
- Run the scenarios in order, after Level 3 and before [UAT-ACCOUNTS-12](../ACCOUNTS/UAT-ACCOUNTS-12.md). Each one that changes data says how to put it back.
- Record the device in every Result: **Device:** phone, tablet or desktop; the browser; real device or emulated width.

## Scenarios

| Position | Scenario                          | Title                                                        | Mode  |
| -------- | --------------------------------- | ------------------------------------------------------------ | ----- |
| 1        | [UAT-DEVICES-1](UAT-DEVICES-1.md) | Sign in, account menu, Settings and sign out on a phone      | Solo  |
| 2        | [UAT-DEVICES-2](UAT-DEVICES-2.md) | Mobile footer, search drawer and Library menu                | Solo  |
| 3        | [UAT-DEVICES-3](UAT-DEVICES-3.md) | Character Builder on a phone: create, draft, resume, commit  | Solo  |
| 4        | [UAT-DEVICES-4](UAT-DEVICES-4.md) | Campaigns on a phone: invitation, Party and Active Character | Group |
| 5        | [UAT-DEVICES-5](UAT-DEVICES-5.md) | Campaign chat on a phone                                     | Group |
| 6        | [UAT-DEVICES-6](UAT-DEVICES-6.md) | Social Hub on a phone                                        | Solo  |
| 7        | [UAT-DEVICES-7](UAT-DEVICES-7.md) | Authoring editor on a phone                                  | Solo  |
| 8        | [UAT-DEVICES-8](UAT-DEVICES-8.md) | Library lists and authored detail pages on a phone           | Solo  |
| 9        | [UAT-DEVICES-9](UAT-DEVICES-9.md) | Tabletop limits on a phone and a tablet                      | Solo  |

The [tracker](../TRACKER.md) holds the status of each. Test conventions are in the [Start here page](../README.md).
