import { describe, expect, it } from 'vitest'

import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SenseReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/combatPerception'
import type { PinnedConditionRuleStateDefinitionDto } from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { resolveEncounterCombatPerception } from './encounterCombatPerception.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../rules/systems/dnd5e/effectActionCompiler.js'
import {
  deriveConditionCombatPerceptionContributions,
  type LockedCombatPerceptionEffect
} from './encounterCombatPerceptionContributions.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000001',
  darkvision: '00000000-0000-4000-8000-000000000002',
  blindsight: '00000000-0000-4000-8000-000000000003',
  effect: '00000000-0000-4000-8000-000000000004',
  contribution: '00000000-0000-4000-8000-000000000005',
  subjectEffect: '00000000-0000-4000-8000-000000000006',
  subjectContribution: '00000000-0000-4000-8000-000000000007',
  system: '00000000-0000-4000-8000-000000000008'
}

const grid = {
  kind: 'SQUARE',
  cellSize: 100,
  diagonalPolicy: 'EQUAL',
  distancePerCell: 5,
  origin: { x: 0, y: 0 },
  unit: 'FEET'
} as const

function senseDocument(input: {
  id: string
  channel: 'VISUAL' | 'NONVISUAL'
  illuminationAccess: 'ORDINARY_DARKNESS' | 'IGNORE'
  perceivesInvisible: boolean
}): SenseReusableDefinitionDocumentDto {
  return {
    schemaVersion: 1,
    kind: 'SENSE',
    id: input.id,
    gameSystemId: ids.system,
    capabilities: [
      {
        channel: input.channel,
        accessGrade: 'PRECISE',
        satisfies: ['SEE'],
        illuminationAccess: input.illuminationAccess,
        obscurementAccess: 'IGNORE',
        perceivesInvisible: input.perceivesInvisible,
        physicalConstraints: ['LINE_OF_EFFECT']
      }
    ]
  }
}

function pin(document: SenseReusableDefinitionDocumentDto): PinnedSenseDefinition {
  return {
    senseDefinitionId: document.id,
    definitionVersion: 1,
    definitionContractVersion: 1,
    definitionChecksum: checksumRuleDocument(document),
    document,
    range: {
      id: document.id,
      amount: 60,
      unit: 'FEET',
      calculation: { base: 60, effective: 60, contributions: [], override: null }
    }
  }
}

function effect(
  id: string,
  contribution: NonNullable<
    LockedCombatPerceptionEffect['definition']['perceptionContributions']
  >[number]
): LockedCombatPerceptionEffect {
  return {
    id,
    version: 1,
    createdOrdinal: 1,
    definitionChecksum: 'a'.repeat(64),
    definition: { perceptionContributions: [contribution] }
  }
}

function condition(input: {
  id: string
  contribution: NonNullable<
    PinnedConditionRuleStateDefinitionDto['document']['perceptionContributions']
  >[number]
}): PinnedConditionRuleStateDefinitionDto {
  return {
    conditionDefinitionId: input.id,
    definitionVersion: 1,
    definitionContractVersion: 1,
    definitionChecksum: 'b'.repeat(64),
    document: {
      schemaVersion: 1,
      kind: 'CONDITION_RULE_STATE',
      id: input.id,
      gameSystemId: ids.system,
      capabilitySuppressions: [],
      perceptionContributions: [input.contribution]
    }
  }
}

const darkvision = senseDocument({
  id: ids.darkvision,
  channel: 'VISUAL',
  illuminationAccess: 'ORDINARY_DARKNESS',
  perceivesInvisible: false
})
const blindsight = senseDocument({
  id: ids.blindsight,
  channel: 'NONVISUAL',
  illuminationAccess: 'IGNORE',
  perceivesInvisible: true
})

function evaluate(input: {
  observerEffects?: readonly LockedCombatPerceptionEffect[]
  subjectEffects?: readonly LockedCombatPerceptionEffect[]
}) {
  return resolveEncounterCombatPerception({
    requirement: 'SEE',
    observerActorId: ids.actor,
    scene: {
      ambientIllumination: 'MAGICAL_DARKNESS',
      barriers: [],
      darknessZones: [],
      doorStates: {},
      grid,
      lights: []
    },
    sceneGrid: grid,
    observerToken: { height: 100, position: { x: 50, y: 50 }, width: 100 },
    subjectToken: { height: 100, position: { x: 250, y: 50 }, width: 100 },
    pinnedSenseDefinitions: [pin(darkvision)],
    observerEffects: input.observerEffects ?? [],
    subjectEffects: input.subjectEffects ?? [],
    localAreaEffects: [],
    sharedSurface: false,
    invisibleChannels: [],
    suppressedChannels: []
  })
}

