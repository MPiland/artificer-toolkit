# Character engine

> Status: canonical (current working-tree baseline)
>
> Scope: snapshot assembly, compiled registry, pure resolution, `RulesSystem`, and derived output
>
> Update when: engine input/output, rule ordering, resolver stages, or a system implementation changes
>
> Verification: `packages/shared/src/domains/engine/kernel.ts`, `snapshot.ts`, `registry.ts`, `contracts/rulesSystem.ts`, `domains/engine/dnd5e2014`, and engine tests

The engine turns an ephemeral `CharacterBuildSnapshot` plus a caller-populated `CharacterAssemblyRegistry` and `RulesSystem` into deterministic derived play data. It is not a repository and it does not own persistence.

```mermaid
flowchart LR
  Authored[Character authored intent/state] --> Snap[CharacterBuildSnapshot]
  Adjustments[Typed Sheet adjustments] --> Snap
  Content[Compiled content] --> Reg[CharacterAssemblyRegistry]
  Snap --> Kernel[runEngine(snapshot, registry, rules)]
  Reg --> Kernel
  Rules[RulesSystem\nordering + arithmetic + stacking] --> Kernel
  Kernel --> Output[EngineCharacterOutput\nstats, proficiencies, slots, resources, senses]
```

## Inputs

`CharacterBuildSnapshot` contains D&D-5e-family character inputs: identity/system, total level, race/background/classes, base ability scores, ordered per-level hit points with explicit class identity and class level, active features with provenance/timing/selections, chosen grant selections, carried inventory items with compiled forms plus equipped/attuned state, typed mechanical adjustments, movement-display preference, stable spell sources, and companion calculation inputs. Active features include structurally granted class, subclass, race, ancestry, and background features even when no redundant acquisition row is needed. It is assembled fresh and never persisted. Each class entry represents one base-class progression and carries an optional `subclassId`; subclasses are not duplicate pseudo-class rows. Sheet assembly consumes the persisted hit-point order directly and never rebuilds it from grouped class totals.

Chosen grants are addressed by grant ID, progression level, and stable provenance identity. Reusing one authored grant under multiple classes, features, or options must never let one owner's selection satisfy another owner. A selected feature option uses the character feature-acquisition ID plus option ID as its grant provenance.

Current structural selections use stable authored-definition IDs and resolve against active content. Equipment snapshot entries additionally carry an explicit `ContentRef` with system ID and `ACTIVE` binding plus the compiled item. Other exact compiled inputs are supplied through the assembly registry. Persisted revision pinning is target work, not a current snapshot guarantee.

`CharacterAssemblyRegistry` contains compiled classes, races, backgrounds, features, feats, equipment, spell and grant material, and optional system references. The caller loads it (normally through DB repositories/functions); engine and assembly functions are pure readers. Ordered active spell groups are backend Sheet projection output, not registry contents. For each projected active spell group, authored `SPELL_CAST_LEVEL` scaling is the explicit intersection of the spell's legal cast levels and the source's available slot levels. Contextual `TO_HIT` and `SAVE_DC` targets are mutually exclusive; `DAMAGE` targets are bonus-only.

`RulesSystem` injects D&D-5e-family policy such as proficiency/ability arithmetic, passive checks, movement-display selection, modifier stacking configuration, grant application order, and feature-source order. `dnd5e2014RulesSystem` is the first implementation. This keeps the current 5e engine pure and policy-driven; it does not make its class, spell-slot, armor-class, rest, and proficiency contracts universal across unrelated game systems.

## Resolution order

`runEngine` resolves spell grants, applies class/subclass/background/feature/feat and eligible equipment grants, filters equipment by character restrictions and attunement requirements, resolves source-aware modifier stacking, applies typed Sheet adjustments, calculates dependent derived stats, resolves spell slots and class resources, and records active item contributions. The first class applies its normal proficiency grants; later base classes apply only their authored multiclass proficiency grants while retaining level-appropriate class and subclass features. D&D ordering details are in `packages/shared/src/domains/engine/dnd5e2014/RULE_ORDER.md`.

The output includes derived ability scores/modifiers, saving throws, skills, passive checks, movement, initiative, armor class, max hit points, proficiencies, senses, spell state/slots, resources, per-source spell mechanics, per-instance item mechanics, companion stats, and source-aware calculation breakdowns. Re-running identical inputs must produce identical output.

## Sheet adjustments and calculation provenance

Application orchestration projects persisted adjustments through `toCharacterMechanicalAdjustment` before snapshot assembly. That projection deliberately removes character ownership, optional `sourceNote`, actors, and timestamps. The engine receives only stable adjustment identity, typed target, and mechanical value.

Each calculation returns its effective value and breakdown from the same pure resolver. Authored, equipment, and feature contributions retain stable mechanical provenance in the breakdown; manual additions participate in normal calculation; an absolute target override is applied last and marks retained contributions as suppressed. Removing the override restores the current authored and additive result without restoring a cached total. Adjusted abilities feed saves, skills, passives, spell values, Constitution-derived maximum HP, and ability-based resource maxima. Repeated spells are keyed by source identity, while items and companions are keyed by owned-instance UUID.

Calculation output is never persisted. Dice-based recovery receives an injected `CharacterDiceRandomSource`; production callers supply a cryptographically secure implementation while tests may supply a deterministic source.

## Rules-system and encounter boundaries

Application orchestration resolves the system's `rulesetCode` and `rulesetVersion` through the fail-closed rules registry before calling the engine. An unsupported identity is an error, never a fallback to D&D.

The registry is the extension seam. Another D&D-5e-family ruleset may reuse this kernel when its contracts fit. A materially different game should register a system-specific engine adapter with its own snapshot/output contracts instead of adding cross-system conditionals to the current kernel.

Future VTT encounter sequencing belongs in a separate encounter/event application module. Encounter commands may assemble actor snapshots and invoke pure rule functions, but the character engine does not persist rolls, targets, turns, or outcomes.
