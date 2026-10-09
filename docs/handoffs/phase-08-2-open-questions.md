# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-09.

## Open

### SPELLS-5.6: "the movement budget for every speed type"

**Context.** The tabletop movement readout (V07.5, `readTurnMovementView`) has one budget per actor, its walking speed, and a move declares no mode (walk, fly, swim, climb, burrow). So a Fly grant (fly 60 ft) has no budget to change. The literal AC needs a per-mode budget, which changes the `turnMovement` session DTO and the tabletop UI, and needs moves to declare a mode.

**Options.**
- **A (recommended).** A speed grant changes the holder's effective speed of every type: the Sheet and the Creature's Encounter speeds show it, and Fly's 60 ft fly speed is added. The tabletop budget stays the walking speed and follows walking-speed grants (Longstrider +10, Ray of Frost −10). Per-mode budgets are registered as a MOVE enhancement.
- **B.** SPELLS-5.6 adds per-mode budgets: the readout carries a budget per speed type and the move command names its mode.

Slice D builds A's parts now, since B needs them too. Only the per-mode budget waits on this answer.

**Answer:**

### SPELLS-5.7: does a Concentration grant outlast the Run?

**Context.** Concentration is a maintained state of the Run: it is deleted when the Run completes, so every effect it maintains ends then. D99's carry-over (Q1 A) says a Character's remaining grants carry over to the Campaign clock. A Concentration grant on a Character (Fly, Shield of Faith) can't do both: under the SRD it would last as long as the caster keeps concentrating, but nothing tracks Concentration outside a Run.

**Options.**
- **A (recommended, built).** A Concentration grant is Encounter-scoped and ends with the Run, together with the Concentration. Concentration that outlasts a Run is registered as a future enhancement (it needs Campaign-level Concentration).
- **B.** A Concentration grant carries over like any other grant, losing its Concentration link at completion, so it then lasts until its Campaign-clock expiry.

**Answer:**
