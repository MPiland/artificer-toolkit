# Slice SPELLS-19: area actions that leave conditions or lasting effects

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- AC 1: a point-area action whose per-creature outcome applies a condition, a lasting or recurring effect, a relationship condition, or a maintained (Concentration) effect commits that outcome on each caught creature it selects, and GM undo removes it from every one.
- AC 2: every SRD breath weapon that leaves a condition (the 21 shaped non-damage breaths, such as Silver Dragon Wyrmling Paralyzing Breath, and Gorgon Petrifying Breath with its printed repeat save authored) is offered and resolves through the area executor; the SPELLS-21 corpus test's list of non-compiling breaths is empty.
- Reuse the single-target condition and effect commit and undo paths; no area-specific copies. Authored from core options with a parity proof (ADR 0038).
- First step: split into vertical tasks with WSJF and send them to the main session for registration before coding.
- Iterate in CI (`ci/spells-19`).

## Log
