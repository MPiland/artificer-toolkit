import { describe, expect, it } from 'vitest'

import type { CombatPerceptionContributionDto } from '@artificer-toolkit/schema/shared/combatPerception'
import type { PinnedConditionRuleStateDefinitionDto } from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  deriveCombatPerceptionContributionPartitions,
  deriveConditionCombatPerceptionContributions,
  type LockedCombatPerceptionEffect
} from './encounterCombatPerceptionContributions.js'

const effectId = '11111111-1111-4111-8111-111111111111'
const secondEffectId = '22222222-2222-4222-8222-222222222222'
const contributionId = '33333333-3333-4333-8333-333333333333'

function contribution(
  kind: 'SENSE_SUPPRESS' | 'EMISSION_SUPPRESS' | 'ILLUMINATION_EFFECT',
  id = contributionId
): CombatPerceptionContributionDto {
  if (kind === 'SENSE_SUPPRESS')
    return { id, order: 0, kind, senseDefinitionIds: [], channels: ['VISUAL'] }
  if (kind === 'EMISSION_SUPPRESS')
    return { id, order: 0, kind, channels: ['VISUAL'], bypass: 'INVISIBILITY' }
  return {
    id,
    order: 0,
    kind,
    illumination: 'MAGICAL_DARKNESS',
    obscurement: 'HEAVY',
    precedence: 10
  }
}

function effect(
  id: string,
  createdOrdinal: number,
  perceptionContributions: CombatPerceptionContributionDto[]
): LockedCombatPerceptionEffect {
  return {
    id,
    version: 2,
    createdOrdinal,
    definitionChecksum: 'a'.repeat(64),
    definition: { perceptionContributions }
  }
}

