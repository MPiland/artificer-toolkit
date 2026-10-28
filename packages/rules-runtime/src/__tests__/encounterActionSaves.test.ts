import { describe, expect, it } from 'vitest'
import {
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER,
  ACTIVATION_CODE
} from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

import { antitoxinEffect, baneEffect, blessEffect } from './antitoxinEffectFixture.js'
import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import { encounterAutoFailRequest } from '../encounterRollModeReasons.js'
import { actionD20RollRecord } from '../encounterRuleCheckRolls.js'
import { evaluateSrdCharacter, srdFeature } from '../testing/dnd5eSrdCharacter.js'
import { evaluateDnd5e2014CharacterActions } from '../systems/dnd5e/characterActions.js'
import { DND5E_TEST_OUTCOME_RULE_FACT_KEY } from '../systems/dnd5e/effectActionContracts.js'
import {
  creatureActor,
  type CreatureFeature,
  prepareCreatureAction,
  settleCreatureAction,
  srdAbilityId,
  srdConditionId,
  srdDamageTypeId
} from './encounterCreatureAction.js'

const SOURCE_ID = '00000000-0000-4000-8000-0000000d0001'
const TARGET_ID = '00000000-0000-4000-8000-0000000d0002'
const ANTITOXIN_EFFECT_ID = '00000000-0000-4000-8000-0000000d0007'
const BLESS_EFFECT_ID = '00000000-0000-4000-8000-0000000d0008'
const BANE_EFFECT_ID = '00000000-0000-4000-8000-0000000d0009'
const FEATURE_ID = '00000000-0000-4000-8000-0000000d0003'
const FRIGHTENED = srdConditionId('FRIGHTENED')

/** One single-outcome result on a save path: acid damage (fixed or dice) or a condition. */
type SavePath = {
  pathCode: typeof PATH_CODE.ON_SAVE_FAIL | typeof PATH_CODE.ON_SAVE_SUCCESS
  outcome:
    | { kind: 'DAMAGE'; amount: number }
    | { kind: 'DICE_DAMAGE'; diceConfig: string }
    | { kind: 'CONDITION'; conditionId: string }
}

/** A Creature Feature forcing one fixed-DC save of a single target. */
function saveFeature(input: {
  ability: 'DEXTERITY' | 'WISDOM' | 'INTELLIGENCE' | 'CONSTITUTION'
  dc: number
  paths: readonly SavePath[]
  damageType?: string
}) {
  return {
    id: FEATURE_ID,
    label: 'Fixture save',
    description: 'Fixture: a single-target saving-throw action.',
    order: 1,
    effects: [
      {
        id: '00000000-0000-4000-8000-0000000d0004',
        order: 1,
        invocation: {
          kind: 'ACTION' as const,
          triggerCode: TRIGGER.SAVING_THROW,
          savingThrow: {
            id: '00000000-0000-4000-8000-0000000d0005',
            dcMethod: 'FIXED_DC' as const,
            abilityDefinitionId: srdAbilityId(input.ability),
            baseDc: input.dc
          },
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: '00000000-0000-4000-8000-0000000d0006', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
        },
        paths: input.paths.map(({ pathCode, outcome }, index) => {
          const id = `00000000-0000-4000-8000-0000000d01${index}0`
          return {
            id,
            order: index + 1,
            pathCode,
            groupType: PATH_GROUP_TYPE.SINGLE,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: `${id}__result`,
              resultKind: 'SINGLE' as const,
              outcomes: [
                outcome.kind === 'CONDITION'
                  ? { id, effectKind: EFFECT_KIND.CONDITION, conditionId: outcome.conditionId }
                  : {
                      id,
                      effectKind: EFFECT_KIND.DAMAGE,
                      damageTypeId: srdDamageTypeId(input.damageType ?? 'ACID'),
                      scalingKind: 'NONE' as const,
                      ...(outcome.kind === 'DAMAGE'
                        ? { valueKind: 'FIXED' as const, amount: outcome.amount }
                        : { valueKind: 'DICE' as const, diceConfig: outcome.diceConfig })
                    }
              ]
            }
          }
        })
      }
    ]
  }
}

