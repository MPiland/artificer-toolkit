import { describe, expect, it } from 'vitest'
import {
  MAX_ENCOUNTER_ACTORS,
  createEncounterBlueprintInputDtoSchema,
  createEncounterInputDtoSchema,
  encounterCommandInputDtoSchema,
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterProjectionListDtoSchema,
  encounterPlayerProjectionDtoSchema,
  optionalCombatActionIntentDtoSchema,
  resolveRuleOccurrenceInputDtoSchema
} from '../api/encounters.js'
import { serverRuleExecutionPendingApplicationContextDtoSchema } from '../shared/rulesExecution.js'
import { pendingEncounterRuleOccurrenceSummaryDtoSchema } from '../shared/encounterRuleOccurrence.js'

const encounterId = '00000000-0000-4000-8000-000000000001'
const commandId = '00000000-0000-4000-8000-000000000002'

const offeredRollModes = [
  { code: 'NORMAL', label: 'Normal', keep: 'FIRST' as const },
  { code: 'ADVANTAGE', label: 'Advantage', keep: 'HIGHER' as const }
]

describe('encounter contracts', () => {
  it('retains only exact post-action Cleaving trigger facts on a paused Character action', () => {
    const pending = {
      kind: 'ENCOUNTER_CHARACTER_RULE_ACTION' as const,
      schemaVersion: 1 as const,
      actionId: 'action:longsword',
      sceneContext: null,
      positionalDependencyChecksum: null,
      sourceActorId: encounterId,
      targetActorId: commandId,
      sourceCharacterId: encounterId,
      targetCharacterId: commandId,
      sourceCharacterStreamVersion: 4,
      targetCharacterStreamVersion: 9,
      sourceProjectionChecksum: 'a'.repeat(64),
      targetProjectionChecksum: 'b'.repeat(64),
      sourceMechanicalContextChecksum: 'c'.repeat(64),
      targetMechanicalContextChecksum: 'd'.repeat(64),
      publishedDefinitionId: encounterId,
      publishedDefinitionChecksum: 'e'.repeat(64),
      postActionTriggerFacts: {
        attackKind: 'MELEE' as const,
        range: { id: 'weapon-reach', rangeKind: 'DISTANCE' as const, amount: 5, unit: 'FEET' }
      },
      actionEconomy: null,
      twoPhase: null,
      targetStateChecksum: 'f'.repeat(64),
      d20: null
    }

    expect(serverRuleExecutionPendingApplicationContextDtoSchema.parse(pending)).toMatchObject(
      pending
    )
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        postActionTriggerFacts: undefined
      })
    ).toMatchObject({ postActionTriggerFacts: null })
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.safeParse({
        ...pending,
        postActionTriggerFacts: {
          ...pending.postActionTriggerFacts,
          range: { id: 'display-label', rangeKind: 'DISTANCE', amount: 5 }
        }
      }).success
    ).toBe(false)
  })

  it('projects only closed sanitized initiative declaration options', () => {
    const prompt = {
      kind: 'INITIATIVE_DECLARATION' as const,
      occurrenceId: encounterId,
      occurrenceVersion: 1,
      encounterVersion: 2,
      actorId: commandId,
      requestId: 'speed-factor',
      primaryOptions: [
        {
          kind: 'CHARACTER_ACTION' as const,
          optionId: 'action:longsword',
          label: 'Longsword',
          selectionContract: 'a'.repeat(64)
        }
      ],
      bonusOptions: [],
      adjudicationFields: [
        {
          kind: 'SELECT' as const,
          key: 'actorSize' as const,
          label: 'Actor size',
          required: true as const,
          options: [{ value: 'MEDIUM', label: 'Medium' }]
        },
        {
          kind: 'MULTI_SELECT' as const,
          key: 'factorIds' as const,
          label: 'Action factors',
          minimumSelections: 0,
          maximumSelections: 4,
          options: []
        },
        {
          kind: 'NULLABLE_INTEGER' as const,
          key: 'spellLevel' as const,
          label: 'Spell level',
          minimum: 0,
          maximum: 12
        }
      ],
      allowedResponses: ['INITIATIVE_DECLARATION'] as const
    }
    expect(pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse(prompt).success).toBe(true)
    expect(
      pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse({
        ...prompt,
        primaryOptions: [{ ...prompt.primaryOptions[0], kind: 'UNKNOWN' }]
      }).success
    ).toBe(false)
    expect(
      pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse({
        ...prompt,
        adjudicationFields: [{ ...prompt.adjudicationFields[0], key: 'unknown' }]
      }).success
    ).toBe(false)
    expect(
      pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse({
        ...prompt,
        primaryOptions: [{ ...prompt.primaryOptions[0], label: '' }]
      }).success
    ).toBe(false)
    expect(
      pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse({
        ...prompt,
        primaryOptions: [{ ...prompt.primaryOptions[0], selectionContract: 'not-a-checksum' }]
      }).success
    ).toBe(false)
  })

  it('closes initiative occurrence prompts, responses, and persisted phase context', () => {
    const secondEntityId = '00000000-0000-4000-8000-000000000003'
    const baseOccurrence = {
      occurrenceId: encounterId,
      occurrenceVersion: 5,
      status: 'PENDING' as const
    }
    const evidencePending = {
      ...baseOccurrence,
      pending: {
        kind: 'INITIATIVE_EVIDENCE' as const,
        occurrenceId: encounterId,
        occurrenceVersion: 5,
        encounterVersion: 8,
        request: { requestId: 'initiative-score', min: -10, max: 50 },
        allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL'] as const
      }
    }
    const orderPending = {
      ...baseOccurrence,
      pending: {
        kind: 'INITIATIVE_ORDER' as const,
        occurrenceId: encounterId,
        occurrenceVersion: 5,
        encounterVersion: 8,
        requestId: 'initiative-order',
        entityKind: 'ACTOR' as const,
        optionIds: [commandId, secondEntityId],
        allowedResponses: ['INITIATIVE_ENTITY'] as const
      }
    }

    expect(
      encounterCommandResultDtoSchema.shape.occurrence._zod.def.innerType.parse(evidencePending)
    ).toMatchObject(evidencePending)
    expect(
      encounterCommandResultDtoSchema.shape.occurrence._zod.def.innerType.parse(orderPending)
    ).toMatchObject(orderPending)
    expect(
      resolveRuleOccurrenceInputDtoSchema.parse({
        commandId,
        encounterId,
        expectedVersion: 8,
        expectedOccurrenceVersion: 5,
        occurrenceId: encounterId,
        resolution: {
          kind: 'ENTER_INTEGER',
          requestId: 'initiative-score',
          value: 17
        },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }).resolution
    ).toEqual({ kind: 'ENTER_INTEGER', requestId: 'initiative-score', value: 17 })
    expect(
      resolveRuleOccurrenceInputDtoSchema.parse({
        commandId,
        encounterId,
        expectedVersion: 8,
        expectedOccurrenceVersion: 5,
        occurrenceId: encounterId,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: 'initiative-order',
          entityId: secondEntityId
        },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }).resolution
    ).toEqual({
      kind: 'INITIATIVE_ENTITY',
      requestId: 'initiative-order',
      entityId: secondEntityId
    })

    const applicationContext = {
      kind: 'ENCOUNTER_INITIATIVE' as const,
      schemaVersion: 1 as const,
      root: {
        rootCommandId: commandId,
        commandFingerprint: 'a'.repeat(64),
        commandType: 'START' as const,
        initiatorUserId: secondEntityId,
        requestedByUserId: commandId,
        correlationId: null,
        expectedEncounterVersion: 8,
        round: 1,
        policySnapshotChecksum: 'b'.repeat(64),
        initiativeBeforePin: {
          kind: 'INITIAL_START' as const,
          actorIds: [encounterId, secondEntityId]
        },
        stagedInitiativeRoundState: {
          round: {
            encounterId,
            round: 1,
            procedure: 'ACTOR_ROLL' as const,
            cadence: 'ENCOUNTER_START' as const,
            status: 'PREPARING' as const,
            policySnapshotChecksum: 'b'.repeat(64),
            nextTurnOrderOrdinal: 0,
            version: 0
          },
          participants: [
            {
              encounterId,
              round: 1,
              actorId: encounterId,
              sideId: '00000000-0000-4000-8000-000000000004',
              status: 'UNRESOLVED' as const,
              initiativeScore: null,
              declaration: null,
              declarationChecksum: null,
              evaluation: { occurrenceId: null, resultChecksum: null },
              tie: { occurrenceId: null, resultChecksum: null },
              turnOrderOrdinal: null,
              version: 0
            },
            {
              encounterId,
              round: 1,
              actorId: secondEntityId,
              sideId: '00000000-0000-4000-8000-000000000005',
              status: 'UNRESOLVED' as const,
              initiativeScore: null,
              declaration: null,
              declarationChecksum: null,
              evaluation: { occurrenceId: null, resultChecksum: null },
              tie: { occurrenceId: null, resultChecksum: null },
              turnOrderOrdinal: null,
              version: 0
            }
          ],
          sides: []
        }
      },
      phase: {
        kind: 'PRIMARY_SCORE' as const,
        scoreBatch: {
          completed: [],
          current: { kind: 'ACTOR' as const, id: encounterId },
          remaining: [{ kind: 'ACTOR' as const, id: secondEntityId }]
        }
      }
    }
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(applicationContext)
    ).toMatchObject(applicationContext)

    expect(() =>
      encounterCommandResultDtoSchema.shape.occurrence._zod.def.innerType.parse({
        ...evidencePending,
        pending: {
          ...evidencePending.pending,
          request: { ...evidencePending.pending.request, min: 2, max: 1 }
        }
      })
    ).toThrow()
    expect(() =>
      resolveRuleOccurrenceInputDtoSchema.parse({
        commandId,
        encounterId,
        expectedVersion: 8,
        expectedOccurrenceVersion: 5,
        occurrenceId: encounterId,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: 'initiative-order',
          entityId: 'foreign-entity'
        },
        type: 'RESOLVE_RULE_OCCURRENCE'
      })
    ).toThrow()
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...applicationContext,
        phase: {
          ...applicationContext.phase,
          scoreBatch: { ...applicationContext.phase.scoreBatch, continuation: {} }
        }
      })
    ).toThrow()
  })

  it('binds pending occurrence identity to its outer summary and canonicalizes resolution correlation', () => {
    const pending = {
      occurrenceId: encounterId,
      occurrenceVersion: 2,
      status: 'PENDING' as const,
      pending: {
        kind: 'D20_EVIDENCE' as const,
        occurrenceId: encounterId,
        occurrenceVersion: 2,
        encounterVersion: 3,
        rollerActorId: encounterId,
        request: {
          requestId: 'd20',
          min: 1 as const,
          max: 20 as const,
          rollMode: 'NORMAL' as const,
          keep: 'FIRST' as const,
          rollModes: offeredRollModes,
          derivedRollModeReasons: []
        },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL'] as const
      }
    }
    expect(
      encounterCommandResultDtoSchema.shape.occurrence._zod.def.innerType.parse(pending)
    ).toMatchObject(pending)
    expect(() =>
      encounterCommandResultDtoSchema.shape.occurrence._zod.def.innerType.parse({
        ...pending,
        pending: { ...pending.pending, occurrenceVersion: 1 }
      })
    ).toThrow()
    expect(() =>
      encounterCommandResultDtoSchema.shape.occurrence._zod.def.innerType.parse({
        ...pending,
        status: 'COMPLETE',
        pending: pending.pending
      })
    ).toThrow()
    expect(
      resolveRuleOccurrenceInputDtoSchema.parse({
        commandId,
        correlationId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
        encounterId,
        expectedVersion: 3,
        expectedOccurrenceVersion: 2,
        occurrenceId: encounterId,
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'd20', rollId: commandId },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }).correlationId
    ).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  })

  it('exposes only the closed movement-reaction choice projection and accepts its issued selection', () => {
    const optionId = 'a'.repeat(64)
    const pendingInput = {
      occurrenceId: encounterId,
      occurrenceVersion: 4,
      status: 'PENDING' as const,
      pending: {
        kind: 'MOVEMENT_REACTION' as const,
        occurrenceId: encounterId,
        occurrenceVersion: 4,
        encounterVersion: 7,
        choice: {
          pathDistance: 10,
          reactorActorId: encounterId,
          reactorTokenId: commandId,
          options: [
            {
              optionId,
              actionId: 'reaction-action',
              actionSourceKind: 'CHARACTER_ACTION' as const
            }
          ]
        },
        allowedResponses: ['DECLINE', 'OPTION'] as const
      }
    }
    const pending =
      encounterCommandResultDtoSchema.shape.occurrence._zod.def.innerType.parse(pendingInput)
    if (!pending || pending.pending?.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected a movement-reaction pending summary.')
    expect(pending.pending).toMatchObject({
      kind: 'MOVEMENT_REACTION',
      choice: { options: [{ optionId, actionId: 'reaction-action' }] }
    })
    expect(
      resolveRuleOccurrenceInputDtoSchema.parse({
        commandId,
        encounterId,
        expectedVersion: 7,
        expectedOccurrenceVersion: 4,
        occurrenceId: encounterId,
        resolution: { kind: 'OPTION', optionId },
        type: 'RESOLVE_RULE_OCCURRENCE'
      }).resolution
    ).toEqual({ kind: 'OPTION', optionId })
    expect(() =>
      encounterCommandResultDtoSchema.shape.occurrence._zod.def.innerType.parse({
        ...pendingInput,
        pending: {
          ...pendingInput.pending,
          choice: {
            ...pendingInput.pending.choice,
            options: [
              {
                ...pendingInput.pending.choice.options[0],
                actionSourceCurrentnessChecksum: 'b'.repeat(64)
              }
            ]
          }
        }
      })
    ).toThrow()
  })

  it('requires a Blueprint and no Session for each Campaign Encounter run', () => {
    expect(
      createEncounterInputDtoSchema.parse({
        campaignId: encounterId,
        blueprintId: encounterId,
        commandId
      }).blueprintId
    ).toBe(encounterId)
    expect(() =>
      createEncounterInputDtoSchema.parse({ campaignId: encounterId, commandId })
    ).toThrow()
    // The retired Session-scoped shape is refused rather than silently accepted.
    expect(() =>
      createEncounterInputDtoSchema.parse({
        campaignId: encounterId,
        sessionId: encounterId,
        blueprintId: encounterId,
        commandId
      })
    ).toThrow()
  })

  it('rejects legacy system and template fields on Run creation', () => {
    expect(() =>
      createEncounterInputDtoSchema.parse({
        campaignId: encounterId,
        templateId: encounterId,
        commandId
      })
    ).toThrow()
    expect(
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 1,
        type: 'START',
        systemId: encounterId
      })
    ).toMatchObject({ type: 'START', systemId: encounterId })
  })

  it('caps the number of enemies in a saved Blueprint', () => {
    expect(() =>
      createEncounterBlueprintInputDtoSchema.parse({
        gameSystemId: encounterId,
        commandId,
        name: 'Unbounded horde',
        enemies: Array.from({ length: MAX_ENCOUNTER_ACTORS + 1 }, () => ({
          kind: 'CREATURE',
          sourceId: encounterId
        }))
      })
    ).toThrow()
    expect(
      createEncounterBlueprintInputDtoSchema.parse({
        gameSystemId: encounterId,
        commandId,
        name: 'Maximum horde',
        enemies: Array.from({ length: MAX_ENCOUNTER_ACTORS }, () => ({
          kind: 'CREATURE' as const,
          sourceId: encounterId
        }))
      }).enemies
    ).toHaveLength(MAX_ENCOUNTER_ACTORS)
  })

  it('accepts enemy source references and custom stat rows, not forged snapshots', () => {
    const seededCreatureId = '00000000-0000-0000-0070-009200000000'
    expect(
      createEncounterBlueprintInputDtoSchema.parse({
        gameSystemId: encounterId,
        commandId,
        name: 'Goblin ambush',
        enemies: [
          { kind: 'CREATURE', sourceId: seededCreatureId },
          { kind: 'CUSTOM', label: 'Goblin scout', maxHitPoints: 7 }
        ]
      }).name
    ).toBe('Goblin ambush')
    expect(() =>
      createEncounterBlueprintInputDtoSchema.parse({
        gameSystemId: encounterId,
        commandId,
        name: 'Goblin ambush',
        enemies: []
      })
    ).toThrow()
    expect(() =>
      createEncounterBlueprintInputDtoSchema.parse({
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
      gameSystemId: encounterId,
      blueprintId: commandId,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      name: 'Goblin ambush',
      status: 'ACTIVE' as const,
      automationMode: 'ASSISTED' as const,
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
          controllerUserIds: [],
          disposition: 'HOSTILE' as const,
          initiative: 12,
          manualOrder: null,
          conditions: [],
          defeated: false,
          absence: null
        }
      ],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    }
    const withHealth = (health: unknown) => ({
      ...base,
      actors: [{ ...base.actors[0], health, unseenReason: null }]
    })
    expect(encounterPlayerProjectionDtoSchema.parse(withHealth(null)).actors[0]).not.toHaveProperty(
      'currentHitPoints'
    )
    expect(
      encounterPlayerProjectionDtoSchema.safeParse({
        ...base,
        actors: [{ ...base.actors[0], health: null, unseenReason: null, healthBand: 'WOUNDED' }]
      }).success
    ).toBe(false)
    // Each health display level carries only its own fields, and a bar only a coarse ratio.
    for (const health of [
      { level: 'DESCRIPTIVE', state: 'BLOODIED' },
      { level: 'BAR', ratio: 0.35 },
      { level: 'EXACT', current: 4, maximum: 7 }
    ])
      expect(encounterPlayerProjectionDtoSchema.safeParse(withHealth(health)).success).toBe(true)
    for (const health of [
      { level: 'HIDDEN' },
      { level: 'DESCRIPTIVE', state: 'BLOODIED', current: 4 },
      { level: 'BAR', ratio: 4 / 7 },
      { level: 'BAR', ratio: 0.35, maximum: 7 }
    ])
      expect(encounterPlayerProjectionDtoSchema.safeParse(withHealth(health)).success).toBe(false)
    expect(
      encounterGmProjectionDtoSchema.parse({
        ...base,
        healthDisplayDefault: 'HIDDEN',
        actors: [
          {
            ...base.actors[0],
            healthBand: 'WOUNDED',
            healthDisplay: null,
            systemId: null,
            stableTieKey: commandId,
            currentHitPoints: 4,
            maxHitPoints: 7,
            tempHitPoints: 0,
            defeated: false,
            absence: null,
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
    expect(encounterProjectionListDtoSchema.parse([withHealth(null)])).toHaveLength(1)
    expect(
      encounterGmProjectionDtoSchema.parse({
        ...base,
        healthDisplayDefault: 'HIDDEN',
        version: 0,
        actors: [
          {
            ...base.actors[0],
            healthBand: 'WOUNDED',
            healthDisplay: null,
            systemId: null,
            stableTieKey: commandId,
            currentHitPoints: 4,
            maxHitPoints: 7,
            tempHitPoints: 0,
            defeated: false,
            absence: null,
            resources: {},
            gmNotes: null,
            statBlock: null,
            features: []
          }
        ]
      }).version
    ).toBe(0)
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

  it('accepts only an optional UUID-backed prospective actor-side correction', () => {
    expect(
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'UPDATE_ACTOR',
        actorId: encounterId,
        sideId: commandId
      })
    ).toMatchObject({ type: 'UPDATE_ACTOR', actorId: encounterId, sideId: commandId })
    expect(() =>
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'UPDATE_ACTOR',
        actorId: encounterId,
        sideId: 'not-a-uuid'
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

  it('accepts a creature rest and bounds its actors', () => {
    const rest = { encounterId, commandId, expectedVersion: 2, type: 'CREATURE_REST' }
    expect(
      encounterCommandInputDtoSchema.parse({ ...rest, restKind: 'LONG', actorIds: [commandId] })
    ).toMatchObject({ type: 'CREATURE_REST', restKind: 'LONG', actorIds: [commandId] })
    for (const invalid of [
      { restKind: 'LONG', actorIds: [] },
      { restKind: 'LONG', actorIds: ['not-a-uuid'] },
      { restKind: 'DAILY', actorIds: [commandId] }
    ])
      expect(() => encounterCommandInputDtoSchema.parse({ ...rest, ...invalid })).toThrow()
  })

  it('rejects the retired rule-pack revision, upgrade command, and evaluator evidence', () => {
    const projection = {
      id: encounterId,
      campaignId: commandId,
      gameSystemId: encounterId,
      blueprintId: commandId,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      name: 'Encounter',
      status: 'PREPARED',
      automationMode: 'ASSISTED',
      version: 0,
      round: 0,
      currentActorId: null,
      actors: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    }
    expect(encounterPlayerProjectionDtoSchema.safeParse(projection).success).toBe(true)
    expect(
      encounterPlayerProjectionDtoSchema.safeParse({ ...projection, rulePackRevisionId: null })
        .success
    ).toBe(false)
    expect(
      encounterCommandInputDtoSchema.safeParse({
        encounterId,
        commandId,
        expectedVersion: 0,
        type: 'UPGRADE_RULE_PACK',
        revisionId: commandId
      }).success
    ).toBe(false)
    expect(
      encounterCommandResultDtoSchema.safeParse({
        projection,
        roll: null,
        resolution: null
      }).success
    ).toBe(false)
  })

  it('accepts the closed single-target action command and rejects legacy action inputs', () => {
    expect(
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_ACTION',
        actorId: encounterId,
        actionId: 'attack',
        target: { kind: 'ACTOR', actorId: commandId }
      })
    ).toMatchObject({
      type: 'RESOLVE_ACTION',
      actionId: 'attack',
      target: { kind: 'ACTOR', actorId: commandId }
    })
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
    const action = {
      encounterId,
      commandId,
      expectedVersion: 2,
      type: 'RESOLVE_ACTION',
      actorId: encounterId,
      actionId: 'attack',
      target: { kind: 'ACTOR', actorId: commandId }
    }
    expect(
      encounterCommandInputDtoSchema.parse({ ...action, visibility: 'PRIVATE' })
    ).toMatchObject({ visibility: 'PRIVATE' })
    const refused = encounterCommandInputDtoSchema.safeParse({ ...action, visibility: 'TABLE' })
    expect(refused.success).toBe(false)
    expect(
      refused.error?.issues.some(
        (issue) => issue.path.join('.') === 'visibility' && issue.code === 'invalid_value'
      )
    ).toBe(true)
  })

  it('names the action target as a closed kind and rejects the flat target field and unknown kinds', () => {
    const action = {
      encounterId,
      commandId,
      expectedVersion: 2,
      type: 'RESOLVE_ACTION',
      actorId: encounterId,
      actionId: 'attack'
    }
    expect(
      encounterCommandInputDtoSchema.safeParse({
        ...action,
        target: { kind: 'ACTOR', actorId: commandId }
      }).success
    ).toBe(true)
    for (const rejected of [
      { targetActorId: commandId },
      { target: { kind: 'ACTOR', actorId: commandId }, targetActorId: commandId },
      { target: { kind: 'ACTOR', actorId: commandId, extra: true } },
      { target: { kind: 'POINT', actorId: commandId } },
      { target: { actorId: commandId } },
      { target: { kind: 'ACTOR', actorId: 'not-a-uuid' } }
    ])
      expect(
        encounterCommandInputDtoSchema.safeParse({ ...action, ...rejected }).success,
        JSON.stringify(rejected)
      ).toBe(false)
  })

  it('names a point-origin area target as a POINT with finite Scene coordinates only', () => {
    const action = {
      encounterId,
      commandId,
      expectedVersion: 2,
      type: 'RESOLVE_ACTION',
      actorId: encounterId,
      actionId: 'fireball'
    }
    const scene = { sceneId: encounterId, expectedSceneVersion: 3 }
    expect(
      encounterCommandInputDtoSchema.parse({
        ...action,
        target: { kind: 'POINT', ...scene, point: { x: 12.5, y: -30 } }
      })
    ).toMatchObject({ target: { kind: 'POINT', ...scene, point: { x: 12.5, y: -30 } } })
    for (const target of [
      { kind: 'POINT', ...scene },
      { kind: 'POINT', point: { x: 1, y: 2 } },
      { kind: 'POINT', sceneId: encounterId, point: { x: 1, y: 2 } },
      { kind: 'POINT', expectedSceneVersion: 3, point: { x: 1, y: 2 } },
      { kind: 'POINT', ...scene, point: { x: 1 } },
      { kind: 'POINT', ...scene, point: { x: 1, y: 2, z: 3 } },
      { kind: 'POINT', ...scene, point: { x: Number.POSITIVE_INFINITY, y: 0 } },
      { kind: 'POINT', ...scene, point: { x: 1, y: 2 }, actorId: commandId },
      { kind: 'POINT', ...scene, point: { x: 1, y: 2 }, extra: true }
    ])
      expect(
        encounterCommandInputDtoSchema.safeParse({ ...action, target }).success,
        JSON.stringify(target)
      ).toBe(false)
  })

  it('closes the GM command that takes one creature out of a pending area', () => {
    const removal = {
      type: 'REMOVE_AREA_TARGET',
      encounterId,
      commandId,
      expectedVersion: 2,
      occurrenceId: encounterId,
      expectedOccurrenceVersion: 1,
      expectedCaughtChecksum: 'a'.repeat(64),
      actorId: commandId
    }
    expect(encounterCommandInputDtoSchema.parse(removal)).toEqual(removal)
    for (const change of [
      { expectedCaughtChecksum: 'not-a-checksum' },
      { actorId: 'wolf' },
      { expectedOccurrenceVersion: -1 },
      { extra: true }
    ])
      expect(
        encounterCommandInputDtoSchema.safeParse({ ...removal, ...change }).success,
        JSON.stringify(change)
      ).toBe(false)
  })

  it('accepts only closed optional combat action intent selections', () => {
    const fieldId = 'a'.repeat(64)
    const positionFieldId = 'b'.repeat(64)
    const definitionId = '00000000-0000-4000-8000-0000000000AB'
    const entityId = '00000000-0000-4000-8000-0000000000CD'
    const intent = optionalCombatActionIntentDtoSchema.parse({
      optionId: 'c'.repeat(64),
      definitionId,
      selectionContract: 'd'.repeat(64),
      selections: [
        { fieldId, value: { kind: 'ENTITY', entityId } },
        {
          fieldId: positionFieldId,
          value: { kind: 'POSITION', position: { x: 12, y: -5 } }
        }
      ]
    })

    expect(intent.definitionId).toBe(definitionId.toLowerCase())
    expect(intent.selections[0]).toMatchObject({ value: { entityId: entityId.toLowerCase() } })
    expect(intent.selections[1]).toMatchObject({ value: { position: { x: 12, y: -5 } } })

    expect(() =>
      optionalCombatActionIntentDtoSchema.parse({
        ...intent,
        selections: [intent.selections[1], intent.selections[0]]
      })
    ).toThrow(/ascending/)
    expect(() =>
      optionalCombatActionIntentDtoSchema.parse({
        ...intent,
        selections: [intent.selections[0], intent.selections[0]]
      })
    ).toThrow(/unique and ascending/)
    expect(() =>
      optionalCombatActionIntentDtoSchema.parse({
        ...intent,
        unexpected: true
      })
    ).toThrow()
    expect(() =>
      optionalCombatActionIntentDtoSchema.parse({
        ...intent,
        definitionId: 'not-a-uuid'
      })
    ).toThrow()
    expect(() =>
      optionalCombatActionIntentDtoSchema.parse({
        ...intent,
        selections: [
          {
            fieldId,
            value: { kind: 'POSITION', position: { x: Number.POSITIVE_INFINITY, y: 0 } }
          }
        ]
      })
    ).toThrow()
  })

  it('accepts only bounded physical concentration dice without a client-selected total', () => {
    expect(
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_RULE_OCCURRENCE',
        correlationId: null,
        occurrenceId: encounterId,
        expectedOccurrenceVersion: 0,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'concentration-d20',
          rawFaces: [4, 17],
          rollMode: 'ADVANTAGE'
        }
      })
    ).toMatchObject({
      type: 'RESOLVE_RULE_OCCURRENCE',
      resolution: {
        kind: 'ENTER_DICE',
        requestId: 'concentration-d20',
        rawFaces: [4, 17],
        rollMode: 'ADVANTAGE'
      }
    })
    const enterDice = (extra: Record<string, unknown>) =>
      encounterCommandInputDtoSchema.safeParse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId: encounterId,
        expectedOccurrenceVersion: 0,
        resolution: { kind: 'ENTER_DICE', requestId: 'concentration-d20', ...extra }
      }).success
    // The wire checks code shape only; the System adapter decides which modes and face counts exist.
    expect(enterDice({ rawFaces: [17], rollMode: 'NORMAL' })).toBe(true)
    expect(enterDice({ rawFaces: [4, 17], rollMode: 'DISADVANTAGE' })).toBe(true)
    expect(enterDice({ rawFaces: [17], rollMode: 'SUPER_ADVANTAGE' })).toBe(true)
    expect(enterDice({ rawFaces: [17], rollMode: 'not a code' })).toBe(false)
    // The server derives which face a mode keeps, so the client cannot send it.
    expect(enterDice({ rawFaces: [17], rollMode: 'NORMAL', keep: 'FIRST' })).toBe(false)
    expect(
      encounterCommandInputDtoSchema.safeParse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId: encounterId,
        expectedOccurrenceVersion: 0,
        resolution: { kind: 'ENTER_DICE', requestId: 'concentration-d20', rawFaces: [17] }
      }).success
    ).toBe(false)
    expect(() =>
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId: encounterId,
        expectedOccurrenceVersion: 0,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'concentration-d20',
          rawFaces: [4, 17, 20],
          rollMode: 'ADVANTAGE'
        }
      })
    ).toThrow()
    expect(() =>
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId: encounterId,
        expectedOccurrenceVersion: 0,
        resolution: {
          kind: 'ENTER_DIE',
          requestId: 'concentration-d20',
          value: 17
        }
      })
    ).toThrow()
  })

  it('records app rolls by request and settles SYSTEM_ROLL only by a recorded roll id', () => {
    const rollInput = {
      encounterId,
      commandId,
      expectedVersion: 2,
      type: 'ROLL_RULE_EVIDENCE',
      occurrenceId: encounterId,
      expectedOccurrenceVersion: 0,
      requestId: 'attack-d20'
    }
    expect(encounterCommandInputDtoSchema.parse({ ...rollInput, rollMode: 'ADVANTAGE' })).toEqual({
      ...rollInput,
      rollMode: 'ADVANTAGE'
    })
    expect(encounterCommandInputDtoSchema.parse({ ...rollInput, rollMode: null })).toMatchObject({
      type: 'ROLL_RULE_EVIDENCE',
      rollMode: null
    })
    expect(encounterCommandInputDtoSchema.safeParse(rollInput).success).toBe(false)
    expect(
      encounterCommandInputDtoSchema.safeParse({ ...rollInput, rollMode: 'NORMAL', faces: [20] })
        .success
    ).toBe(false)

    const systemRoll = (resolution: Record<string, unknown>) =>
      encounterCommandInputDtoSchema.safeParse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId: encounterId,
        expectedOccurrenceVersion: 0,
        resolution: { kind: 'SYSTEM_ROLL', requestId: 'attack-d20', ...resolution }
      }).success
    expect(systemRoll({ rollId: commandId })).toBe(true)
    expect(systemRoll({})).toBe(false)
    expect(systemRoll({ rollId: 'not-a-roll' })).toBe(false)
    expect(systemRoll({ rollId: commandId, faces: [20] })).toBe(false)
  })

  it('accepts only closed GM-adjudicated Speed Factor selections', () => {
    expect(
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId: encounterId,
        expectedOccurrenceVersion: 0,
        resolution: {
          kind: 'INITIATIVE_DECLARATION',
          requestId: 'speed-factor',
          primary: {
            kind: 'GM_ADJUDICATED',
            optionId: 'GM_ADJUDICATED',
            actorSize: 'TINY',
            factorIds: ['00000000-0000-4000-8000-0000000004e4', '00000000-0000-4000-8000-0000000004e7'],
            spellLevel: 3
          },
          bonus: null
        }
      })
    ).toMatchObject({
      resolution: { kind: 'INITIATIVE_DECLARATION', primary: { kind: 'GM_ADJUDICATED' } }
    })
    expect(() =>
      encounterCommandInputDtoSchema.parse({
        encounterId,
        commandId,
        expectedVersion: 2,
        type: 'RESOLVE_RULE_OCCURRENCE',
        occurrenceId: encounterId,
        expectedOccurrenceVersion: 0,
        resolution: {
          kind: 'INITIATIVE_DECLARATION',
          requestId: 'speed-factor',
          primary: {
            kind: 'GM_ADJUDICATED',
            optionId: 'GM_ADJUDICATED',
            actorSize: 'TINY',
            factorIds: ['00000000-0000-4000-8000-0000000004e4', '00000000-0000-4000-8000-0000000004e4'],
            spellLevel: 3
          },
          bonus: null
        }
      })
    ).toThrow()
  })

  it('exposes only a compact authorized pending concentration summary', () => {
    const projection = encounterPlayerProjectionDtoSchema.parse({
      id: encounterId,
      campaignId: commandId,
      gameSystemId: encounterId,
      blueprintId: encounterId,
      blueprintVersion: 1,
      blueprintChecksum: 'a'.repeat(64),
      name: 'Encounter',
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      version: 2,
      round: 1,
      currentActorId: null,
      actors: [],
      createdAt: '2026-08-07T00:00:00.000Z',
      updatedAt: '2026-08-07T00:00:00.000Z'
    })
    const parsed = encounterCommandResultDtoSchema.parse({
      projection,
      roll: null,
      occurrence: {
        occurrenceId: encounterId,
        occurrenceVersion: 0,
        status: 'PENDING',
        pending: {
          kind: 'D20_EVIDENCE',
          occurrenceId: encounterId,
          occurrenceVersion: 0,
          encounterVersion: 2,
          rollerActorId: null,
          request: {
            requestId: 'issued-d20',
            min: 1,
            max: 20,
            rollMode: 'ADVANTAGE',
            keep: 'HIGHER',
            rollModes: offeredRollModes,
            derivedRollModeReasons: ['Flanking']
          },
          allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
        }
      }
    })
    expect(parsed.occurrence?.pending).toMatchObject({
      request: {
        requestId: 'issued-d20',
        rollMode: 'ADVANTAGE',
        keep: 'HIGHER',
        rollModes: offeredRollModes,
        derivedRollModeReasons: ['Flanking']
      }
    })
    for (const rollModes of [undefined, []])
      expect(
        pendingEncounterRuleOccurrenceSummaryDtoSchema.safeParse({
          kind: 'D20_EVIDENCE',
          occurrenceId: encounterId,
          occurrenceVersion: 0,
          encounterVersion: 2,
          rollerActorId: null,
          request: {
            requestId: 'issued-d20',
            min: 1,
            max: 20,
            rollMode: 'NORMAL',
            keep: 'FIRST',
            rollModes,
            derivedRollModeReasons: []
          },
          allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
        }).success
      ).toBe(false)
    expect(() =>
      encounterCommandResultDtoSchema.parse({
        projection,
        roll: null,
        occurrence: {
          occurrenceId: encounterId,
          occurrenceVersion: 0,
          status: 'PENDING',
          pending: {
            kind: 'D20_EVIDENCE',
            occurrenceId: encounterId,
            occurrenceVersion: 0,
            encounterVersion: 2,
            rollerActorId: null,
            request: {
              requestId: 'issued-d20',
              min: 1,
              max: 20,
              rollMode: 'NORMAL',
              keep: 'FIRST',
              rollModes: offeredRollModes,
              derivedRollModeReasons: []
            },
            allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL'],
            contextChecksum: 'a'.repeat(64)
          }
        }
      })
    ).toThrow()
  })

  it('closes Creature equipment replacement commands to exact identifiers', () => {
    const loadoutEntryId = '00000000-0000-4000-8000-000000000009'
    const equipmentId = '00000000-0000-4000-8000-000000000010'
    expect(
      encounterCommandInputDtoSchema.parse({
        type: 'REPLACE_CREATURE_EQUIPMENT',
        encounterId,
        commandId,
        expectedVersion: 2,
        actorId: encounterId,
        loadoutEntryId,
        equipmentId
      })
    ).toMatchObject({ type: 'REPLACE_CREATURE_EQUIPMENT', loadoutEntryId, equipmentId })
    expect(() =>
      encounterCommandInputDtoSchema.parse({
        type: 'REPLACE_CREATURE_EQUIPMENT',
        encounterId,
        commandId,
        expectedVersion: 2,
        actorId: encounterId,
        loadoutEntryId,
        equipmentId,
        replacementPayload: {}
      })
    ).toThrow()
    expect(() =>
      encounterCommandInputDtoSchema.parse({
        type: 'REPLACE_CREATURE_EQUIPMENT',
        encounterId,
        commandId,
        expectedVersion: 2,
        actorId: encounterId,
        loadoutEntryId: 'not-a-uuid',
        equipmentId
      })
    ).toThrow()
  })
})
