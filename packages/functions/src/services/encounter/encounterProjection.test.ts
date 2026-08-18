import { describe, expect, it } from 'vitest'
import type { EncounterEventRecord, EncounterRecord, Json } from '@artificer-toolkit/db'

import {
  compileEncounterCurrentProjection,
  projectGm,
  projectPlayerEncounterProjection
} from './encounterProjection.js'
import type { EncounterActorRuleSnapshot } from './encounterActorRuleEvaluation.js'
import { assertEncounterCurrentProjectionReplay } from './encounterProjectionReplay.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  creature: '00000000-0000-4000-8000-000000000003',
  system: '00000000-0000-4000-8000-000000000004',
  template: '00000000-0000-4000-8000-000000000005',
  command: '00000000-0000-4000-8000-000000000006'
}

describe('encounter projection', () => {
  it('projects immutable Creature actions to the GM', () => {
    const encounter = {
      id: ids.command,
      campaignId: ids.campaign,
      sessionId: ids.command,
      templateId: ids.template,
      templateVersion: 1,
      rulePackRevisionId: ids.template,
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
          featureResources: [
            {
              featureId: 'scimitar',
              maximum: 2,
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

    const ruleSnapshot = {
      encounterVersion: encounter.version,
      revisionId: ids.template,
      facts: {
        contractVersion: 1 as const,
        actors: [
          {
            actorId: ids.creature,
            abilityScores: {},
            featureResources: [
              { featureId: 'scimitar', charge: null, used: 1 }
            ]
          }
        ]
      },
      output: {
        actors: [
          {
            actorId: ids.creature,
            initiativeModifier: 0,
            featureResources: [
              {
                featureId: 'scimitar',
                maximum: 2,
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
          command: { projection: projectionAtCreate, roll: null, resolution: null },
          currentProjection: committedAtCreate
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
          currentProjection: committed
        } as unknown as Json,
        actorUserId: ids.command,
        correlationId: null,
        createdAt: encounter.updatedAt
      }
    ]

    expect(assertEncounterCurrentProjectionReplay({ events, projection: committed })).toEqual(committed)
  })
})
