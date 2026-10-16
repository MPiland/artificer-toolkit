# Slice ATTACK-10.T4: sight-governed saving throws

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

Closes AC ATTACK-10.5: saving throws follow the D100 believed/true rule.

- **The hidden fact (ruling, 2026-10-16):** the saver's sight of the effect's source, resolved with the D100 inputs. The source is the caster or actor for a targeted save and the area's origin for an area save. The SRD 5.1 contributor is Barbarian Danger Sense: advantage on Dexterity saves "against effects that you can see", lost while Blinded, Deafened or Incapacitated. Author that sight requirement as a generic, sight-gated save-contributor predicate (the saver sees the source) from core authoring options, nothing Danger-Sense-specific, with an author-built parity proof.
- **Believed vs true:** identical to attacks. The believed sight uses only the saver's own facts and the source as it is, on the neutral environment (the saver's Blinded and Senses, the source's own Invisible). The true sight uses the full Scene. The prompt shows the believed mode; the save settles in the true mode with the shared dice-settling rules (`encounterSightGovernedD20.ts`, held die).
- **Reasons:** the player caption is generic and never names a Sense or a hidden actor. The GM sees the specific reason.
- **Unchanged:** viewer projection (an actor hidden from players) stays a D100 never-input, and the "Unseen source" redaction stays viewer redaction.
- **Docs:** add a "Saves (current, ATTACK-10.T4)" bullet to D100 in `phase-08-2-decisions.md` and update `live-sessions.md`.
- **Validation:** red-first. Iterate in CI (`ci/attack-10-t4`); the light lane is memory-starved.

## Log
