# Phase 8.2 open questions

> Questions waiting for the user's answer only; keep this file short. Answer inline under **Answer** (or in chat). Answered items move to [Resolved](phase-08-2-decisions.md#resolved) with the decision; decisions made on the user's behalf, approved implementation decisions and resolved questions live in [phase-08-2-decisions.md](phase-08-2-decisions.md).
>
> Updated: 2026-10-18 (Q25 answered).

## Open

### Q25 (2026-10-18) Convert class, race and creature closed rules before alpha?

**Context:** SPELLS-4.1 (your 2026-10-14 ruling) converts the SRD spell and equipment closed rules to core authoring options: 148 kinds remain. The SPELLS-4 session's scan also found about 165 class kinds, 14 race kinds and about 319 creature kinds. Every one is an inert marker that fails closed, so the table shows its text and the GM applies it by hand. Many will be description-only (D156), but the creature and class features with combat effects (Pack Tactics, Rage, Sneak Attack and similar) are visible gaps at the table. No acceptance criterion covers them.

**Options:**

- A (recommended): register one PBI per corpus (Classes, Races, Creatures), each with the AC "every closed rule becomes core options or description-only, with parity proofs". Size each after SPELLS-4.T2's classification proves the method, and sequence them by WSJF before alpha.
- B: convert only those a classification marks as having a combat effect; leave the rest as markers until after beta.
- C: leave all of them until after beta, recorded in future-enhancements.

**Answer:** A (user, 2026-10-18): convert all of them before alpha. AC confirmed by the user and registered as SPELLS-31 (Classes), SPELLS-32 (Races) and SPELLS-33 (Creatures).

### Q24 (2026-10-17) Automate cast-time choice spells before alpha?

**Context:** a cast-time choice (`choiceOptionId` on the cast command, D140) arrives with SPELLS-20.T4e for Spirit Guardians' damage type. Three SRD spells whose cast offers a choice still resolve MANUAL today, so the GM applies their effect by hand: Protection from Energy (damage type), Blindness/Deafness (which condition) and Blade Barrier (wall shape). With D140 in place each becomes a data change plus a test. No acceptance criterion covers them yet.

**Options:**

- A (recommended): register a SPELLS PBI, "Cast-time choice spells resolve automatically", with one AC listing the three spells, after SPELLS-20.T4e merges. This closes a visible gap at the table for a small cost (size 3).
- B: leave them MANUAL until after beta, recorded in future-enhancements.

**Answer:** A (user, 2026-10-17): automate them before alpha. AC confirmed by the user and registered as SPELLS-30.