/** "Acid Spray": Dexterity save, 9 acid damage on a failure and an authored 4 on a success. */
const acidSpray = (dc = 13) =>
  saveFeature({
    ability: 'DEXTERITY',
    dc,
    paths: [
      { pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'DAMAGE', amount: 9 } },
      { pathCode: PATH_CODE.ON_SAVE_SUCCESS, outcome: { kind: 'DAMAGE', amount: 4 } }
    ]
  })

/** "Dread Gaze": DC 13 Wisdom; a failure takes 1d6 acid damage and is frightened. */
const dreadGaze = () =>
  saveFeature({
    ability: 'WISDOM',
    dc: 13,
    paths: [
      { pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'DICE_DAMAGE', diceConfig: '1d6' } },
      { pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'CONDITION', conditionId: FRIGHTENED } }
    ]
  })

/** "Acid Burst": a failure takes 6 acid damage and is frightened. */
const acidBurst = () =>
  saveFeature({
    ability: 'WISDOM',
    dc: 13,
    paths: [
      { pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'DAMAGE', amount: 6 } },
      { pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'CONDITION', conditionId: FRIGHTENED } }
    ]
  })

/**
 * The SRD Black Dragon Wyrmling's Acid Breath (DC 11 Dexterity, 5d8 acid, half on a success),
 * re-aimed at one target: its printed 15-foot line is dropped so the save and damage rules run alone.
 */
