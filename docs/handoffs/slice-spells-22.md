# Slice workbook: SPELLS-22 (self-radius areas centered on the caster)

**Status:** OPEN (started 2026-10-14)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

An area with a Self range and a sphere, cylinder or circle shape ("each creature within 10 feet of it", Destructive Wave, monster death bursts) is refused today. `encounterAreaTargetKind` in `packages/rules-runtime/src/encounterAreaAction.ts` (about line 45) maps a Self range only to cone, line and cube (DIRECTED), and every other Self pairing to null.

Make these areas resolve the way point areas do under SPELLS-7, with one difference: the area is centered on the caster and needs no aim.

- **Target kind:** a Self radius area takes no player input. Its origin is the caster's token. Add the pairing to the one support table (`encounterAreaTargetKind`), so the System compiler and the target policy agree. A caster with no token is refused with the existing `NO_CASTER_TOKEN` rejection.
- **Geometry (integration ruling, recorded as D114 at merge):** "within N feet of you" is measured from the edge of the caster's space, as 5e measures distance from a creature's space. A creature is caught when its footprint shares positive area with the caster's footprint expanded by the radius. Use the one overlap rule of D103 and SPELLS-24 (`footprintOverlapsSpatialGeometry` in `packages/shared/src/domains/vtt/spatial.ts`): touching the edge never catches. For a Medium caster this is close to a circle from the center; for a Large or Huge caster the reach grows with the space. Express the expanded footprint with the existing geometry kinds if that is exact. If it needs a new `SpatialGeometry` kind, keep it transient: no persisted shape change.
- **The caster:** excluded, unless the authored targeting already says the caster is included. Use the existing authored option if one exists. If none exists, keep the caster excluded and report it. Do not add an authored field in this slice.
- **Resolution:** everything after the catch (saves, damage, receipts, undo, perception) is the SPELLS-7 point-area path, unchanged. A Self radius area whose outcome leaves a condition or lasting effect stays refused until SPELLS-19. Moving auras are SPELLS-20.
- **Authorability:** no new authored shape is expected; Self range plus a radius shape is already authorable. If you find you need one, stop and report.

Escalate only if:

- the ruling above cannot be expressed without a persisted geometry or contract change; or
- an SRD Self radius area cannot be expressed in the existing authored shapes.

Read first:

- D103 and the SPELLS-7 and SPELLS-13 decisions in `docs/handoffs/phase-08-2-decisions.md`.
- [slice-spells-24.md](slice-spells-24.md), status log.
- `encounterAreaAction.ts`, `effectActionCompiler.ts` (its use of the support table), and `spatialTokensInsideArea` in `spatial.ts`.
- `encounterAreaAction.test.ts` and `encounterAreaActionCompilation.test.ts`.

## Closes

- AC SPELLS-22.1.

## File scope

- `packages/shared/src/domains/vtt/spatial.ts`.
- `packages/rules-runtime`: the area action, compiler and target policy.
- `apps/session-worker`, only where the native action path needs a no-aim area target.
- Tests next to each.

If the Encounter action UI needs to offer a no-aim area, keep the change inside the existing target-picking component, and list it in the status log.

## Red-first checklist

1. Support table: Self plus SPHERE, CYLINDER or CIRCLE gives the new target kind. Self plus a wall or dome is still null. These fail on base.
2. Catch (shared):
   - a Medium caster with a 10-foot radius catches a token 10 feet away with positive overlap;
   - it does not catch a token whose footprint only touches the expanded edge;
   - a Huge caster's reach is measured from its space edge;
   - the caster is never in its own catch.
3. Compiler: an SRD Self radius action (pick one real SRD row, such as a monster death burst or Destructive Wave) compiles to COMPILED, not MANUAL.
4. Refusals: no caster token gives `NO_CASTER_TOKEN`. An outcome that leaves a condition is still refused (SPELLS-19).
5. Journey: a Worker Encounter journey through real code. A creature uses a Self radius area, the tokens inside take the save and damage, and the token outside and the caster do not.

## Status log

- 2026-10-14: workbook written.

## Proposed ledger edits (filled by the slice session)
