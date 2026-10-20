# Slice ENCOUNTER-8: Roll cards show a roll mode that changed at commit

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T1 (m206, done): the static mode-change result, also the reduced-motion presentation.
- T2 (this session, closes AC ENCOUNTER-8.1): the arrival animation. T1's contract is unchanged; the static markup is the same and only data attributes and CSS are added.

Base: `origin/codex/phase-08-2-convex-cutover`. CI branch `ci/encounter-8-t2`.

## Design

- `StaticDiceResult` (`apps/web/src/components/dice/DiceRollPresentation.tsx`) plays the animation when its roll has a `D20_MODE_ADJUSTED` check, reduced motion is off and the roll id has not played in this tab. It sets `data-mode-change='playing'` for `MODE_CHANGE_ANIMATION_MS` (520), then clears it. The CSS in `dice.css.ts` keys the ✕ draw (200ms) and the added die roll-in (250ms, after the draw) off that attribute, so the settled state is exactly the T1 result.
- "Everyone who sees the card when it arrives": every client mounts the card for the arriving roll, so each plays it. "No replay on reopen": a module-level set of rolls already played, so a remount of the same roll is static.
- Timing and style are recorded under Motion in [DESIGN.md](../../DESIGN.md).

## Proofs

- `DiceRollPresentation.test.tsx` (fake clock): plays once on arrival and settles; does not replay on reopen; reduced motion shows the static result with no animation.
- Stories: `Dice/Roll mode change` (cancelled die, added die).

## Progress

- 2026-10-20: T2 built and tested locally; pushed to CI.
