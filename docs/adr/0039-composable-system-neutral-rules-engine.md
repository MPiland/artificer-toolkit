# ADR 0039: Composable, System-neutral rules engine

- **Status:** decision (user approved 2026-10-20; implemented by RULES-2)
- **Date:** 2026-10-20
- **Scope:** `packages/rules-runtime`, the Kernel in `packages/shared/src/domains/rules`, the Session Worker's encounter rules, and the schema vocabulary they share
- **Amends:** [ADR 0023](0023-shared-rules-kernel-and-system-capabilities.md). That ADR's neutral Kernel and System module layering also applies to the Encounter, Character and Sheet pipelines, not only the Kernel.
- **Builds on:** [ADR 0038](0038-rules-authored-from-core-options.md), which makes mechanics authored from core options
- **Evidence:** [rules-engine composability audit](../handoffs/rules-engine-composability-audit-2026-10-20.md)
- **Verification:**
  - the file-size and import-fence ratchets in CI;
  - the golden compile-checksum harness over the SRD corpus;
  - a second, neutral tracer System that runs the Encounter pipeline through the adapters;
  - an authoring-parity homebrew variant in every proof.

## Context

ADR 0038 removed feature-named kinds, but each new SRD mechanic still needs engine code. The audit traced this to five structural causes:

- a compiler that dispatches on a fixed ladder of plan shapes and refuses combinations it hasn't seen;
- d20 settlement copied at about 10 sites;
- a separate pause stack for each kind of pending choice;
- no generic event hooks;
- runtime pipelines named "neutral" that import the D&D module directly.

The audit's merge-cost sample found that only 30% of engine lines were reusable seams. The 1,500-line guard proposed in D145 was deferred, and nothing replaced it.

## Decision

1. **Composition over shape ladders.** An authored effect compiles as an orthogonal composition of these pieces:
   - a test phase (attack, save, check or none);
   - outcomes from a registry, each banded by result;
   - lifetime and recurrence: ticks, repeat saves and end events, in one follow-up model;
   - targeting;
   - activation;
   - zones.

   A refusal is allowed only for invalid input or a genuine rule. A combination nobody has written before is not a reason to refuse. The compiler's modules each have one responsibility, and the System-neutral pieces live outside `systems/dnd5e`.

2. **One d20 test settlement.** A frozen d20 context, plus one function that settles an answer, adds dice, resumes and verifies the outputs. Every check, save and contest uses it.
3. **One pending-choice pause.** The action snapshot carries a single `pause: { kind, payload }` union. The pause kinds share one sealed-choice lifecycle: open, choose, settle, with checksums and undo. This covers reaction, cast reaction, on-hit, retarget, forced movement, Legendary Resistance and the D168 post-roll window. The Worker handles each pause kind in its own handler, not inline in one planner.
4. **Generic event hooks.** A typed event table drives every trigger, end or consume event and interception. Examples are attacked, damaged, cast, moved, check, save and incapacitated. The table has one discovery entry point and one dispatch site per event. A feature subscribes through authored data and never adds a call site.
5. **System seams.** A neutral runtime file reaches System behaviour through a capability registry keyed by `gameSystemId`, following the pattern in `actionEconomyCapabilityRegistry.ts`, and fails closed on an unknown System. It never imports `systems/*` directly. Vocabulary is System-supplied rather than fixed in shared code: trigger names, roll-mode influence, damage and condition lists, and lists such as creature type and alignment. Authored roll influence is one System-neutral modifier kind pair, `ROLL_INFLUENCE` and `SUPPRESS_ROLL_INFLUENCE`, whose payload names a code from the System's `rollInfluence` list (RULES-2.T9b). Concentration becomes a neutral maintenance link; the DC formula and the ability used stay D&D policy.
6. **Guards are ratchets.**
   - A non-test file over 1,500 lines fails lint unless it is in `scripts/fileSizeBudget.json`. Each listed file's current size is its cap: growth fails CI, and an entry may only shrink or be removed.
   - Imports from neutral runtime into `systems/*` work the same way: the existing list may only shrink, and any new import fails.
7. **Golden checksums gate the refactor.** Before any compiler module moves, a harness compiles every SRD authored effect and records its graph checksum and plan shape. Each refactor step keeps the harness green, or explains every changed checksum in its review and reseeds development data in the same change (pre-launch, no compatibility shims).

Multi-entry initiative stays out of scope until a feature needs it.

## Consequences

- New SRD and homebrew mechanics become data-only far more often, and engine work moves into named neutral modules that later features reuse.
- About 140 points of refactor PBIs are added to Phase 8.2. They are ranked ahead of the conversions they make cheaper. New conversion cards that lean on the compiler are held until the seams they need land; conversions already in flight finish.
- Persisted contracts change: the pause union, neutral vocabulary and the maintenance link. Development data is reseeded in the same change.
- A slice merge review now rejects a new plan shape, a per-feature call site, or a new direct `systems/*` import.
