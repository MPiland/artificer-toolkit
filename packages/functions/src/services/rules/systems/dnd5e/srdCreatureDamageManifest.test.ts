import { srdBaselineContent, SRD_SYSTEM_ID } from '@artificer-toolkit/db'
import { describe, expect, it } from 'vitest'

import { generateRulePathManifest } from './srdRulePathManifest.js'

type BranchExpectation = {
  feature: string
  diceConfig: string
  damageTypeId: string
}

const expectations: Record<string, BranchExpectation> = {
  Kraken: {
    feature: 'Lightning Storm',
    diceConfig: '4d10',
    damageTypeId: '00000000-0000-0000-0004-000600000000'
  },
  'Purple Worm': {
    feature: 'Tail Stinger',
    diceConfig: '12d6',
    damageTypeId: '00000000-0000-0000-0004-000900000000'
  },
  'Spirit Naga': {
    feature: 'Bite',
    diceConfig: '7d8',
    damageTypeId: '00000000-0000-0000-0004-000900000000'
  }
}

function assertTypedSaveDamageBranch(
  label: string,
  expectedCapability: 'AUTOMATIC' | 'JUDGMENT_REQUIRED',
  expectedReason: 'SUPPORTED_SYSTEM_CAPABILITY' | 'UNSUPPORTED_SYSTEM_CAPABILITY',
  nested = false
) {
  const expectation = expectations[label]
  const creature = srdBaselineContent.subjects.creatures.find(
    (candidate) => candidate.label === label
  )
  if (!expectation || !creature) throw new Error(`Missing source fixture for ${label}.`)
  const feature = creature.features?.find((candidate) => candidate.label === expectation.feature)
  if (!feature) throw new Error(`Missing ${expectation.feature} feature.`)
  const hitPath = (feature.effects ?? [])
    .find((effect) => effect.invocation.triggerCode === 'MELEE_WEAPON_ATTACK')
    ?.paths.find((path) => path.pathCode === 'ON_HIT')
  const nestedSave =
    hitPath && 'resultBlock' in hitPath
      ? hitPath.resultBlock.outcomes.find((outcome) => outcome.effectKind === 'FOLLOW_UP_SAVE')
      : undefined
  if (nested) {
    expect(nestedSave).toMatchObject({
      timing: 'IMMEDIATE',
      attempts: { kind: 'ONCE' },
      savingThrow: { dcMethod: 'FIXED_DC', baseDc: 13 }
    })
  }
  const saveEffects = (feature.effects ?? []).filter(
    (effect) => effect.invocation.triggerCode === 'SAVING_THROW'
  )
  const damageOutcomes =
    nestedSave?.effectKind === 'FOLLOW_UP_SAVE'
      ? [
          ...(nestedSave.onFailure.kind === 'OUTCOMES' ? nestedSave.onFailure.outcomes : []),
          ...(nestedSave.onSuccess.kind === 'OUTCOMES' ? nestedSave.onSuccess.outcomes : [])
        ]
      : saveEffects.flatMap((effect) =>
          effect.paths.flatMap((path) =>
            (path.pathCode === 'ON_SAVE_FAIL' || path.pathCode === 'ON_SAVE_SUCCESS') &&
            'resultBlock' in path
              ? path.resultBlock.outcomes
              : []
          )
        )
  expect(damageOutcomes).toHaveLength(2)
  expect(
    damageOutcomes.every(
      (outcome) =>
        outcome.effectKind === 'DAMAGE' &&
        'diceConfig' in outcome &&
        outcome.diceConfig === expectation.diceConfig &&
        outcome.damageTypeId === expectation.damageTypeId
    )
  ).toBe(true)
  expect(
    damageOutcomes.filter(
      (outcome) =>
        outcome.effectKind === 'DAMAGE' && 'multiplier' in outcome && outcome.multiplier === 0.5
    )
  ).toHaveLength(1)

  const manifest = generateRulePathManifest({
    content: {
      ...srdBaselineContent,
      subjects: {
        backgrounds: [],
        classes: [],
        creatures: [creature],
        equipment: [],
        feats: [],
        races: [],
        spells: [],
        vehicles: []
      }
    } as typeof srdBaselineContent,
    systemId: SRD_SYSTEM_ID,
    ledgerEntries: [
      {
        domain: 'creatures',
        id: creature.id,
        mechanicsStatus: 'COMPLETE',
        manualExceptionIds: []
      }
    ]
  })
  const leaves = manifest.leaves.filter((leaf) =>
    leaf.rootId === creature.id && nestedSave?.effectKind === 'FOLLOW_UP_SAVE'
      ? leaf.sourcePath.includes(nestedSave.id)
      : saveEffects.some((effect) => leaf.sourcePath.includes(effect.id))
  )
  expect(leaves).toHaveLength(nested ? 3 : 2)
  expect(leaves.every((leaf) => leaf.capability === expectedCapability)).toBe(true)
  expect(leaves.every((leaf) => leaf.reason === expectedReason)).toBe(true)
  expect(leaves.every((leaf) => leaf.entryPoint.outcomeKind !== 'CLOSED_RULE')).toBe(true)
  if (expectedCapability === 'AUTOMATIC') {
    expect(leaves.every((leaf) => leaf.executionPin !== null)).toBe(true)
  }
}

