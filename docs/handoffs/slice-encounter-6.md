# Slice ENCOUNTER-6: Morale

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- **ENCOUNTER-6.T1** closes ACs ENCOUNTER-6.1 to 6.3. This is the 2014 DMG Morale variant, approved for Phase 8.
  - Authored triggers: surprised, reduced to half hit points, cannot harm the opposition, half the group removed, leader removed or incapacitated.
  - A trigger offers the GM a morale save for the creature, or for its group's leader, or for the fallback roller.
  - A failed save proposes flee, or surrender when escape is impossible.
  - The GM confirms the outcome, and it is recorded on the actor.
  - Campaign settings offer Morale only once it resolves.
- The removed resolver is in `437b2dd15` (`optionalResolutionPolicy.ts`): trigger scopes, the leader and fallback roller, and overwhelming opposition. Use it as a reference, not as code to restore. Token presentation belongs to VTT_UI-2.1 and is out of scope.

## Log
