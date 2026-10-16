# Slice SPELLS-20: auras that move with their source

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- AC 1: an aura (Spirit Guardians, a paladin's Aura of Protection, a creature's damaging aura) is an authored spatial effect centered on its source that moves with it and applies its authored outcome to the creatures inside it; the encounter projection carries each aura's radius and label to the viewers allowed to see its source, so the map can draw it.
- Build on the production spatial-effect creator from SPELLS-17 (placed zones) and the zone entry/turn triggers; no aura-specific copies of zone logic. Authored from core options with a parity proof (ADR 0038).
- Projection: only viewers allowed to see the source receive the aura geometry (redaction parity with token visibility).
- First step: split into vertical tasks with WSJF and send them to the main session for registration before coding.
- Iterate in CI (`ci/spells-20`).

## Log
