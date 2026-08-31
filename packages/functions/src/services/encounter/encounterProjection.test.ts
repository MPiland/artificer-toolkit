import { describe, expect, it } from 'vitest'
import {
  checksumEncounterCurrentProjection,
  checksumLegacyEncounterCurrentProjectionV1,
  type EncounterEventRecord,
  type EncounterInitiativeRoundStateRecord,
  type EncounterRecord,
  type Json
} from '@artificer-toolkit/db'
import { encounterProjectionEventSchema } from '@artificer-toolkit/schema/projections/encounter'

import {
  compileEncounterCurrentProjection,
  projectGm,
  projectPlayerEncounterProjection
} from './encounterProjection.js'
import type { EncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import {
  assertEncounterCurrentProjectionReplay,
  parseEncounterProjectionEvent
} from './encounterProjectionReplay.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  creature: '00000000-0000-4000-8000-000000000003',
  system: '00000000-0000-4000-8000-000000000004',
  template: '00000000-0000-4000-8000-000000000005',
  command: '00000000-0000-4000-8000-000000000006',
  actorTwo: '00000000-0000-4000-8000-000000000007',
  sideOne: '00000000-0000-4000-8000-000000000008',
  sideTwo: '00000000-0000-4000-8000-000000000009'
}

const initiativeTimestamp = '2026-08-07T00:00:00.000Z'

function initiativeProjectionEncounter(input: {
  status?: EncounterRecord['status']
  currentActorId: string | null
  initiativeRoundState?: EncounterInitiativeRoundStateRecord | null
}) {
  return {
    id: ids.command,
    campaignId: ids.campaign,
    sessionId: ids.command,
    gameSystemId: ids.system,
    blueprintId: ids.template,
    blueprintVersion: 1,
    blueprintChecksum: 'a'.repeat(64),
    rulePackRevisionId: ids.template,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    name: 'Initiative projection',
    status: input.status ?? 'ACTIVE',
    version: 1,
    round: 1,
    currentActorId: input.currentActorId,
    ...(input.initiativeRoundState === undefined
      ? {}
      : { initiativeRoundState: input.initiativeRoundState }),
    actors: [
      {
        id: ids.creature,
        encounterId: ids.command,
        sideId: ids.sideOne,
        kind: 'CHARACTER',
        sourceId: null,
        sourceRevision: null,
        label: 'First',
        systemId: null,
        stableTieKey: 'first',
        public: true,
        currentHitPoints: 10,
        maxHitPoints: 10,
        tempHitPoints: 0,
        conditions: [],
        resources: {},
        gmNotes: null,
        initiative: null,
        manualOrder: 0,
        snapshot: {},
        createdAt: initiativeTimestamp,
        updatedAt: initiativeTimestamp
      },
      {
        id: ids.actorTwo,
        encounterId: ids.command,
        sideId: ids.sideTwo,
        kind: 'CHARACTER',
        sourceId: null,
        sourceRevision: null,
        label: 'Second',
        systemId: null,
        stableTieKey: 'second',
        public: true,
        currentHitPoints: 10,
        maxHitPoints: 10,
        tempHitPoints: 0,
        conditions: [],
        resources: {},
        gmNotes: null,
        initiative: null,
        manualOrder: 1,
        snapshot: {},
        createdAt: initiativeTimestamp,
        updatedAt: initiativeTimestamp
      }
    ],
    reminders: [],
    createdAt: initiativeTimestamp,
    updatedAt: initiativeTimestamp
  } satisfies EncounterRecord
}

function initiativeState(input: {
  status: 'PREPARING' | 'ACTIVE'
  firstStatus: 'PENDING' | 'READY' | 'ACTIVE'
  secondStatus: 'READY' | 'ACTIVE'
}): EncounterInitiativeRoundStateRecord {
  return {
    round: {
      encounterId: ids.command,
      round: 1,
      procedure: 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: input.status,
      policySnapshotChecksum: null,
      nextTurnOrderOrdinal: 2,
      version: 1,
      createdAt: initiativeTimestamp,
      updatedAt: initiativeTimestamp
    },
    participants: [
      {
        encounterId: ids.command,
        round: 1,
        actorId: ids.creature,
        sideId: ids.sideOne,
        status: input.firstStatus,
        initiativeScore: null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: input.firstStatus === 'PENDING' ? null : 0,
        version: 1,
        createdAt: initiativeTimestamp,
        updatedAt: initiativeTimestamp
      },
      {
        encounterId: ids.command,
        round: 1,
        actorId: ids.actorTwo,
        sideId: ids.sideTwo,
        status: input.secondStatus,
        initiativeScore: null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: 1,
        version: 1,
        createdAt: initiativeTimestamp,
        updatedAt: initiativeTimestamp
      }
    ],
    sides: []
  }
}