function acidBreath(): CreatureFeature {
  const feature = blackDragonWyrmling.features?.find(({ label }) => label.startsWith('Acid Breath'))
  const effect = feature?.effects?.[0]
  if (!feature || effect?.invocation.kind !== 'ACTION')
    throw new Error('The SRD Acid Breath action is missing.')
  const { shape, ...invocation } = effect.invocation
  void shape
  return {
    ...feature,
    effects: [
      {
        ...effect,
        invocation: {
          ...invocation,
          range: { id: effect.invocation.range.id, rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        }
      }
    ]
  }
}

/**
 * The same SRD Acid Breath with its half-on-success authored as `amountKind: 'HALF'` (the spell
 * vocabulary) instead of the monster `multiplier: 0.5`.
 */
function acidBreathAuthoredHalf(): CreatureFeature {
  const feature = acidBreath()
  return {
    ...feature,
    effects: (feature.effects ?? []).map((effect) => ({
      ...effect,
      paths: effect.paths.map((path) => {
        if (!('resultBlock' in path) || path.resultBlock.resultKind !== 'SINGLE') return path
        return {
          ...path,
          resultBlock: {
            ...path.resultBlock,
            outcomes: path.resultBlock.outcomes.map((outcome) => {
              if (outcome.effectKind !== 'DAMAGE' || outcome.multiplier !== 0.5) return outcome
              const { multiplier, ...rest } = outcome
              void multiplier
              return { ...rest, amountKind: 'HALF' as const }
            })
          }
        }
      })
    }))
  }
}

/** A Wolf target (11 HP, DEX 15 → +2, WIS 12 → +1) facing the Feature. */
async function resolve(input: {
  feature: CreatureFeature
  rolls: readonly number[]
  conditionImmunityIds?: readonly string[]
  conditionIds?: readonly string[]
  savingThrowDefinitions?: readonly unknown[]
  targetStatBlock?: typeof blackDragonWyrmling
  targetActiveEffects?: readonly ActiveRuleEffectRecord[]
}) {
  const prepared = await prepareCreatureAction({
    ...(input.targetActiveEffects ? { targetActiveEffects: input.targetActiveEffects } : {}),
    actor: creatureActor({ id: SOURCE_ID, label: 'Save Caster', features: [input.feature] }),
    target: creatureActor({
      id: TARGET_ID,
      label: 'Wolf',
      features: [],
      ...(input.targetStatBlock ? { statBlock: input.targetStatBlock } : {}),
      ...(input.conditionIds ? { conditionIds: input.conditionIds } : {}),
      ...(input.conditionImmunityIds ? { conditionImmunityIds: input.conditionImmunityIds } : {})
    }),
    featureId: input.feature.id,
    overridable: true
  })
  const binding = input.savingThrowDefinitions
    ? {
        ...prepared.binding,
        targetDerivedFacts: {
          ...prepared.binding.targetDerivedFacts,
          savingThrowDefinitions: input.savingThrowDefinitions
        }
      }
    : prepared.binding
  const { execution, mechanics } = await settleCreatureAction({
    prepared,
    binding,
    rolls: input.rolls
  })
  const target = mechanics.targetPlan.updatedActor
  if (target.kind === 'CHARACTER') throw new Error('Expected a Creature target.')
  return {
    d20: execution.d20,
    applications: execution.applications,
    hitPoints: target.currentHitPoints,
    conditionIds: readEncounterActorConditionState(target.conditions).ids
  }
}

describe('saving throw outcomes through action execution', () => {
  it('applies the full failure outcome when the total is below the DC', async () => {
    // Natural 10 + DEX 2 = 12 against DC 13.
    const result = await resolve({ feature: acidSpray(), rolls: [9] })
    expect(result.d20).toMatchObject({
      rollMode: 'NORMAL',
      derivedRollMode: 'NORMAL',
      rawFaces: [10],
      selectedNatural: 10,
      modifier: 2,
      total: 12,
      defenseOrDc: 13,
      resultPath: 'ON_SAVE_FAIL',
      contributors: []
    })
    expect(result.hitPoints).toBe(2)
  })

  it('adds a proficient Creature’s proficiency bonus to its saving throw', async () => {
    // The SRD Black Dragon Wyrmling: DEX 14 (+2) and a proficient DEX save at +2 (CR 2) is +4.
    const result = await resolve({
      feature: acidSpray(),
      rolls: [9],
      targetStatBlock: blackDragonWyrmling
    })
    expect(result.d20).toMatchObject({ selectedNatural: 10, modifier: 4, total: 14 })
    expect(result.d20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
  })

  it('leaves a Creature without a save proficiency at its ability modifier', async () => {
    // The same Wyrmling is not proficient in Intelligence saves: INT 10 is +0.
    const result = await resolve({
      feature: saveFeature({
        ability: 'INTELLIGENCE',
        dc: 13,
        paths: [{ pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'DAMAGE', amount: 9 } }]
      }),
      rolls: [9],
      targetStatBlock: blackDragonWyrmling
    })
    expect(result.d20).toMatchObject({ modifier: 0, total: 10 })
  })

  it('succeeds on a total equal to the DC and applies only the success outcome', async () => {
    // Natural 11 + DEX 2 = 13 against DC 13.
    const result = await resolve({ feature: acidSpray(), rolls: [10] })
    expect(result.d20).toMatchObject({
      selectedNatural: 11,
      total: 13,
      resultPath: 'ON_SAVE_SUCCESS'
    })
    expect(result.applications).toMatchObject([
      { kind: 'DAMAGE', requestedAmount: 4, resolvedAmount: 4, appliedAmount: 4 }
    ])
    expect(result.hitPoints).toBe(7)
  })

  it('treats a natural 20 or natural 1 on a save as just its total', async () => {
    // Natural 20 + 2 = 22 still fails DC 23; natural 1 + 2 = 3 still meets DC 3.
    const high = await resolve({ feature: acidSpray(23), rolls: [19] })
    expect(high.d20).toMatchObject({ selectedNatural: 20, total: 22, resultPath: 'ON_SAVE_FAIL' })
    expect(high.hitPoints).toBe(2)
    const low = await resolve({ feature: acidSpray(3), rolls: [0] })
    expect(low.d20).toMatchObject({ selectedNatural: 1, total: 3, resultPath: 'ON_SAVE_SUCCESS' })
    expect(low.hitPoints).toBe(7)
  })

  it('applies damage and the condition on a failure', async () => {
    // Natural 5 + WIS 1 = 6 against DC 13, then 3 on the d6.
    const result = await resolve({ feature: dreadGaze(), rolls: [4, 2] })
    expect(result.d20).toMatchObject({ total: 6, resultPath: 'ON_SAVE_FAIL' })
    expect(result.hitPoints).toBe(8)
    expect(result.conditionIds).toEqual([FRIGHTENED])
  })

  it('applies nothing on a success when no success outcome is authored', async () => {
    // Natural 12 + WIS 1 = 13 against DC 13.
    const result = await resolve({ feature: dreadGaze(), rolls: [11] })
    expect(result.d20).toMatchObject({ total: 13, resultPath: 'ON_SAVE_SUCCESS' })
    expect(result.applications).toEqual([])
    expect(result.hitPoints).toBe(11)
    expect(result.conditionIds).toEqual([])
  })

  it('blocks a condition the target is immune to but still applies the damage', async () => {
    const result = await resolve({
      feature: dreadGaze(),
      rolls: [4, 2],
      conditionImmunityIds: [FRIGHTENED]
    })
    expect(result.d20).toMatchObject({ resultPath: 'ON_SAVE_FAIL' })
    expect(result.hitPoints).toBe(8)
    expect(result.conditionIds).toEqual([])
  })

  it('applies a fixed damage outcome and a condition on the same failure result', async () => {
    // Natural 5 + WIS 1 = 6 against DC 13.
    const result = await resolve({ feature: acidBurst(), rolls: [4] })
    expect(result.d20).toMatchObject({ total: 6, resultPath: 'ON_SAVE_FAIL' })
    expect(result.hitPoints).toBe(5)
    expect(result.conditionIds).toEqual([FRIGHTENED])
  })

  it('takes the full SRD Acid Breath damage on a failed save', async () => {
    // Natural 5 + DEX 2 = 7 against DC 11, then 1 + 1 + 1 + 1 + 2 on the 5d8.
    const result = await resolve({ feature: acidBreath(), rolls: [4, 0, 0, 0, 0, 1] })
    expect(result.d20).toMatchObject({ total: 7, defenseOrDc: 11, resultPath: 'ON_SAVE_FAIL' })
    expect(result.applications).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 6 }])
    expect(result.hitPoints).toBe(5)
  })

  it('halves the SRD Acid Breath damage, rounded down, on a successful save', async () => {
    // Natural 12 + DEX 2 = 14 against DC 11, then 1 + 2 + 3 + 4 + 5 = 15 on the 5d8, halved to 7.
    const result = await resolve({ feature: acidBreath(), rolls: [11, 0, 1, 2, 3, 4] })
    expect(result.d20).toMatchObject({ total: 14, defenseOrDc: 11, resultPath: 'ON_SAVE_SUCCESS' })
    expect(result.applications).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 7 }])
    expect(result.hitPoints).toBe(4)
  })
})

