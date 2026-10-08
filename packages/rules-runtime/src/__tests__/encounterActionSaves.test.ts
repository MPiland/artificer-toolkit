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
import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'

import { readEncounterActorConditionState } from '../encounterCharacterMechanicsBatch.js'
import { evaluateSrdCharacter, srdFeature } from './dnd5eSrdCharacter.js'
import { DND5E_TEST_OUTCOME_RULE_FACT_KEY } from '../systems/dnd5e/effectActionCompiler.js'
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
  ability: 'DEXTERITY' | 'WISDOM'
  dc: number
  paths: readonly SavePath[]
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
                      damageTypeId: srdDamageTypeId('ACID'),
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
 * aimed at one target: the Encounter does not run its 15-foot line area yet.
 */
function acidBreath(): CreatureFeature {
  const feature = blackDragonWyrmling.features?.find(({ label }) => label.startsWith('Acid Breath'))
  const effect = feature?.effects?.[0]
  if (!feature || effect?.invocation.kind !== 'ACTION')
    throw new Error('The SRD Acid Breath action is missing.')
  return {
    ...feature,
    effects: [
      {
        ...effect,
        invocation: {
          ...effect.invocation,
          range: { id: effect.invocation.range.id, rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        }
      }
    ]
  }
}

/** A Wolf target (11 HP, DEX 15 → +2, WIS 12 → +1) facing the Feature. */
async function resolve(input: {
  feature: CreatureFeature
  rolls: readonly number[]
  conditionImmunityIds?: readonly string[]
  conditionIds?: readonly string[]
  savingThrowDefinitions?: readonly unknown[]
}) {
  const prepared = await prepareCreatureAction({
    actor: creatureActor({ id: SOURCE_ID, label: 'Save Caster', features: [input.feature] }),
    target: creatureActor({
      id: TARGET_ID,
      label: 'Wolf',
      features: [],
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

describe('saving throws under the saver\'s conditions (D94)', () => {
  it('fails a Dexterity save of a Paralyzed or Stunned target even on a natural 20', async () => {
    for (const code of ['PARALYZED', 'STUNNED']) {
      // Natural 20 + DEX 2 = 22 against DC 13, failed anyway: the d20 is still rolled.
      const result = await resolve({
        feature: acidSpray(),
        rolls: [19],
        conditionIds: [srdConditionId(code)]
      })
      expect(result.d20).toMatchObject({ selectedNatural: 20, total: 22, resultPath: 'ON_SAVE_FAIL' })
      expect(result.hitPoints).toBe(2)
    }
  })

  it('rolls a Paralyzed target\'s Wisdom save normally', async () => {
    // Natural 13 + WIS 1 = 14 against DC 13: Paralyzed fails only Strength and Dexterity saves.
    const result = await resolve({
      feature: acidBurst(),
      rolls: [12],
      conditionIds: [srdConditionId('PARALYZED')]
    })
    expect(result.d20).toMatchObject({ total: 14, resultPath: 'ON_SAVE_SUCCESS' })
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
      conditionOutcomeRules: { hitIsCritical: false, saveAutoFailAbilityIds: [] }
    })
    expect(dropped[DND5E_TEST_OUTCOME_RULE_FACT_KEY]).toBe('NONE')
    expect(checksumRuleDocument(dropped)).not.toBe(test?.boundFactsChecksum)
  })
  it('rolls a Restrained target\'s Dexterity save with disadvantage', async () => {
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
  /** The reasons a sealed d20 records: each contributor's identity and influence. */
  const evidenceContributors = (definitions: typeof steelWillAdvantage) =>
    definitions.flatMap((definition) =>
      definition.contributors.map(({ sourceId, grantId, domainKey, influence }) => ({
        sourceId,
        grantId,
        domainKey,
        influence
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
