import { describe, expect, it } from 'vitest'
import {
  createEncounterTemplateInputDtoSchema,
  createEncounterInputDtoSchema,
  encounterCommandInputDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterProjectionListDtoSchema,
  encounterPlayerProjectionDtoSchema
} from '../api/encounters.js'
import { proposedRuleOutcomeDtoSchema, ruleOutcomeOverrideDtoSchema } from '../api/rules.js'
import { AUTHORED_LIMITS } from '../shared/authoredLimits.js'

const encounterId = '00000000-0000-4000-8000-000000000001'
const commandId = '00000000-0000-4000-8000-000000000002'

describe('encounter contracts', () => {
  it('requires a Session and template for each Encounter run', () => {
    expect(
      createEncounterInputDtoSchema.parse({
        campaignId: encounterId,
        sessionId: encounterId,
        templateId: encounterId,
        commandId
      }).templateId
    ).toBe(encounterId)
    expect(() =>
      createEncounterInputDtoSchema.parse({
        campaignId: encounterId,
        commandId,
        sessionId: encounterId
      })
    ).toThrow()
  })

  it('caps the number of enemies in a saved template', () => {
    expect(() =>
      createEncounterTemplateInputDtoSchema.parse({
        campaignId: encounterId,
        commandId,
        name: 'Unbounded horde',
        enemies: Array.from({ length: AUTHORED_LIMITS.nestedCollectionItems + 1 }, () => ({
          kind: 'CREATURE',
          sourceId: encounterId
        }))
      })
    ).toThrow()
  })

  it('accepts enemy source references and custom stat rows, not forged snapshots', () => {
    const seededCreatureId = '00000000-0000-0000-0070-009200000000'
    expect(
      createEncounterTemplateInputDtoSchema.parse({
        campaignId: encounterId,
        commandId,
        name: 'Goblin ambush',
        enemies: [
          { kind: 'CREATURE', sourceId: seededCreatureId },
          { kind: 'CUSTOM', label: 'Goblin scout', maxHitPoints: 7 }
        ]
      }).name
    ).toBe('Goblin ambush')
    expect(() =>
      createEncounterTemplateInputDtoSchema.parse({
        campaignId: encounterId,
        commandId,
        name: 'Goblin ambush',
        enemies: []
      })
    ).toThrow()
    expect(() =>
      createEncounterTemplateInputDtoSchema.parse({
        campaignId: encounterId,
        commandId,
        name: 'Forged goblin',
        enemies: [
          {
            kind: 'CREATURE',
            sourceId: encounterId,
            label: 'Forged label',
            maxHitPoints: 999,
            snapshot: { hitPoints: 999 }
          }
        ]
      })
    ).toThrow()
  })

  it('keeps exact GM state out of the player projection contract', () => {
    const base = {
      id: encounterId,
      campaignId: commandId,
      sessionId: encounterId,
      templateId: commandId,
      templateVersion: 1,
      name: 'Goblin ambush',
      status: 'ACTIVE' as const,
      rulePackRevisionId: null,
      version: 1,
      round: 1,
      currentActorId: null,
      actors: [
        {
          id: commandId,
          encounterId,
          kind: 'CREATURE' as const,
          label: 'Goblin scout',
          sourceId: null,
          sourceRevision: null,
          public: true,
          initiative: 12,
          manualOrder: null,
          conditions: [],
          healthBand: 'WOUNDED' as const
        }
      ],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    }
    expect(encounterPlayerProjectionDtoSchema.parse(base).actors[0]).not.toHaveProperty(
      'currentHitPoints'
    )
    expect(
      encounterGmProjectionDtoSchema.parse({
        ...base,
        actors: [
          {
            ...base.actors[0],
            systemId: null,
            stableTieKey: commandId,
            currentHitPoints: 4,
            maxHitPoints: 7,
            tempHitPoints: 0,
            resources: {},
            gmNotes: 'Hidden',
            statBlock: null,
            features: [
              {
                id: 'scimitar',
                label: 'Scimitar',
                description: '<p>Melee weapon attack.</p>',
                section: 'ACTION',
                resource: {
                  used: 1,
                  maximum: 2,
                  remaining: 1,
                  resetKind: 'MANUAL'
                }
              }
            ]
          }
        ]
      }).actors[0].currentHitPoints
    ).toBe(4)
    expect(encounterProjectionListDtoSchema.parse([base])).toHaveLength(1)
  })

  it('accepts a positive manual round correction', () => {
    expect(
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'SET_ROUND',
        round: 3
      }).type
    ).toBe('SET_ROUND')
    expect(() =>
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'SET_ROUND',
        round: 0
      })
    ).toThrow()
  })

  it('accepts an authoritative enemy feature charge adjustment', () => {
    expect(
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'ADJUST_FEATURE_RESOURCE',
        actorId: commandId,
        featureId: 'scimitar',
        direction: 'USE'
      })
    ).toMatchObject({ type: 'ADJUST_FEATURE_RESOURCE', amount: 1 })
  })

  it('pins a nullable rule pack revision for staged legacy encounters', () => {
    expect(
      encounterPlayerProjectionDtoSchema.parse({
        id: encounterId,
        campaignId: commandId,
        sessionId: encounterId,
        templateId: commandId,
        templateVersion: 1,
        name: 'Legacy encounter',
        status: 'PREPARED',
        rulePackRevisionId: null,
        version: 0,
        round: 0,
        currentActorId: null,
        actors: [],
        createdAt: '2026-08-07T00:00:00.000Z',
        updatedAt: '2026-08-07T00:00:00.000Z'
      }).rulePackRevisionId
    ).toBeNull()
  })

  it('requires unique resolve targets and parses only strict proposed outcomes', () => {
    expect(() =>
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_ACTION',
        actorId: encounterId,
        modelKey: 'attack',
        targetActorIds: [commandId, commandId],
        selections: {},
        visibility: 'TABLE'
      })
    ).toThrow()
    expect(() =>
      proposedRuleOutcomeDtoSchema.parse({
        kind: 'DAMAGE',
        targetActorId: commandId,
        amount: 4,
        damageTypeId: null,
        forged: true
      })
    ).toThrow()
    expect(() => ruleOutcomeOverrideDtoSchema.parse({ reason: '   ', outcomes: [] })).toThrow()
  })
})