describe('encounter projection', () => {
  it('uses the normalized active initiative participant for the current actor', () => {
    const encounter = initiativeProjectionEncounter({
      currentActorId: ids.actorTwo,
      initiativeRoundState: initiativeState({
        status: 'ACTIVE',
        firstStatus: 'ACTIVE',
        secondStatus: 'READY'
      })
    })

    const projection = projectGm(encounter, { actors: [] })

    expect(projection.currentActorId).toBe(ids.creature)
    expect(projectPlayerEncounterProjection(projection).currentActorId).toBe(ids.creature)
  })

  it('projects no current actor while normalized initiative remains pending', () => {
    const encounter = initiativeProjectionEncounter({
      status: 'PREPARED',
      currentActorId: ids.actorTwo,
      initiativeRoundState: initiativeState({
        status: 'PREPARING',
        firstStatus: 'PENDING',
        secondStatus: 'READY'
      })
    })

    expect(projectGm(encounter, { actors: [] }).currentActorId).toBeNull()
  })

  it('does not leak a mismatched legacy cursor when normalized state has no active participant', () => {
    const encounter = initiativeProjectionEncounter({
      currentActorId: ids.actorTwo,
      initiativeRoundState: initiativeState({
        status: 'ACTIVE',
        firstStatus: 'READY',
        secondStatus: 'READY'
      })
    })

    const projection = projectGm(encounter, { actors: [] })

    expect(projection.currentActorId).toBeNull()
    expect(projectPlayerEncounterProjection(projection).currentActorId).toBeNull()
  })

  it('publishes a fresh repository-created Encounter at stream version zero', () => {
    const repositoryCreatedEncounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.command,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      rulePackRevisionId: ids.template,
      automationMode: 'ASSISTED',
      manualReminderMode: 'OFF',
      name: 'Fresh run',
      status: 'PREPARED',
      version: 0,
      round: 0,
      currentActorId: null,
      actors: [],
      reminders: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    } satisfies EncounterRecord
    const snapshot = {
      encounterVersion: 0,
      revisionId: ids.template,
      facts: { contractVersion: 1 as const, actors: [] },
      output: { actors: [] }
    } satisfies EncounterActorRuleSnapshot
    const projection = projectGm(repositoryCreatedEncounter, snapshot.output)
    const currentProjection = compileEncounterCurrentProjection(projection, snapshot)

    expect(currentProjection.streamVersion).toBe(0)
    expect(currentProjection.projection.version).toBe(0)
    expect(
      encounterProjectionEventSchema.parse({
        command: { projection, roll: null, resolution: null },
        currentProjection,
        ruleReceipt: null
      }).currentProjection
    ).toEqual(currentProjection)
    expect(
      encounterProjectionEventSchema.parse({
        command: { projection, roll: null, resolution: null },
        currentProjection,
        ruleReceipt: {
          occurrenceId: ids.command.toUpperCase(),
          resultChecksum: 'a'.repeat(64)
        }
      }).ruleReceipt
    ).toEqual({
      occurrenceId: ids.command,
      resultChecksum: 'a'.repeat(64)
    })
    expect(
      encounterProjectionEventSchema.safeParse({
        command: { projection, roll: null, resolution: null },
        currentProjection,
        ruleReceipt: {
          occurrenceId: 'not-a-uuid',
          resultChecksum: 'a'.repeat(64)
        }
      }).success
    ).toBe(false)
  })

  it('projects immutable Creature actions to the GM', () => {
    const encounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.command,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      rulePackRevisionId: ids.template,
      automationMode: 'MANUAL',
      manualReminderMode: 'SUBTLE',
      name: 'Goblin ambush',
      status: 'ACTIVE',
      version: 1,
      round: 1,
      currentActorId: null,
      actors: [
        {
          id: ids.creature,
          encounterId: ids.command,
          kind: 'CREATURE',
          sourceId: ids.creature,
          sourceRevision: null,
          label: 'Server creature',
          systemId: ids.system,
          stableTieKey: ids.creature,
          public: true,
          currentHitPoints: 8,
          maxHitPoints: 8,
          tempHitPoints: 0,
          conditions: [],
          resources: { featureCharges: { scimitar: 1 } },
          gmNotes: null,
          initiative: 12,
          manualOrder: null,
          snapshot: {
            kind: 'CREATURE',
            payload: {
              features: [
                {
                  id: 'scimitar',
                  label: 'Scimitar',
                  description: '<p>Melee weapon attack.</p>',
                  section: 'ACTION',
                  order: 1,
                  charges: {
                    id: 'scimitar-charges',
                    resetKind: 'MANUAL',
                    limitKind: 'FIXED_AMOUNT',
                    scalingKind: 'NONE',
                    amount: 2
                  }
                }
              ]
            }
          },
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:00:00.000Z'
        }
      ],
      reminders: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    } satisfies EncounterRecord
    const projection = projectGm(encounter, {
      actors: [
        {
          actorId: ids.creature,
          initiativeModifier: 0,
          targetProtection: {
            status: 'NORMALIZED',
            defenses: [],
            conditionImmunityIds: []
          },
          featureResources: [
            {
              featureId: 'scimitar',
              maximum: 2,
              reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
              rawUsed: 1,
              used: 1,
              remaining: 1,
              resetKind: 'MANUAL'
            }
          ]
        }
      ]
    })

    expect(projection.actors[0]).toMatchObject({
      features: [
        {
          label: 'Scimitar',
          section: 'ACTION',
          resource: {
            used: 1,
            maximum: 2,
            remaining: 1,
            resetKind: 'MANUAL'
          }
        }
      ]
    })

    const playerProjection = projectPlayerEncounterProjection(projection)
    expect(playerProjection).toMatchObject({
      actors: [
        {
          id: ids.creature,
          public: true,
          sourceId: null
        }
      ]
    })
    expect(playerProjection.actors[0]).not.toHaveProperty('features')
    expect(playerProjection.actors[0]).not.toHaveProperty('gmNotes')
    expect(playerProjection).toMatchObject({ automationMode: 'MANUAL' })
    expect(playerProjection).not.toHaveProperty('manualReminderMode')

    const ruleSnapshot = {
      encounterVersion: encounter.version,
      revisionId: ids.template,
      facts: {
        contractVersion: 1 as const,
        actors: [
          {
            actorId: ids.creature,
            abilityScores: {},
            targetProtection: {
              status: 'NORMALIZED',
              defenses: [],
              conditionImmunityIds: []
            },
            featureResources: [{ featureId: 'scimitar', charge: null, used: 1 }]
          }
        ]
      },
      output: {
        actors: [
          {
            actorId: ids.creature,
            initiativeModifier: 0,
            targetProtection: {
              status: 'NORMALIZED',
              defenses: [],
              conditionImmunityIds: []
            },
            featureResources: [
              {
                featureId: 'scimitar',
                maximum: 2,
                reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                rawUsed: 1,
                used: 1,
                remaining: 1,
                resetKind: 'MANUAL'
              }
            ]
          }
        ]
      }
    } satisfies EncounterActorRuleSnapshot
    const committed = compileEncounterCurrentProjection(projection, ruleSnapshot)
    expect(committed).toMatchObject({
      encounterId: encounter.id,
      streamVersion: encounter.version,
      projection
    })
    expect(committed.projectionChecksum).toMatch(/^[a-f0-9]{64}$/)
    expect(
      compileEncounterCurrentProjection(
        { ...projection, round: projection.round + 1 },
        ruleSnapshot
      ).projectionChecksum
    ).not.toBe(committed.projectionChecksum)

    const projectionAtCreate = { ...projection, version: 0 }
    const projectionAtCreateSnapshot = {
      ...ruleSnapshot,
      encounterVersion: projectionAtCreate.version
    }
    const committedAtCreate = compileEncounterCurrentProjection(
      projectionAtCreate,
      projectionAtCreateSnapshot
    )
    const events: EncounterEventRecord[] = [
      {
        id: ids.command,
        encounterId: encounter.id,
        campaignId: encounter.campaignId,
        version: 0,
        commandId: ids.command,
        commandType: 'CREATE',
        commandFingerprint: 'a'.repeat(64),
        commandPayload: {},
        resultPayload: {
          command: {
            projection: projectionAtCreate,
            roll: null,
            resolution: null
          },
          currentProjection: committedAtCreate,
          ruleReceipt: null
        } as unknown as Json,
        actorUserId: ids.command,
        correlationId: null,
        createdAt: encounter.createdAt
      },
      {
        id: ids.template,
        encounterId: encounter.id,
        campaignId: encounter.campaignId,
        version: 1,
        commandId: ids.template,
        commandType: 'START',
        commandFingerprint: 'b'.repeat(64),
        commandPayload: {},
        resultPayload: {
          command: { projection, roll: null, resolution: null },
          currentProjection: committed,
          ruleReceipt: null
        } as unknown as Json,
        actorUserId: ids.command,
        correlationId: null,
        createdAt: encounter.updatedAt
      }
    ]

    expect(assertEncounterCurrentProjectionReplay({ events, projection: committed })).toEqual(
      committed
    )
  })

  it('adapts only checksum-valid historical v1 event projections through normalized Blueprint pins', () => {
    const encounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.command,
      gameSystemId: ids.system,
      blueprintId: ids.template,
      blueprintVersion: 2,
      blueprintChecksum: 'b'.repeat(64),
      rulePackRevisionId: ids.template,
      automationMode: 'ASSISTED',
      manualReminderMode: 'OFF',
      name: 'Historical run',
      status: 'ACTIVE',
      version: 1,
      round: 1,
      currentActorId: null,
      actors: [],
      reminders: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    } satisfies EncounterRecord
    const snapshot = {
      encounterVersion: 1,
      revisionId: ids.template,
      facts: { contractVersion: 1 as const, actors: [] },
      output: { actors: [] }
    } satisfies EncounterActorRuleSnapshot
    const currentAtOne = compileEncounterCurrentProjection(
      projectGm(encounter, snapshot.output),
      snapshot
    )
    const current = {
      ...currentAtOne,
      streamVersion: 0,
      projectionChecksum: '0'.repeat(64),
      projection: {
        ...currentAtOne.projection,
        blueprintVersion: 0,
        version: 0
      },
      ruleSnapshot: { ...currentAtOne.ruleSnapshot, encounterVersion: 0 }
    }
    current.projectionChecksum = checksumEncounterCurrentProjection(current)
    const {
      gameSystemId: _gameSystemId,
      blueprintId: _blueprintId,
      blueprintVersion: _blueprintVersion,
      blueprintChecksum: _blueprintChecksum,
      automationMode: _automationMode,
      manualReminderMode: _manualReminderMode,
      ...legacyProjection
    } = current.projection
    const legacy = {
      ...current,
      projectionSchemaVersion: 1 as const,
      projectionChecksum: '0'.repeat(64),
      projection: {
        ...legacyProjection,
        templateId: ids.template,
        templateVersion: 0
      }
    }
    const checksummedLegacy = {
      ...legacy,
      projectionChecksum: checksumLegacyEncounterCurrentProjectionV1(legacy)
    }
    const resultPayload = {
      command: {
        projection: {
          ...legacyProjection,
          templateId: ids.template,
          templateVersion: 0
        },
        roll: null,
        resolution: null
      },
      currentProjection: checksummedLegacy
    }
    const header = {
      encounterId: encounter.id,
      gameSystemId: encounter.gameSystemId,
      blueprintId: encounter.blueprintId,
      blueprintVersion: 0,
      blueprintChecksum: encounter.blueprintChecksum,
      automationMode: encounter.automationMode,
      manualReminderMode: encounter.manualReminderMode
    }

    const currentPayload = {
      command: { projection: current.projection, roll: null, resolution: null },
      currentProjection: current,
      ruleReceipt: null
    }

    expect(parseEncounterProjectionEvent(currentPayload, header).currentProjection).toEqual(current)
    expect(() =>
      parseEncounterProjectionEvent(
        {
          ...currentPayload,
          currentProjection: { ...current, projectionChecksum: '0'.repeat(64) }
        },
        header
      )
    ).toThrow('invalid projected result')
    expect(() =>
      parseEncounterProjectionEvent(
        {
          ...currentPayload,
          command: {
            projection: { ...current.projection, name: 'Divergent projection' },
            roll: null,
            resolution: null
          }
        },
        header
      )
    ).toThrow('invalid projected result')

    expect(legacyProjection).not.toHaveProperty('automationMode')
    expect(legacyProjection).not.toHaveProperty('manualReminderMode')
    expect(parseEncounterProjectionEvent(resultPayload, header).currentProjection).toEqual(current)
    const events: EncounterEventRecord[] = [
      {
        id: ids.command,
        encounterId: encounter.id,
        campaignId: encounter.campaignId,
        version: 0,
        commandId: ids.command,
        commandType: 'CREATE',
        commandFingerprint: 'a'.repeat(64),
        commandPayload: {},
        resultPayload: resultPayload as Json,
        actorUserId: ids.command,
        correlationId: null,
        createdAt: encounter.createdAt
      }
    ]
    expect(
      assertEncounterCurrentProjectionReplay({
        events,
        projection: current,
        header
      })
    ).toEqual(current)

    expect(() =>
      parseEncounterProjectionEvent(
        {
          ...resultPayload,
          currentProjection: {
            ...checksummedLegacy,
            projectionChecksum: '0'.repeat(64)
          }
        },
        header
      )
    ).toThrow('invalid projected result')

    expect(() =>
      parseEncounterProjectionEvent(
        {
          ...resultPayload,
          command: {
            projection: { ...legacyProjection, templateVersion: 0 },
            roll: null,
            resolution: null
          }
        },
        header
      )
    ).toThrow('invalid projected result')

    expect(() =>
      parseEncounterProjectionEvent(resultPayload, {
        ...header,
        blueprintVersion: 3
      })
    ).toThrow('invalid projected result')

    expect(() =>
      parseEncounterProjectionEvent(
        {
          command: {
            projection: current.projection,
            roll: null,
            resolution: null
          },
          currentProjection: current
        },
        { ...header, blueprintChecksum: 'c'.repeat(64) }
      )
    ).toThrow('invalid projected result')
  })
})
