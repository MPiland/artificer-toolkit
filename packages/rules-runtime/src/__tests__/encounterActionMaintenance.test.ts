import { describe, expect, it } from 'vitest'
import type { EncounterMaintainedEffectStateRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  buildEncounterMaintenanceTransition,
  endedMaintenanceConditions
} from '../encounterActionMaintenance.js'
import { ENCOUNTER_ID, TIMESTAMP } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const conditionId = (code: string) => SRD_CONDITION_TYPES.find((entry) => entry.code === code)!.id
const CHARMED = conditionId('CHARMED')
const FRIGHTENED = conditionId('FRIGHTENED')
const RESTRAINED = conditionId('RESTRAINED')
const PARALYZED = conditionId('PARALYZED')

const SOURCE_ACTOR_ID = '00000000-0000-4000-8000-00000000f101'
const TARGET_ACTOR_ID = '00000000-0000-4000-8000-00000000f102'
const CHARACTER_A = '00000000-0000-4000-8000-00000000f103'
const CHARACTER_B = '00000000-0000-4000-8000-00000000f104'
const MAINTENANCE_DEFINITION_ID = '00000000-0000-4000-8000-00000000f105'

const actorOwner = {
  kind: 'ENCOUNTER_ACTOR' as const,
  encounterId: ENCOUNTER_ID,
  targetActorId: TARGET_ACTOR_ID
}

function owning(id: string, conditions: Record<string, boolean>, createdOrdinal = 1) {
  const [first, ...rest] = Object.entries(conditions).map(
    ([conditionIdValue, baselinePresent]) => ({
      kind: 'CONDITION_OWNERSHIP' as const,
      conditionId: conditionIdValue,
      baselinePresent
    })
  )
  if (!first) throw new Error('An owning effect needs at least one condition.')
  return activeEffect({
    id,
    owner: actorOwner,
    createdOrdinal,
    stateContributions: [first, ...rest]
  })
}

describe('conditions ended with maintained effects', () => {
  it('ends a condition only the removed effect applied', () => {
    expect(
      endedMaintenanceConditions(
        [owning('00000000-0000-4000-8000-00000000f1a1', { [CHARMED]: false })],
        []
      )
    ).toEqual(new Set([CHARMED]))
  })

  it('keeps a condition the target already had before the effect (baseline)', () => {
    expect(
      endedMaintenanceConditions(
        [owning('00000000-0000-4000-8000-00000000f1a1', { [FRIGHTENED]: true, [CHARMED]: false })],
        []
      )
    ).toEqual(new Set([CHARMED]))
  })

  it('keeps a condition that a remaining active effect still owns', () => {
    const removed = owning('00000000-0000-4000-8000-00000000f1a1', {
      [RESTRAINED]: false,
      [PARALYZED]: false
    })
    const remaining = owning('00000000-0000-4000-8000-00000000f1a2', { [RESTRAINED]: false }, 2)
    expect(endedMaintenanceConditions([removed], [remaining])).toEqual(new Set([PARALYZED]))
  })

  it('keeps a condition another removed effect held as a baseline', () => {
    const applied = owning('00000000-0000-4000-8000-00000000f1a1', { [CHARMED]: false })
    const baseline = owning('00000000-0000-4000-8000-00000000f1a2', { [CHARMED]: true }, 2)
    expect(endedMaintenanceConditions([applied, baseline], [])).toEqual(new Set())
  })

  it('ignores contributions that own no condition', () => {
    const drained = activeEffect({
      id: '00000000-0000-4000-8000-00000000f1a1',
      owner: actorOwner,
      createdOrdinal: 1,
      stateContributions: [
        {
          kind: 'HIT_POINT_MAXIMUM_REDUCTION',
          amount: 3,
          sourceDamageOutcomeId: '00000000-0000-4000-8000-00000000f1a9',
          sourceDamageNodeId: 'damage',
          sourceDamageOperationKey: 'damage',
          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'],
          sourceLabel: 'Slam',
          sourceHidden: false
        }
      ]
    })
    expect(endedMaintenanceConditions([drained], [])).toEqual(new Set())
  })
})

