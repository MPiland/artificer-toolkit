# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-17 (Q24 added).

## Open

### Q24 (2026-10-17) Automate cast-time choice spells before alpha?

**Context:** a cast-time choice (`choiceOptionId` on the cast command, D140) arrives with SPELLS-20.T4e for Spirit Guardians' damage type. Three SRD spells whose cast offers a choice still resolve MANUAL today, so the GM applies their effect by hand: Protection from Energy (damage type), Blindness/Deafness (which condition) and Blade Barrier (wall shape). With D140 in place each becomes a data change plus a test. No acceptance criterion covers them yet.

**Options:**
- A (recommended): register a SPELLS PBI, "Cast-time choice spells resolve automatically", with one AC listing the three spells, after SPELLS-20.T4e merges. This closes a visible gap at the table for a small cost (size 3).
- B: leave them MANUAL until after beta, recorded in future-enhancements.

**Answer:**