describe('Encounter combat-perception contribution partitioning', () => {
  const sceneGrid = {
    kind: 'SQUARE' as const,
    cellSize: 50,
    diagonalPolicy: 'EQUAL' as const,
    distancePerCell: 5,
    origin: { x: 0, y: 0 },
    unit: 'FEET' as const
  }

  it('derives exact relation arrays without carrying unrelated contribution kinds', () => {
    const mixed = effect(effectId, 4, [
      contribution('SENSE_SUPPRESS'),
      contribution('EMISSION_SUPPRESS', '33333333-3333-4333-8333-333333333334'),
      contribution('ILLUMINATION_EFFECT', '33333333-3333-4333-8333-333333333335')
    ])

    const result = deriveCombatPerceptionContributionPartitions({
      sceneGrid,
      observerEffects: [mixed],
      subjectEffects: [mixed],
      localAreaEffects: [mixed]
    })

    expect(result.observerContributions.map((source) => source.contribution.kind)).toEqual([
      'SENSE_SUPPRESS'
    ])
    expect(result.subjectContributions.map((source) => source.contribution.kind)).toEqual([
      'EMISSION_SUPPRESS'
    ])
    expect(result.localAreaContributions.map((source) => source.contribution.kind)).toEqual([
      'ILLUMINATION_EFFECT'
    ])
  })

  it('derives distinct deterministic runtime instance IDs for repeated authored contributions', () => {
    const repeated = contribution('SENSE_SUPPRESS')
    const first = effect(effectId, 2, [repeated])
    const second = effect(secondEffectId, 1, [repeated])

    const once = deriveCombatPerceptionContributionPartitions({
      sceneGrid,
      observerEffects: [first, second],
      subjectEffects: [],
      localAreaEffects: []
    }).observerContributions
    const reordered = deriveCombatPerceptionContributionPartitions({
      sceneGrid,
      observerEffects: [second, first],
      subjectEffects: [],
      localAreaEffects: []
    }).observerContributions

    expect(once).toEqual(reordered)
    expect(once.map((source) => source.source)).toEqual([
      expect.objectContaining({ activeEffectId: secondEffectId }),
      expect.objectContaining({ activeEffectId: effectId })
    ])
    expect(new Set(once.map((source) => source.instanceId)).size).toBe(2)
    expect(once[0]).toMatchObject({
      source: {
        kind: 'ACTIVE_EFFECT',
        activeEffectVersion: 2,
        activeEffectDefinitionChecksum: 'a'.repeat(64)
      },
      sourceOrdinal: 1,
      contribution: repeated
    })
  })

  it('keeps UUID-backed condition revision identity distinct from active effects', () => {
    const condition: PinnedConditionRuleStateDefinitionDto = {
      conditionDefinitionId: '44444444-4444-4444-8444-444444444444',
      definitionVersion: 3,
      definitionContractVersion: 1,
      definitionChecksum: 'b'.repeat(64),
      document: {
        schemaVersion: 1,
        kind: 'CONDITION_RULE_STATE',
        id: '44444444-4444-4444-8444-444444444444',
        gameSystemId: '66666666-6666-4666-8666-666666666666',
        capabilitySuppressions: [],
        perceptionContributions: [contribution('SENSE_SUPPRESS')]
      }
    }
    const observer = deriveConditionCombatPerceptionContributions({
      conditionDefinitions: [condition],
      relation: 'OBSERVER',
      sceneGrid
    })
    expect(observer).toEqual([
      expect.objectContaining({
        source: {
          kind: 'CONDITION_DEFINITION',
          conditionDefinitionId: condition.conditionDefinitionId,
          conditionDefinitionVersion: 3,
          conditionDefinitionChecksum: 'b'.repeat(64)
        },
        contribution: expect.objectContaining({ kind: 'SENSE_SUPPRESS' })
      })
    ])
    expect(
      deriveConditionCombatPerceptionContributions({
        conditionDefinitions: [condition],
        relation: 'SUBJECT',
        sceneGrid
      })
    ).toEqual([])
  })

  it('converts sense-grant ranges to Scene units and rejects a non-length unit', () => {
    const document = {
      schemaVersion: 1 as const,
      kind: 'SENSE' as const,
      id: '55555555-5555-4555-8555-555555555555',
      gameSystemId: '66666666-6666-4666-8666-666666666666',
      capabilities: [
        {
          channel: 'VISUAL' as const,
          accessGrade: 'PRECISE' as const,
          satisfies: ['SEE' as const],
          illuminationAccess: 'DIM' as const,
          obscurementAccess: 'NONE' as const,
          perceivesInvisible: false,
          physicalConstraints: []
        }
      ]
    }
    const grant: CombatPerceptionContributionDto = {
      id: contributionId,
      order: 0,
      kind: 'SENSE_GRANT',
      senseDefinitionId: document.id,
      definitionVersion: 1,
      definitionContractVersion: 1,
      definitionChecksum: checksumRuleDocument(document),
      document,
      range: { amount: 30, unit: 'FEET' }
    }
    const metricGrid = { ...sceneGrid, unit: 'METERS' as const }
    const converted = deriveCombatPerceptionContributionPartitions({
      sceneGrid: metricGrid,
      observerEffects: [effect(effectId, 1, [grant])],
      subjectEffects: [],
      localAreaEffects: []
    })
    expect(converted.observerContributions[0]?.contribution).toMatchObject({
      kind: 'SENSE_GRANT',
      range: 9.144
    })
    expect(() =>
      deriveCombatPerceptionContributionPartitions({
        sceneGrid,
        observerEffects: [effect(effectId, 1, [{ ...grant, range: { amount: 30, unit: 'CUPS' } }])],
        subjectEffects: [],
        localAreaEffects: []
      })
    ).toThrow(/not a supported Scene length unit/)
    expect(() =>
      deriveCombatPerceptionContributionPartitions({
        sceneGrid,
        observerEffects: [
          effect(effectId, 1, [{ ...grant, range: { amount: Number.MAX_VALUE, unit: 'MILES' } }])
        ],
        subjectEffects: [],
        localAreaEffects: []
      })
    ).toThrow(/overflowed/)
  })
})
