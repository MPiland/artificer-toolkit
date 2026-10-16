# SPELLS-28.T1b: in-Scene teleport (Misty Step, Dimension Door)

Closes AC SPELLS-28.2. Status: started 2026-10-16, in parallel with SPELLS-28.T2 (which keeps
[slice-spells-28.md](slice-spells-28.md)). T1 (off-Scene TELEPORT, D128) is DONE.

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Approved conditions

The rulings and conditions in [slice-spells-28.md](slice-spells-28.md) "Rulings (main session)" (T1b) and
"T1b conditions (approved)" are binding:

- The cast commits a bounded one-shot teleport allowance on the existing movement-economy pattern (`maxFeet`, kind
  `TELEPORT`, expiring at the end of the caster's turn), not a new contribution kind.
- A following `MOVE_SCENE_TOKEN` TELEPORT consumes it through the spatial movement service as `movementKind: TELEPORT`;
  range, occupancy and visibility are enforced at consumption. A player or actor TELEPORT without an allowance is
  refused; GM moves stay ungated. On web the player picks the destination right after the cast as one flow.
- Cast undo is refused once the move landed; undo order is the move first, then the cast.
- Authored from core options (authoring-parity proof).

## Status log