describe('maintained-effect replacement transition', () => {
  const occurrenceId = (version: number) =>
    `00000000-0000-4000-8000-00000000f2${version.toString().padStart(2, '0')}`
  function state(id: string, version: number, sourceActionId: string) {
    const descriptor = {
      schemaVersion: 2 as const,
      maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID,
      definitionChecksum: 'a'.repeat(64),
      provenance: {
        kind: 'ACTION' as const,
        sourceActionId,
        sourceOccurrenceId: occurrenceId(version)
      },
      sourceActorId: SOURCE_ACTOR_ID,
      replacementPolicy: 'REPLACE_SAME_DEFINITION' as const,
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY' as const
    }
    const record: EncounterMaintainedEffectStateRecord = {
      id,
      encounterId: ENCOUNTER_ID,
      ownerActorId: SOURCE_ACTOR_ID,
      maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID,
      descriptor,
      descriptorChecksum: `${version}`.repeat(64),
      version,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP
    }
    return record
  }
  const prior = state('00000000-0000-4000-8000-00000000f301', 2, 'hold-person-cast-1')
  const created = state('00000000-0000-4000-8000-00000000f302', 1, 'hold-person-cast-2')
  const createdSummary = {
    id: created.id,
    version: 1,
    maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID,
    descriptorChecksum: created.descriptorChecksum,
    definitionChecksum: 'a'.repeat(64),
    sourceActionId: 'hold-person-cast-2',
    sourceOccurrenceId: occurrenceId(1),
    sourceActorId: SOURCE_ACTOR_ID
  }

  it('records a first maintained state with nothing replaced', () => {
    expect(
      buildEncounterMaintenanceTransition({
        maintenance: { prior: null, removed: [], carried: [], characterVersions: [] },
        createdState: created,
        createdDependentEffectIds: ['00000000-0000-4000-8000-00000000f401']
      })
    ).toEqual({
      kind: 'REPLACE_SAME_DEFINITION',
      priorState: null,
      removedDependentEffects: [],
      endedCarriedGrants: [],
      createdState: createdSummary,
      characterOwnerTransitions: [],
      createdDependentEffectIds: ['00000000-0000-4000-8000-00000000f401']
    })
  })

  it('records the replaced state, each removed dependent, and one version step per Character owner', () => {
    const characterEffect = (id: string, characterId: string, createdOrdinal: number) =>
      activeEffect({
        id,
        owner: { kind: 'CHARACTER', characterId },
        createdOrdinal,
        version: 3,
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: PARALYZED, baselinePresent: false }
        ]
      })
    // Canonical owner order: Characters by id, then Encounter actors; each by created ordinal.
    const removed = [
      characterEffect('00000000-0000-4000-8000-00000000f501', CHARACTER_A, 1),
      characterEffect('00000000-0000-4000-8000-00000000f502', CHARACTER_A, 2),
      characterEffect('00000000-0000-4000-8000-00000000f503', CHARACTER_B, 1),
      owning('00000000-0000-4000-8000-00000000f504', { [PARALYZED]: false }, 5)
    ]
    const transition = buildEncounterMaintenanceTransition({
      maintenance: {
        prior,
        removed,
        carried: [],
        characterVersions: [
          { characterId: CHARACTER_A, beforeStreamVersion: 8 },
          { characterId: CHARACTER_B, beforeStreamVersion: 2 }
        ]
      },
      createdState: created,
      createdDependentEffectIds: [
        '00000000-0000-4000-8000-00000000f402',
        '00000000-0000-4000-8000-00000000f401'
      ]
    })
    expect(transition).toEqual({
      kind: 'REPLACE_SAME_DEFINITION',
      priorState: {
        id: prior.id,
        version: 2,
        maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID,
        descriptorChecksum: prior.descriptorChecksum,
        sourceActorId: SOURCE_ACTOR_ID
      },
      removedDependentEffects: [
        ...removed.slice(0, 2).map((effect) => ({
          kind: 'CHARACTER',
          characterId: CHARACTER_A,
          activeEffectId: effect.id,
          createdOrdinal: effect.createdOrdinal,
          expectedVersion: 3,
          definitionChecksum: effect.definitionChecksum,
          lifecycleChecksum: effect.lifecycleChecksum
        })),
        {
          kind: 'CHARACTER',
          characterId: CHARACTER_B,
          activeEffectId: removed[2]!.id,
          createdOrdinal: 1,
          expectedVersion: 3,
          definitionChecksum: removed[2]!.definitionChecksum,
          lifecycleChecksum: removed[2]!.lifecycleChecksum
        },
        {
          kind: 'ENCOUNTER_ACTOR',
          targetActorId: TARGET_ACTOR_ID,
          activeEffectId: removed[3]!.id,
          createdOrdinal: 5,
          expectedVersion: 1,
          definitionChecksum: removed[3]!.definitionChecksum,
          lifecycleChecksum: removed[3]!.lifecycleChecksum
        }
      ],
      endedCarriedGrants: [],
      createdState: createdSummary,
      characterOwnerTransitions: [
        { characterId: CHARACTER_A, beforeStreamVersion: 8, afterStreamVersion: 9 },
        { characterId: CHARACTER_B, beforeStreamVersion: 2, afterStreamVersion: 3 }
      ],
      createdDependentEffectIds: [
        '00000000-0000-4000-8000-00000000f402',
        '00000000-0000-4000-8000-00000000f401'
      ]
    })
  })

  it('refuses removals without a prior state and a Character owner without its version step', () => {
    const removedEffect = owning('00000000-0000-4000-8000-00000000f504', { [PARALYZED]: false })
    expect(() =>
      buildEncounterMaintenanceTransition({
        maintenance: { prior: null, removed: [removedEffect], carried: [], characterVersions: [] },
        createdState: created,
        createdDependentEffectIds: ['00000000-0000-4000-8000-00000000f401']
      })
    ).toThrow('Maintained replacement prior state and removals are inconsistent.')
    const characterRemoved = activeEffect({
      id: '00000000-0000-4000-8000-00000000f501',
      owner: { kind: 'CHARACTER', characterId: CHARACTER_A },
      createdOrdinal: 1,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: PARALYZED, baselinePresent: false }
      ]
    })
    expect(() =>
      buildEncounterMaintenanceTransition({
        maintenance: { prior, removed: [characterRemoved], carried: [], characterVersions: [] },
        createdState: created,
        createdDependentEffectIds: ['00000000-0000-4000-8000-00000000f401']
      })
    ).toThrow('Maintained Character owner transitions are invalid.')
  })

  it('refuses removed dependents out of canonical owner order', () => {
    const later = owning('00000000-0000-4000-8000-00000000f504', { [PARALYZED]: false }, 5)
    const earlier = owning('00000000-0000-4000-8000-00000000f505', { [PARALYZED]: false }, 4)
    expect(() =>
      buildEncounterMaintenanceTransition({
        maintenance: { prior, removed: [later, earlier], carried: [], characterVersions: [] },
        createdState: created,
        createdDependentEffectIds: ['00000000-0000-4000-8000-00000000f401']
      })
    ).toThrow('Removed maintained dependent effects must use canonical owner order.')
  })

  it('records a carried grant a new Concentration ends apart from the replaced dependents', () => {
    const carriedGrant = activeEffect({
      id: '00000000-0000-4000-8000-00000000f601',
      owner: { kind: 'CHARACTER', characterId: CHARACTER_B },
      createdOrdinal: 3,
      version: 4,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: PARALYZED, baselinePresent: false }
      ]
    })
    const transition = buildEncounterMaintenanceTransition({
      maintenance: {
        prior: null,
        removed: [carriedGrant],
        carried: [carriedGrant],
        characterVersions: [{ characterId: CHARACTER_B, beforeStreamVersion: 6 }]
      },
      createdState: created,
      createdDependentEffectIds: ['00000000-0000-4000-8000-00000000f401']
    })
    expect(transition).toMatchObject({
      priorState: null,
      removedDependentEffects: [],
      endedCarriedGrants: [
        {
          characterId: CHARACTER_B,
          activeEffectId: carriedGrant.id,
          createdOrdinal: 3,
          expectedVersion: 4,
          definitionChecksum: carriedGrant.definitionChecksum,
          lifecycleChecksum: carriedGrant.lifecycleChecksum
        }
      ],
      characterOwnerTransitions: [
        { characterId: CHARACTER_B, beforeStreamVersion: 6, afterStreamVersion: 7 }
      ]
    })
  })

  it('refuses a carried grant whose Character owner has no version step', () => {
    const carriedGrant = activeEffect({
      id: '00000000-0000-4000-8000-00000000f601',
      owner: { kind: 'CHARACTER', characterId: CHARACTER_B },
      createdOrdinal: 3,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: PARALYZED, baselinePresent: false }
      ]
    })
    expect(() =>
      buildEncounterMaintenanceTransition({
        maintenance: {
          prior: null,
          removed: [carriedGrant],
          carried: [carriedGrant],
          characterVersions: []
        },
        createdState: created,
        createdDependentEffectIds: ['00000000-0000-4000-8000-00000000f401']
      })
    ).toThrow('Maintained Character owner transitions are invalid.')
  })
})
