# UAT-SCENE-9: One shared table screen for several players

One shared table screen for several players.

Level 2 (GM setup) · Feature SCENE · Mode: Group (GM, P1, P2, P3) · Path position 64 of 191

## Prerequisites

- The account **GM** exists and hosts The Campaign.
- The account **P1** exists and is seated as a player in The Campaign.
- The account **P2** exists and is seated as a player in The Campaign.
- The account **P3** exists and is seated as a player in The Campaign.
- Done in [UAT-SCENE-4](UAT-SCENE-4.md): tokens for Aria and Bryn are on the presented Scene.

## Accounts and windows

- **Roles used:** GM, P1, P2, P3
- **Windows:** Each role is a different person in their own browser, signed in to their own account.

## Steps

Mark each step: `[P]` passed, `[F]` failed, `[-]` not reached. Leave `[ ]` until run.

S1. **GM:** Add a token for Cade (P3) to the presented Scene.

1. [ ] **GM:** Open the Party and give P1 control of P2's Character in addition to P1's own (**Also controlled by**). Keep P2 as owner.
2. [ ] **P1:** Look for a **Main Character** selector and read the choice.
3. [ ] **P1:** Select P2's Character as the main Character.
4. [ ] **P1:** Click P2's Character's token to select it, then click empty space to clear.
5. [ ] **P1:** Move P2's Character's token one square.
6. [ ] **P2:** Move that token too.
7. [ ] **GM:** Take the control back from P1.
8. [ ] **P1:** Try to move that token again.
9. [ ] **P1:** Type 150 in **Zoom percentage**, press **Zoom in** once, then reload; also open **Full screen**.
10. [ ] **P3:** Check P3's own zoom.

## Expected

- P1 gets a selector, defaults to P1's own Character, and while P2's Character is selected sees through that Character's senses; clearing or multi-selecting returns to the main Character.
- P1 can move Bryn's token while allowed; the owner P2 keeps control. After the GM takes control back P1 cannot move it.
- Zoom is the typed or stepped value and persists across reload and view switches on that device; it does not affect P3.

## Other users see

- **P2:** sees only P2's own Character's view; must NOT see what only P1's Character's senses reveal while P1 views as P2's Character, nor P1's choice of main Character.
- **P3:** unaffected.

## ACs covered

SCENE-5.1, SCENE-5.2, SCENE-5.3

## Result

Fill this in after the run. Leave the other scenarios' blocks alone.

- **Status:** NOT RUN (change to PASSED, FAILED, BLOCKED or SKIPPED)
- **Date:**
- **Build:**
- **Tester:**
- **Failure details:** (which step, expected vs actual, exact message text, does it repeat)
- **Notes:**
