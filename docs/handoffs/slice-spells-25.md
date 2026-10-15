# Slice workbook: SPELLS-25 (every zone states where it is placed)

**Status:** READY FOR REVIEW (implemented 2026-10-15)
**Base:** `codex/phase-08-2-convex-cutover` at this workbook's commit.
**Rules:** [slice-workbook-rules.md](slice-workbook-rules.md).

## Brief

`attachmentKind` on a `MANIFEST` outcome says where a zone sits: `SOURCE` (moves with its source), `PRIMARY_TARGET` (attached to a target), `PLACED_SPACE` (fixed where it is put) or `TOUCHED_OBJECT`. It is optional today, and 36 of the 39 SRD `ZONE` manifests leave it unset. All 36 are spells; only Caltrops, Ball Bearings and Oil set it. The SPELLS-17 creator compiles only `ZONE` + `PLACED_SPACE`, so it would place none of them. The scan is `local-validation/trap-design/zoneScan.json` in the main checkout (regenerate it with the scratch script if it is missing; it walks the built `packages/source-data/dist/srd`).

User ruling 2026-10-14 (decisions: "Hazards and traps"): make the field required on `ZONE`, not infer it from range.

- **Schema:** `packages/schema/src/effects/manifest.ts`. `ZONE` currently shares a branch with `SENSOR`, `WEAPON`, `OBJECT` and `ILLUSION`, with `attachmentKind` optional in the base. Make it required for `ZONE` only, without changing the other kinds' contract. Keep the change minimal and typed (no casts); match the authored type in `packages/shared/src/domains/effects/authored/manifest.ts`.
- **Node map:** `packages/shared/src/domains/effects/maps/path.ts` (the attachment select near line 2183). Required when `manifestKind` is `ZONE`, using the existing `requiredIf`/`showIf` pattern.
- **Data:** set `attachmentKind` on every SRD zone from its SRD text. A zone centered on and moving with the caster (Antilife Shell, Antimagic Field) is `SOURCE`. A zone at a chosen point that stays there is `PLACED_SPACE`, even if it ends when the caster leaves (Tiny Hut). Report any zone whose text does not settle it in the status log with your reading; do not invent a new kind.
- **Corpus test:** fails on any `ZONE` without `attachmentKind`. Put it with the existing SRD corpus tests in `packages/source-data`.
- Regenerate the SRD manifest (`yarn workspace @artificer-toolkit/apis generate:srd:manifest`).
- **Out of scope:** what the runtime does with spell zones (SPELLS-17 creates placed zones, SPELLS-20 handles `SOURCE` auras, SPELLS-4 converts closed rules). Do not touch closed rules or zone behaviors.

Escalate (`SendMessage` to the main session) only if:

- making the field required for `ZONE` alone forces a contract change on another manifest kind; or
- a zone's SRD text fits none of the four kinds.

Read first:

- The "Hazards and traps" entry and SPELLS-17 in `docs/handoffs/phase-08-2-decisions.md`.
- `manifest.ts` (schema and shared authored), the attachment node in `path.ts`, and one zone each of `blade-barrier.ts`, `antilife-shell.ts` and `caltrops-bag-of-20.ts`.

## Closes

- AC SPELLS-25.1.

## File scope

- `packages/schema/src/effects/manifest.ts`.
- `packages/shared/src/domains/effects/authored/manifest.ts` and `maps/path.ts`.
- `packages/source-data/src/srd/spells/*` (zone outcomes only) and the SRD manifest.
- Tests next to each.
- No web, Worker or Convex function change.

## Red-first checklist

1. **Schema:** a `ZONE` manifest without `attachmentKind` fails to parse; `OBJECT` and `SENSOR` without it still parse. Fails on base.
2. **Node map:** resolving a `ZONE` manifest node marks `attachmentKind` required; a non-`ZONE` manifest does not. Fails on base.
3. **Corpus:** every SRD `ZONE` has `attachmentKind`. Fails on base (36 missing).
4. **Regression:** the apis `encounters` and `content` folders (source-data rule), the source-data tests, the shared node-map tests and the schema parsing tests stay green.

## Status log

- 2026-10-14: workbook written.
- 2026-10-15: AC SPELLS-25.1 implemented. All logs are under `local-validation/spells-25/`.
  - Worktree needed `yarn install` and a `design-system` build before any test would load; the first two red attempts failed on that (not kept as red evidence).
  - Schema: `ZONE` split out of the shared kind branch in `manifest.ts`; it extends the `SENSOR`/`WEAPON`/`OBJECT`/`ILLUSION` branch with a required `attachmentKind` (the enum is now one shared const). The other kinds' contract is unchanged. Authored type: `ZoneManifestAuthored` requires it.
  - Node map: `attachmentKind` is `requiredIf` `manifestKind` is `ZONE` (`maps/path.ts`).
  - Data: 37 zones set (the scan's 36 plus Ice Devil's Wall of Ice, a creature action the scan did not cover, so the corpus holds 40 zones). `SOURCE`: Antilife Shell, Antimagic Field ("around you / moves with you"). `PRIMARY_TARGET`: Resilient Sphere (encloses a chosen creature or object). `PLACED_SPACE`: the other 34 (Globe of Invulnerability as ruled in review, the same reading as Tiny Hut; both Blade Barrier and both Prismatic forms via their shared factories).
  - Readings to review: Darkness and Daylight are `PLACED_SPACE`, though the SRD lets the caster put the point on an object (the zone then moves with it). Forbiddance and Hallow ("touch a point") are `PLACED_SPACE`. Cloudkill is `PLACED_SPACE` although it drifts each turn; that is movement of a placed zone, not attachment. No zone fit none of the four kinds, so nothing was escalated.
  - Fixtures: the `ZONE` fixtures in `authored-length-amount-bounds.test.ts` and `apps/web/src/forms/tests/FormPlatform.test.tsx` gained an `attachmentKind` (required now). The web test was not run (web unit runs cannot reach 0 failures in a worktree); it only added a field to input data.
  - Checklist: 1 `red-schema.log` / `green-schema.log`; 2 `red-nodemap.log` / `green-shared.log`; 3 `red-corpus.log` / `green-source-data.log`; 4 `green-schema.log` (74 files, 669 tests), `green-shared.log` (52 files, 406 tests), `green-source-data.log` (13 files, 54 tests), `green-apis.log` (the `encounters` and `content` folders, 123 files, 773 tests). Also `green-typecheck.log` (`turbo run typecheck --filter="[codex/phase-08-2-convex-cutover]"`, 17 of 17 tasks) and `green-codegen.log` (local codegen push). SRD manifest regenerated (`green-manifest.log`).
  - Storybook runs not done (cannot start in a worktree): any story with a `ZONE` manifest fixture; a grep found none under `apps/web`.

## Proposed ledger edits (filled by the slice session)

- AC SPELLS-25.1: done, proof = `packages/schema/src/__tests__/manifest-zone-attachment.test.ts`, the `requires an attachment only on ZONE manifests` test in `packages/shared/src/__tests__/effect-node-maps.test.ts` and `packages/source-data/src/srd/zoneAttachment.test.ts`.
- Unblocks SPELLS-17 (creator compiles `ZONE` + `PLACED_SPACE`), SPELLS-20 (`SOURCE` auras) and SPELLS-4.
