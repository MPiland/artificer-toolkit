import { describe, expect, it } from 'vitest'

import type { PinnedSenseDefinition } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SenseReusableDefinitionDocumentDto } from '@artificer-toolkit/schema/shared/combatPerception'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { resolveEncounterCombatPerception } from './encounterCombatPerception.js'
import type { LockedCombatPerceptionEffect } from './encounterCombatPerceptionContributions.js'

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
  contribution: LockedCombatPerceptionEffect['definition']['perceptionContributions'][number]
): LockedCombatPerceptionEffect {
  return {
    id,
    version: 1,
    createdOrdinal: 1,
    definitionChecksum: 'a'.repeat(64),
    definition: { perceptionContributions: [contribution] }
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
})
