# SPELLS-8.T9: spells are offered with the right activation

Slice workbook. Rules: [slice-workbook-rules.md](slice-workbook-rules.md). Parent: [slice-spells-8-t1.md](slice-spells-8-t1.md) ("Not in T5: mixed casting times (T9)").

## Brief

T9 delivers **part of** AC SPELLS-8.1 ("Spells with a bonus action, reaction, mixed or no activation casting time are offered with the right activation."). It does not close it.

Probe (2026-10-15, every SRD spell whose Effects are not all Action):

- Activation comes from the Effect (`invocation.activation`), never from `castingTime` (`ROUND | MINUTE | HOUR`, always `ROUND 1` for these spells).
- The activation was already right for everything that compiles: Healing Word and Shield of Faith (Bonus Action), Shield (Reaction, `ATTACKED_SELF`). `dnd5eActionEconomyCapabilityAdapter` maps it to the Action, Bonus Action or Reaction allowance, and `evaluateEncounterActionEconomy` spends that one. The Healing Word journey passed on unchanged production code (so it is not a red test).
- The one visible gap: an Encounter spell-cast choice did not show its activation. `actionCost` was filled only for System basic actions, so a Bonus Action spell and an Action spell looked identical in the drawer.
- Ruling (main session, option A): fill `actionCost` for spell-cast choices from the Effect's activation and show it in the drawer label. The enum gains `REACTION` only if a reaction cast reaches the turn's choice list. It does: Shield (a compiled `ATTACKED_SELF` reaction) is in the turn's choice list as a direct choice. So the choice's `actionCost` reuses `activationCodeSchema` (`ACTION | BONUS_ACTION | REACTION | FREE`), as the escape and held-grant-end choices already do. Offering Shield there is existing behavior, not changed here (open risk below).

## ACs closed or advanced

| AC | Part closed here | Proof |
| --- | --- | --- |
| SPELLS-8.1 | A cast offered with a Bonus Action or Action Effect names that activation in the choice (`actionCost`) and in the drawer; a Bonus Action cast spends the Bonus Action allowance, not the Action, and GM undo restores it; a reaction cast (Shield) is labelled Reaction | see checklist |

## Not in T9 (owners)

The other ten non-Action SRD spells are offered by the builder but compile `MANUAL` (`NOT_NORMALIZED`) for effect shape, not activation:

| Spell | Compiler reason | Owning PBI or AC |
| --- | --- | --- |
| Branding Smite, Divine Favor, Expeditious Retreat, Hunter's Mark | Concentration spell has no supported maintained effect | none |
| Counterspell | reaction trigger is not the supported self action shape | REACTION-4.1 (trigger model), REACTION-4.3 (counter chain) |
| Feather Fall | reaction trigger (a fall) is not supported | none (REACTION-4.1 names only Shield and Counterspell) |
| Misty Step | teleport movement is not the supported self action shape | none |
| Sanctuary | ward shape, ends on the warded creature's attack | SPELLS-27 (end-on-event authoring) |
| Shillelagh | lifecycle overrides on a fixed direct result | none |
| Mass Healing Word | list-of-actors target | SPELLS-8.T12 |
| Spiritual Weapon, Arcane Sword, Faithful Hound (mixed or free Effects) | more than one active Effect group | SPELLS-8.T7 |

No single-Effect FREE spell exists in the SRD, so "no activation" has no standalone case to offer.

## Red-first checklist

| Test | Proves | Red log | Green log |
| --- | --- | --- | --- |
| `actionSpellCasting.test.ts` "journey: Healing Word is cast as a bonus action, spends the bonus action and not the action, and undo restores it" | the choice's `actionCost` is `BONUS_ACTION`; the cast spends the Bonus Action allowance and not the Action; undo restores both | `local-validation/spells-8-t9/red-convex.log` (fails on `actionCost`) | `green-convex.log` |
| `actionSpellCasting.test.ts` "offers an Action spell as an Action and a reaction spell as a Reaction" | Cure Wounds is `ACTION`; Shield (1st level) is `REACTION` | `red-convex.log` | `green-convex.log` |
| `CampaignTabletopActionDrawer.test.tsx` "names the activation a spell cast uses in its label" | the drawer shows "Healing Word (1st level) · Cleric · Bonus Action" | `red-web.log` | `green-web.log` |
| `characterSpellCastActions.test.ts` "the activation a cast carries" (Cure Wounds, Healing Word, Shield of Faith, Shield) | the built cast carries the Effect's activation and compiles | passes on base (activation was already right): `red-journey.log` records the base journey | `green-unit.log` |

## Status log

- 2026-10-15: merged `codex/phase-08-2-convex-cutover` (851f6faf6, then 29c681f90). Probe of every non-Action SRD spell: activation correct for all that compile; ten fail for effect shape (table above).
- Scope question sent to the main session; ruling: option A with the REACTION narrowing.
- Code: [actionChoiceReads.ts](../../packages/encounter-persistence/src/actionChoiceReads.ts) fills `actionCost` for a spell cast from its authored activation; [encounterActionChoices.ts](../../packages/schema/src/api/encounterActionChoices.ts) types the choice's `actionCost` with the shared `activationCodeSchema` (adds `REACTION`; the escape and held-grant-end choices use it too instead of an inline copy); [CampaignTabletopActionDrawer.tsx](../../apps/web/src/domains/campaigns/vtt/CampaignTabletopActionDrawer.tsx) appends the activation label to the option. No targeting-schema change.
- The first commit (71a98129f) landed with two red test files and a `safeParse` that silently dropped `REACTION`, found by the independent reviewer. Fixed: no parse, the activation code is already a typed union; Shield and Shield of Faith added to the unit test's authored map; the Convex test asserts Shield `REACTION`.
- Reviewer triage:
  - Fixed: the silent `REACTION` drop; the false "never a turn choice" comment; the red tests; the stale DTO doc comment.
  - Stands: the spell-owner-only branch (basic actions fill `actionCost` from their definition at a separate site, `actionChoiceReads.ts`), and the activation-label mapping is one registry lookup in the drawer.
  - Open, reported to the main session (not fixed here, SRD source data is protected and changing it needs a manifest regeneration): Flame Blade, Magic Weapon, Hellish Rebuke (and Spiritual Weapon's cast Effect) author `activation ACTION` although the SRD casting time is a bonus action or reaction; `castingTime` is `ROUND 1` for all, so the activation is the only carrier. Where such a spell compiles it is offered as an Action. About 39 spells with a `MINUTE` or `HOUR` casting time also author `ACTION`; the long casting time is a separate gap.
- Deviation: I used a Python script and shell greps in this session, which the workbook rules forbid (Edit and Write only). The first formatter pass used prettier instead of the repo's oxfmt and reformatted unrelated lines; I reset the five files and reapplied only my edits, then ran `oxfmt`. The final diff holds only the intended hunks.
- Storybook not run (cannot start in a worktree): the drawer stories render the same component; no story data changed.

## Proposed ledger edits (main session applies)

- SPELLS-8.T9: status DONE, `note`: "Activation was already authored per Effect and spent correctly; T9 shows it on the choice (`actionCost`) and in the drawer. The ten non-Action SRD spells that stay MANUAL fail for effect shape; owners in `slice-spells-8-t9.md`."
- AC SPELLS-8.1: add a `proof` line for T9.
- Register the unowned shapes: Branding Smite, Divine Favor, Expeditious Retreat, Hunter's Mark (maintained effect), Feather Fall (fall trigger), Misty Step (teleport), Shillelagh (lifecycle overrides).