describe('a half-damage success authored as an amount kind', () => {
  it('halves the SRD Acid Breath on a successful save like the authored multiplier does', async () => {
    const feature = acidBreathAuthoredHalf()
    expect(JSON.stringify(feature)).toContain('"amountKind":"HALF"')
    expect(JSON.stringify(feature)).not.toContain('"multiplier"')
    const result = await resolve({ feature, rolls: [11, 0, 1, 2, 3, 4] })
    expect(result.d20).toMatchObject({ resultPath: 'ON_SAVE_SUCCESS' })
    expect(result.applications).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 7 }])
  })

  describe('a Character mechanic stating the amount in its resolved expression', () => {
    const SPELL_ID = '00000000-0000-4000-8000-0000000d0008'
    const SPELL_EFFECT_ID = '00000000-0000-4000-8000-0000000d0009'

    /** The binding outcomes the real Character action evaluator resolves for a 5d8 save spell. */
    async function settleWithCharacterMechanic(input: {
      feature: CreatureFeature
      amount: { amountKind: 'HALF' | null; amountMultiplier: number | null }
    }) {
      const prepared = await prepareCreatureAction({
        actor: creatureActor({ id: SOURCE_ID, label: 'Save Caster', features: [input.feature] }),
        target: creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] }),
        featureId: input.feature.id,
        overridable: true
      })
      const bound = (
        prepared.binding.actionMechanic as { outcomes: Array<Record<string, unknown>> }
      ).outcomes
      const output = evaluateDnd5e2014CharacterActions({
        candidates: [],
        abilityDefinitions: [],
        spellCandidates: [],
        spellSlots: [],
        spellMechanics: [],
        proficiencies: [],
        itemAdjustments: [],
        spellcastingLocked: false,
        spellEffects: [
          {
            spellId: SPELL_ID,
            readsCastLevel: false,
            effects: [
              {
                effectId: SPELL_EFFECT_ID,
                mechanicFacts: {
                  invocation: {
                    triggerCode: 'SAVING_THROW',
                    activation: null,
                    range: { rangeKind: 'UNLIMITED', amount: null, longAmount: null, unit: null },
                    savingThrow: null,
                    reactionTrigger: null
                  },
                  outcomes: bound.map((outcome) => ({
                    kind: 'DAMAGE' as const,
                    outcomeId: outcome.outcomeId as string,
                    pathCode: outcome.pathCode as string,
                    label: null,
                    damageTypeId: outcome.damageTypeId as string,
                    valueKind: 'DICE' as const,
                    scalingKind: 'NONE' as const,
                    scalingSource: null,
                    classId: null,
                    amountKind:
                      outcome.pathCode === 'ON_SAVE_SUCCESS' ? input.amount.amountKind : null,
                    amountMultiplier:
                      outcome.pathCode === 'ON_SAVE_SUCCESS' ? input.amount.amountMultiplier : null,
                    values: [
                      {
                        level: null,
                        order: 0,
                        amount: null,
                        dice: '5d8',
                        halfHitPointsDice: null,
                        multiplier: null,
                        minimum: null,
                        maximum: null
                      }
                    ],
                    bonuses: []
                  }))
                }
              }
            ]
          }
        ],
        activeSourceIds: [],
        activeEquipmentInstanceIds: [],
        resources: [],
        modifierGroups: [],
        totalLevel: 5,
        classLevels: [],
        proficiencyBonus: 3,
        abilities: [],
        skills: [],
        spellcasting: { saveDc: 13, attackBonus: 5 }
      })
      const mechanic = output.spellReferenceMechanics.find((entry) => entry.spellId === SPELL_ID)!
        .mechanics[0]!
      const binding = {
        ...prepared.binding,
        actionMechanic: { ...prepared.binding.actionMechanic, outcomes: mechanic.outcomes }
      }
      const { mechanics } = await settleCreatureAction({
        prepared,
        binding,
        rolls: [11, 0, 1, 2, 3, 4]
      })
      const target = mechanics.targetPlan.updatedActor
      if (target.kind === 'CHARACTER') throw new Error('Expected a Creature target.')
      return target.currentHitPoints
    }

    it('applies an authored amount kind HALF once', async () => {
      expect(
        await settleWithCharacterMechanic({
          feature: acidBreathAuthoredHalf(),
          amount: { amountKind: 'HALF', amountMultiplier: null }
        })
      ).toBe(11 - 7)
    })

    it('applies an authored multiplier once', async () => {
      expect(
        await settleWithCharacterMechanic({
          feature: acidBreath(),
          amount: { amountKind: null, amountMultiplier: 0.5 }
        })
      ).toBe(11 - 7)
    })
  })

  it('still takes the full damage on a failed save', async () => {
    const result = await resolve({
      feature: acidBreathAuthoredHalf(),
      rolls: [4, 0, 0, 0, 0, 1]
    })
    expect(result.applications).toMatchObject([{ kind: 'DAMAGE', requestedAmount: 6 }])
  })
})