describe('SRD Creature typed save damage branches', () => {
  it('pins Kraken Lightning Storm as typed damage', () => {
    assertTypedSaveDamageBranch('Kraken', 'AUTOMATIC', 'SUPPORTED_SYSTEM_CAPABILITY')
  })

  it('pins Purple Worm Tail Stinger as typed damage', () => {
    assertTypedSaveDamageBranch('Purple Worm', 'AUTOMATIC', 'SUPPORTED_SYSTEM_CAPABILITY')
  })

  it('pins Spirit Naga Bite nested poison as typed damage', () => {
    assertTypedSaveDamageBranch('Spirit Naga', 'AUTOMATIC', 'SUPPORTED_SYSTEM_CAPABILITY', true)
  })

  it('normalizes Clay Golem Slam as a sequential damage and reduction effect', () => {
    const creature = srdBaselineContent.subjects.creatures.find(
      (candidate) => candidate.label === 'Clay Golem'
    )
    const feature = creature?.features?.find((candidate) => candidate.label === 'Slam')
    const slam = feature?.effects?.find(
      (effect) => effect.invocation.triggerCode === 'MELEE_WEAPON_ATTACK'
    )
    const path = slam?.paths.find((candidate) => candidate.pathCode === 'ON_HIT')
    if (!creature || !feature || !slam || !path || !('resultBlock' in path)) {
      throw new Error('Missing Clay Golem Slam source shape.')
    }

    expect(feature.effects).toHaveLength(1)
    expect(path.groupType).toBe('SEQUENTIAL')
    expect(path.resultBlock.resultKind).toBe('SEQUENCE')
    expect(path.resultBlock.outcomes).toHaveLength(2)

    const [damage, save] = path.resultBlock.outcomes
    expect(damage).toMatchObject({
      effectKind: 'DAMAGE',
      diceConfig: '2d10',
      damageTypeId: '00000000-0000-0000-0004-000200000000'
    })
    expect(save).toMatchObject({
      effectKind: 'FOLLOW_UP_SAVE',
      timing: 'IMMEDIATE',
      attempts: { kind: 'ONCE' },
      savingThrow: {
        dcMethod: 'FIXED_DC',
        baseDc: 15,
        abilityDefinitionId: '00000000-0000-0000-0011-000300000000'
      },
      onSuccess: { kind: 'END' }
    })
    if (save.effectKind !== 'FOLLOW_UP_SAVE') throw new Error('Expected Clay follow-up save.')
    expect(save.onFailure).toMatchObject({
      kind: 'OUTCOMES',
      endCurrent: true,
      resultKind: 'SINGLE'
    })
    if (save.onFailure.kind !== 'OUTCOMES') throw new Error('Expected Clay failure outcomes.')
    expect(save.onFailure.outcomes).toEqual([
      {
        id: expect.any(String),
        effectKind: 'HIT_POINT_MAXIMUM_REDUCTION',
        amountSource: { kind: 'DAMAGE_TAKEN', damageOutcomeId: damage.id },
        recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM']
      }
    ])

    const manifest = generateRulePathManifest({
      content: {
        ...srdBaselineContent,
        subjects: {
          backgrounds: [],
          classes: [],
          creatures: [creature],
          equipment: [],
          feats: [],
          races: [],
          spells: [],
          vehicles: []
        }
      } as typeof srdBaselineContent,
      systemId: SRD_SYSTEM_ID,
      ledgerEntries: [
        {
          domain: 'creatures',
          id: creature.id,
          mechanicsStatus: 'COMPLETE',
          manualExceptionIds: []
        }
      ]
    })
    const leaves = manifest.leaves.filter((leaf) => leaf.sourcePath.includes(slam.id))
    expect(leaves.length).toBeGreaterThan(0)
    expect(leaves.every((leaf) => leaf.capability === 'AUTOMATIC')).toBe(true)
    expect(leaves.every((leaf) => leaf.executionPin !== null)).toBe(true)
  })

  it('normalizes Balor Whip as one nested damage, save, and forced-movement effect', () => {
    const creature = srdBaselineContent.subjects.creatures.find(
      (candidate) => candidate.label === 'Balor'
    )
    const feature = creature?.features?.find((candidate) => candidate.label === 'Whip')
    const whip = feature?.effects?.find(
      (effect) => effect.invocation.triggerCode === 'MELEE_WEAPON_ATTACK'
    )
    const path = whip?.paths.find((candidate) => candidate.pathCode === 'ON_HIT')
    if (!creature || !feature || !whip || !path || !('resultBlock' in path)) {
      throw new Error('Missing Balor Whip source shape.')
    }
    expect(feature.effects).toHaveLength(1)
    expect(path.groupType).toBe('SEQUENTIAL')
    expect(path.resultBlock.resultKind).toBe('SEQUENCE')
    expect(path.resultBlock.outcomes).toHaveLength(3)
    const [slashing, fire, save] = path.resultBlock.outcomes
    expect(slashing).toMatchObject({
      effectKind: 'DAMAGE',
      diceConfig: '2d6',
      damageTypeId: '00000000-0000-0000-0004-000c00000000'
    })
    expect(fire).toMatchObject({
      effectKind: 'DAMAGE',
      diceConfig: '3d6',
      damageTypeId: '00000000-0000-0000-0004-000400000000'
    })
    expect(save).toMatchObject({
      effectKind: 'FOLLOW_UP_SAVE',
      timing: 'IMMEDIATE',
      attempts: { kind: 'ONCE' },
      savingThrow: {
        dcMethod: 'FIXED_DC',
        baseDc: 20,
        abilityDefinitionId: '00000000-0000-0000-0011-000100000000'
      },
      onSuccess: { kind: 'END' }
    })
    if (save.effectKind !== 'FOLLOW_UP_SAVE' || save.onFailure.kind !== 'OUTCOMES')
      throw new Error('Expected Balor follow-up save failure outcome.')
    expect(save.onFailure.outcomes).toEqual([
      {
        id: expect.any(String),
        effectKind: 'FORCED_MOVEMENT',
        direction: 'TOWARD_SOURCE',
        actionEconomy: 'NONE',
        distanceMode: 'FIXED_DISTANCE',
        amount: 25,
        unit: 'FEET'
      }
    ])
    const manifest = generateRulePathManifest({
      content: {
        ...srdBaselineContent,
        subjects: {
          backgrounds: [],
          classes: [],
          creatures: [creature],
          equipment: [],
          feats: [],
          races: [],
          spells: [],
          vehicles: []
        }
      } as typeof srdBaselineContent,
      systemId: SRD_SYSTEM_ID,
      ledgerEntries: [
        {
          domain: 'creatures',
          id: creature.id,
          mechanicsStatus: 'COMPLETE',
          manualExceptionIds: []
        }
      ]
    })
    const leaves = manifest.leaves.filter((leaf) => leaf.sourcePath.includes(whip.id))
    expect(leaves.length).toBeGreaterThan(0)
    expect(leaves.every((leaf) => leaf.capability === 'AUTOMATIC')).toBe(true)
    expect(leaves.every((leaf) => leaf.executionPin !== null)).toBe(true)
    expect(leaves.every((leaf) => leaf.entryPoint.outcomeKind !== 'CLOSED_RULE')).toBe(true)
  })
})