describe('Encounter combat perception', () => {
  it('composes System-policy ordinary sight with pinned senses', () => {
    const result = resolveEncounterCombatPerception({
      requirement: 'SEE',
      observerActorId: ids.actor,
      scene: {
        ambientIllumination: 'DIM',
        barriers: [],
        darknessZones: [],
        doorStates: {},
        grid,
        lights: []
      },
      sceneGrid: grid,
      observerToken: { height: 100, position: { x: 50, y: 50 }, width: 100 },
      subjectToken: { height: 100, position: { x: 250, y: 50 }, width: 100 },
      baselineCapabilities:
        dnd5eCharacterRuleActionSystemAdapter.combatPerceptionBaselineCapabilities?.({
          observerActorId: ids.actor
        }) ?? [],
      pinnedSenseDefinitions: [],
      observerEffects: [],
      subjectEffects: [],
      localAreaEffects: [],
      sharedSurface: false,
      invisibleChannels: [],
      suppressedChannels: []
    })

    expect(result.satisfied).toBe(true)
  })

  it('binds pinned Character senses to authoritative Scene facts', () => {
    const result = evaluate({})

    expect(result.satisfied).toBe(false)
    expect(result.rejected).toEqual([
      expect.objectContaining({ reasons: ['ILLUMINATION_INSUFFICIENT'] })
    ])
  })

  it('applies exact locked observer grants and subject interference by relation', () => {
    const observerEffect = effect(ids.effect, {
      id: ids.contribution,
      order: 0,
      kind: 'SENSE_GRANT',
      senseDefinitionId: ids.blindsight,
      definitionVersion: 1,
      definitionContractVersion: 1,
      definitionChecksum: checksumRuleDocument(blindsight),
      document: blindsight,
      range: { amount: 30, unit: 'FEET' }
    })
    expect(evaluate({ observerEffects: [observerEffect] }).satisfied).toBe(true)

    const subjectEffect = effect(ids.subjectEffect, {
      id: ids.subjectContribution,
      order: 0,
      kind: 'EMISSION_SUPPRESS',
      channels: ['NONVISUAL'],
      bypass: 'NONE'
    })
    const suppressed = evaluate({
      observerEffects: [observerEffect],
      subjectEffects: [subjectEffect]
    })
    expect(suppressed.satisfied).toBe(false)
    expect(suppressed.rejected.flatMap((rejection) => rejection.reasons)).toContain(
      'CHANNEL_SUPPRESSED'
    )
  })

  it('applies blinded and invisible policy from UUID-backed condition revisions', () => {
    const blinded = condition({
      id: '00000000-0000-0000-0002-000100000000',
      contribution: {
        id: '00000000-0000-4000-8000-000000000021',
        order: 0,
        kind: 'SENSE_SUPPRESS',
        senseDefinitionIds: [],
        channels: ['VISUAL']
      }
    })
    const invisible = condition({
      id: '00000000-0000-0000-0002-000800000000',
      contribution: {
        id: '00000000-0000-4000-8000-000000000022',
        order: 0,
        kind: 'EMISSION_SUPPRESS',
        channels: ['VISUAL'],
        bypass: 'INVISIBILITY'
      }
    })
    const base = {
      requirement: 'SEE' as const,
      observerActorId: ids.actor,
      scene: {
        ambientIllumination: 'BRIGHT' as const,
        barriers: [],
        darknessZones: [],
        doorStates: {},
        grid,
        lights: []
      },
      sceneGrid: grid,
      observerToken: { height: 100, position: { x: 50, y: 50 }, width: 100 },
      subjectToken: { height: 100, position: { x: 250, y: 50 }, width: 100 },
      baselineCapabilities:
        dnd5eCharacterRuleActionSystemAdapter.combatPerceptionBaselineCapabilities?.({
          observerActorId: ids.actor
        }) ?? [],
      pinnedSenseDefinitions: [],
      observerEffects: [],
      subjectEffects: [],
      localAreaEffects: [],
      sharedSurface: false,
      invisibleChannels: [],
      suppressedChannels: []
    }
    const blind = resolveEncounterCombatPerception({
      ...base,
      observerConditionContributions: deriveConditionCombatPerceptionContributions({
        conditionDefinitions: [blinded],
        relation: 'OBSERVER',
        sceneGrid: grid
      })
    })
    expect(blind.satisfied).toBe(false)

    const ordinarySight = resolveEncounterCombatPerception({
      ...base,
      subjectConditionContributions: deriveConditionCombatPerceptionContributions({
        conditionDefinitions: [invisible],
        relation: 'SUBJECT',
        sceneGrid: grid
      })
    })
    expect(ordinarySight.satisfied).toBe(false)

    const specialSense = resolveEncounterCombatPerception({
      ...base,
      pinnedSenseDefinitions: [pin(blindsight)],
      subjectConditionContributions: deriveConditionCombatPerceptionContributions({
        conditionDefinitions: [invisible],
        relation: 'SUBJECT',
        sceneGrid: grid
      })
    })
    expect(specialSense.satisfied).toBe(true)
    expect(specialSense.appliedContributionSources).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({
          kind: 'CONDITION_DEFINITION',
          conditionDefinitionId: invisible.conditionDefinitionId,
          conditionDefinitionChecksum: invisible.definitionChecksum
        })
      })
    ])
  })
})