describe("saving throws under the saver's conditions (D94)", () => {
  it('fails a Dexterity save of a Paralyzed or Stunned target even on a natural 20', async () => {
    for (const code of ['PARALYZED', 'STUNNED']) {
      // Natural 20 + DEX 2 = 22 against DC 13, failed anyway: the d20 is still rolled.
      const result = await resolve({
        feature: acidSpray(),
        rolls: [19],
        conditionIds: [srdConditionId(code)]
      })
      expect(result.d20).toMatchObject({
        selectedNatural: 20,
        total: 22,
        resultPath: 'ON_SAVE_FAIL',
        autoFailConditionIds: [srdConditionId(code)]
      })
      expect(result.hitPoints).toBe(2)
    }
  })

  it('names the condition that failed the save on the roll card and the pre-roll request', async () => {
    const paralyzed = srdConditionId('PARALYZED')
    const { d20 } = await resolve({
      feature: acidSpray(),
      rolls: [19],
      conditionIds: [paralyzed]
    })
    if (!d20) throw new Error('Expected the save d20.')
    const card = actionD20RollRecord({
      occurrenceId: crypto.randomUUID(),
      checkIndex: 0,
      d20,
      actionLabel: 'Acid Spray',
      rollerLabel: 'Wolf',
      ruleset: {
        systemId: srdSystemRecord.id,
        code: srdSystemRecord.rulesetCode,
        version: srdSystemRecord.rulesetVersion
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      reader: 'PLAYER',
      autoFailLabels: d20.autoFailConditionIds?.map(
        (id) => srdSystemRecord.conditionTypes.find((condition) => condition.id === id)?.label ?? ''
      )
    })
    expect(card.ruleCheck).toEqual({ kind: 'SAVE_AUTO_FAIL', labels: ['Paralyzed'] })

    const labelled = encounterAutoFailRequest(
      (input) => (input.rollMode === 'AUTO_FAIL' ? ['Paralyzed'] : []),
      d20,
      null
    )
    expect(labelled).toEqual({ autoFail: [{ conditionId: paralyzed, label: 'Paralyzed' }] })
    expect(encounterAutoFailRequest(() => [], d20, null)).toEqual({})
  })

  it("rolls a Paralyzed target's Wisdom save normally", async () => {
    // Natural 13 + WIS 1 = 14 against DC 13: Paralyzed fails only Strength and Dexterity saves.
    const result = await resolve({
      feature: acidBurst(),
      rolls: [12],
      conditionIds: [srdConditionId('PARALYZED')]
    })
    expect(result.d20).toMatchObject({ total: 14, resultPath: 'ON_SAVE_SUCCESS' })
    expect(result.d20?.autoFailConditionIds).toBeUndefined()
    expect(result.hitPoints).toBe(11)
  })

  it('seals the save outcome rule into the bound facts of the TEST phase', async () => {
    const feature = acidSpray()
    const prepared = await prepareCreatureAction({
      actor: creatureActor({ id: SOURCE_ID, label: 'Save Caster', features: [feature] }),
      target: creatureActor({
        id: TARGET_ID,
        label: 'Wolf',
        features: [],
        conditionIds: [srdConditionId('PARALYZED')]
      }),
      featureId: feature.id,
      overridable: true
    })
    const { execution } = await settleCreatureAction({ prepared, rolls: [19] })
    const [test] = execution.phaseReceipts ?? []
    expect(test?.phase).toBe('TEST')
    const { plan } = prepared
    if (plan.kind !== 'TEST_OUTCOME') throw new Error('Acid Spray is a two-phase save.')
    const bind = (binding: typeof prepared.binding) =>
      prepared.adapter.bindFacts({ ...binding, published: plan.test.published }).facts
    const bound = bind(prepared.binding)
    expect(bound[DND5E_TEST_OUTCOME_RULE_FACT_KEY]).toBe('SAVE_AUTO_FAIL')
    expect(checksumRuleDocument(bound)).toBe(test?.boundFactsChecksum)
    // The TEST boundary rebinds the facts and compares this checksum, so a dropped rule is stale.
    const dropped = bind({
      ...prepared.binding,
      conditionOutcomeRules: { hitIsCritical: false, saveAutoFails: [] }
    })
    expect(dropped[DND5E_TEST_OUTCOME_RULE_FACT_KEY]).toBe('NONE')
    expect(checksumRuleDocument(dropped)).not.toBe(test?.boundFactsChecksum)
  })
  it("rolls a Restrained target's Dexterity save with disadvantage", async () => {
    // Natural 18 and 2 keep 2: 2 + DEX 2 = 4 against DC 13.
    const result = await resolve({
      feature: acidSpray(),
      rolls: [17, 1],
      conditionIds: [srdConditionId('RESTRAINED')]
    })
    expect(result.d20).toMatchObject({
      derivedRollMode: 'DISADVANTAGE',
      rawFaces: [18, 2],
      selectedNatural: 2,
      resultPath: 'ON_SAVE_FAIL'
    })
  })
})

describe('saving throw roll mode derivation', () => {
  /** A 7th-level Hunter Ranger (WIS 12) with Steel Will: advantage on saves against being frightened. */
  const steelWill = evaluateSrdCharacter({
    abilities: { WISDOM: 12 },
    classes: [{ label: 'Ranger', level: 7, subclass: 'Hunter' }],
    features: [
      srdFeature({
        owner: 'SUBCLASS',
        classLabel: 'Ranger',
        subclassLabel: 'Hunter',
        featureLabel: 'Defensive Tactics',
        level: 7,
        optionLabels: ['Steel Will']
      })
    ]
  }).output.savingThrowDefinitions
  const wisdomId = srdAbilityId('WISDOM')
  const steelWillAdvantage = steelWill.filter(
    (definition) => definition.abilityDefinitionId === wisdomId && 'conditionTypeId' in definition
  )
  /** The reasons a sealed d20 records: each contributor's identity, influence and typed source. */
  const evidenceContributors = (definitions: typeof steelWillAdvantage) =>
    definitions.flatMap((definition) =>
      definition.contributors.map(({ sourceId, grantId, domainKey, influence, source }) => ({
        sourceId,
        grantId,
        domainKey,
        influence,
        source
      }))
    )
  /** The same condition-scoped save rewritten as a disadvantage (no SRD feature grants one). */
  const frightenedDisadvantage = steelWillAdvantage.map((definition) => ({
    ...definition,
    rollMode: 'DISADVANTAGE' as const,
    contributors: definition.contributors.map((contributor) => ({
      ...contributor,
      sourceId: `${contributor.sourceId}:disadvantage`,
      influence: 'DISADVANTAGE' as const
    }))
  }))

  it('rolls two dice and keeps the higher for a save against a condition it has advantage on', async () => {
    const result = await resolve({
      feature: dreadGaze(),
      rolls: [3, 14],
      savingThrowDefinitions: steelWill
    })
    expect(steelWillAdvantage).toHaveLength(1)
    expect(result.d20).toMatchObject({
      rollMode: 'ADVANTAGE',
      derivedRollMode: 'ADVANTAGE',
      rawFaces: [4, 15],
      selectedNatural: 15,
      modifier: 1,
      total: 16,
      resultPath: 'ON_SAVE_SUCCESS',
      contributors: evidenceContributors(steelWillAdvantage)
    })
    expect(result.hitPoints).toBe(11)
    expect(result.conditionIds).toEqual([])
  })

  it('keeps the plain roll when the action imposes no condition the save is scoped to', async () => {
    const result = await resolve({
      feature: saveFeature({
        ability: 'WISDOM',
        dc: 13,
        paths: [{ pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'DAMAGE', amount: 6 } }]
      }),
      rolls: [3],
      savingThrowDefinitions: steelWill
    })
    expect(result.d20).toMatchObject({
      rollMode: 'NORMAL',
      rawFaces: [4],
      total: 5,
      contributors: [],
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(result.hitPoints).toBe(5)
  })

  it('rolls two dice and keeps the lower under a condition-scoped disadvantage', async () => {
    const result = await resolve({
      feature: dreadGaze(),
      rolls: [14, 3, 2],
      savingThrowDefinitions: steelWill
        .filter((definition) => !('conditionTypeId' in definition))
        .concat(frightenedDisadvantage)
    })
    expect(result.d20).toMatchObject({
      rollMode: 'DISADVANTAGE',
      rawFaces: [15, 4],
      selectedNatural: 4,
      total: 5,
      resultPath: 'ON_SAVE_FAIL',
      contributors: evidenceContributors(frightenedDisadvantage)
    })
    expect(result.conditionIds).toEqual([FRIGHTENED])
  })

  it('cancels advantage against disadvantage to one plain die, keeping both reasons', async () => {
    const result = await resolve({
      feature: dreadGaze(),
      rolls: [3, 2],
      savingThrowDefinitions: [...steelWill, ...frightenedDisadvantage]
    })
    expect(result.d20).toMatchObject({
      rollMode: 'NORMAL',
      derivedRollMode: 'NORMAL',
      rawFaces: [4],
      total: 5,
      resultPath: 'ON_SAVE_FAIL'
    })
    expect(result.d20?.contributors.map((contributor) => contributor.influence).sort()).toEqual([
      'ADVANTAGE',
      'DISADVANTAGE'
    ])
    expect(result.hitPoints).toBe(8)
  })
})

describe('saving throws against poison under an active Antitoxin grant', () => {
  const antitoxin = () => antitoxinEffect({ id: ANTITOXIN_EFFECT_ID, holderActorId: TARGET_ID })
  const poisonFeature = (damageType: string) =>
    saveFeature({
      ability: 'CONSTITUTION',
      dc: 13,
      damageType,
      paths: [{ pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'DAMAGE', amount: 6 } }]
    })

  it('rolls two dice and keeps the higher for a save whose failure deals poison damage', async () => {
    // Natural 4 and 15 keep 15: 15 + CON 1 = 16 against DC 13.
    const result = await resolve({
      feature: poisonFeature('POISON'),
      rolls: [3, 14],
      targetActiveEffects: [antitoxin()]
    })
    expect(result.d20).toMatchObject({
      rollMode: 'ADVANTAGE',
      rawFaces: [4, 15],
      selectedNatural: 15,
      total: 16,
      resultPath: 'ON_SAVE_SUCCESS',
      contributors: [{ sourceId: `ACTIVE_EFFECT:${ANTITOXIN_EFFECT_ID}`, influence: 'ADVANTAGE' }]
    })
    expect(result.hitPoints).toBe(11)
  })

  it('rolls the plain die for the same save without the grant', async () => {
    const result = await resolve({ feature: poisonFeature('POISON'), rolls: [3] })
    expect(result.d20).toMatchObject({ rollMode: 'NORMAL', rawFaces: [4], total: 5 })
    expect(result.hitPoints).toBe(5)
  })

  it('rolls the plain die when the failure deals damage other than poison', async () => {
    const result = await resolve({
      feature: poisonFeature('ACID'),
      rolls: [3],
      targetActiveEffects: [antitoxin()]
    })
    expect(result.d20).toMatchObject({ rollMode: 'NORMAL', rawFaces: [4], contributors: [] })
    expect(result.hitPoints).toBe(5)
  })
})

describe('saving throws under rolled-die grants (D156)', () => {
  it("adds Bless's d4 after the d20: a natural 10 + WIS 1 + 3 = 14 saves against DC 13", async () => {
    const result = await resolve({
      feature: acidBurst(),
      rolls: [9, 2],
      targetActiveEffects: [blessEffect({ id: BLESS_EFFECT_ID, holderActorId: TARGET_ID })]
    })
    expect(result.d20).toMatchObject({
      rawFaces: [10],
      total: 14,
      resultPath: 'ON_SAVE_SUCCESS',
      addedDice: [{ label: 'Bless', count: 1, faces: 4, sign: 'ADD', rolledFaces: [3] }]
    })
    expect(result.hitPoints).toBe(11)
  })

  it("subtracts Bane's d4: a natural 12 + WIS 1 - 2 = 11 fails DC 13", async () => {
    const result = await resolve({
      feature: acidBurst(),
      rolls: [11, 1],
      targetActiveEffects: [baneEffect({ id: BANE_EFFECT_ID, holderActorId: TARGET_ID })]
    })
    expect(result.d20).toMatchObject({
      rawFaces: [12],
      total: 11,
      resultPath: 'ON_SAVE_FAIL',
      addedDice: [{ label: 'Bane', sign: 'SUBTRACT', rolledFaces: [2] }]
    })
    expect(result.hitPoints).toBe(5)
    expect(result.conditionIds).toEqual([FRIGHTENED])
  })

  it('adds the die after advantage keeps one d20', async () => {
    // Natural 4 and 15 keep 15: 15 + CON 1 + 2 = 18; one d4 follows the two d20s.
    const result = await resolve({
      feature: saveFeature({
        ability: 'CONSTITUTION',
        dc: 13,
        damageType: 'POISON',
        paths: [{ pathCode: PATH_CODE.ON_SAVE_FAIL, outcome: { kind: 'DAMAGE', amount: 6 } }]
      }),
      rolls: [3, 14, 1],
      targetActiveEffects: [
        antitoxinEffect({ id: ANTITOXIN_EFFECT_ID, holderActorId: TARGET_ID }),
        blessEffect({ id: BLESS_EFFECT_ID, holderActorId: TARGET_ID })
      ]
    })
    expect(result.d20).toMatchObject({
      rollMode: 'ADVANTAGE',
      rawFaces: [4, 15],
      selectedNatural: 15,
      total: 18,
      addedDice: [{ label: 'Bless', rolledFaces: [2] }]
    })
  })
})
