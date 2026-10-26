import { expect, it, vi } from 'vitest'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterActiveRuleEffectStoredSchema } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { RoomEncounterStore, type RoomDocument } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { readRoomEncounterTurnCapture } from './roomEncounterTurnCapture.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { storedRunDocuments } from './testing/storedRunFixture.js'

it('admits native turn scopes and pages the selected actor effects without a backend read', async () => {
  const campaignId = uuid(0xe00)
  // Creature actors are stored with the facts their System evaluated, so the System is installed.
  const systemId = DND5E_SYSTEM_ID
  const epoch = uuid(0xe02)
  const gmId = uuid(0xe03)
  const playerId = uuid(0xe04)
  const otherPlayerId = uuid(0xe05)
  const encounterId = uuid(0xe06)
  const sideId = uuid(0xe07)
  const definitionId = uuid(0xe08)
  const now = '2026-09-30T12:00:00.000Z'
  const actor = encounterRunActorStateSchema.parse({
    id: uuid(0xe10),
    encounterId,
    sideId,
    label: 'Controlled Creature',
    kind: 'CREATURE',
    sourceId: uuid(0xe11),
    sourceRevision: 1,
    stableTieKey: uuid(0xe10),
    public: true,
    controllerUserIds: [playerId],
    disposition: 'HOSTILE',
    initiative: 0,
    manualOrder: 0,
    healthDisplay: null,
    systemId,
    resources: {},
    gmNotes: 'Private native preparation input',
    snapshot: {},
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: [],
    defeated: false,
    form: null,
    absence: null,
    createdAt: now,
    updatedAt: now
  })
  const otherActor = encounterRunActorStateSchema.parse({
    ...actor,
    id: uuid(0xe12),
    stableTieKey: uuid(0xe12),
    controllerUserIds: []
  })
  const optionalCombatSnapshot = { schemaVersion: 1, gameSystemId: systemId, definitions: [] }
  const state = encounterRunStateSchema.parse({
    id: encounterId,
    campaignId,
    gameSystemId: systemId,
    blueprintId: uuid(0xe09),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Native turn capture',
    status: 'ACTIVE',
    automationMode: 'MANUAL',
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: 1,
    currentActorId: actor.id,
    actorIds: [actor.id, otherActor.id],
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 0,
    sides: [{ id: sideId, label: 'Creatures', sortOrder: 0 }],
    createdAt: now,
    updatedAt: now
  })
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    linkedEffectId: null,
    originLevel: null,
    stateContributions: [],
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: encounterId,
      sourceOccurrenceId: uuid(0xe20),
      rootCommandId: uuid(0xe21),
      sourceActorId: actor.id
    },
    authoredEffectId: definitionId,
    compiledEntryId: uuid(0xe22),
    frozenGraphNodeId: 'entry',
    frozenGraph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId: systemId,
        definitionFamilyKey: 'effect',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
      sourceEntryBindings: [{ sourceEntryId: uuid(0xe22), nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      anchor: 'HOLDER',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'ENCOUNTER',
      expiration: {
        kind: 'TICKS',
        initialRemaining: 3,
        decrementStage: 'END_OF_TURN'
      }
    }
  })
  const lifecycle = { schemaVersion: 1, remainingTicks: 3 }
  const members = [
    { userId: gmId, role: 'OWNER' as const, membershipEpoch: now },
    { userId: playerId, role: 'PLAYER' as const, membershipEpoch: now },
    { userId: otherPlayerId, role: 'PLAYER' as const, membershipEpoch: now }
  ]
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({ members })
  )
  authorization.preferences.find(({ userId }) => userId === playerId)!.autoRollDice = true
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    { campaignId, systemId, ownerUserId: gmId, members }
  )
  if (authority.kind !== 'AUTHORITY') throw new Error('Missing Campaign authority fixture.')
  // A command observes the play scope beside the authority the room holds.
  const observed = [
    ...authority.revisions,
    { scope: 'PLAY' as const, id: campaignId, revision: null }
  ]
  const documents: RoomDocument[] = [
    ...authority.documents,
    ...(await storedRunDocuments(state, [actor, otherActor])),
    ...[5, 1, 4, 0, 3, 2, 6].map((index) => ({
      table: 'encounterActiveRuleEffects' as const,
      id: `turn:effect:${index}`,
      creationTime: index,
      fields: encounterActiveRuleEffectStoredSchema.parse({
        id: uuid(0xe30 + index),
        encounterId,
        targetActorId: index === 6 ? otherActor.id : actor.id,
        maintainedEffectStateId: null,
        createdOrdinal: 7 - index,
        version: 1,
        definitionJson: JSON.stringify(definition),
        definitionChecksum: checksumCanonicalJson(definition),
        lifecycle,
        lifecycleChecksum: checksumCanonicalJson(lifecycle),
        createdAt: now,
        updatedAt: now
      })
    }))
  ]
  const { storage } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  store.hydrate({
    epoch,
    documents,
    records: [
      {
        kind: 'ROOM_INPUT',
        key: 'AUTHORITY',
        revision: JSON.stringify(authority.revisions),
        json: JSON.stringify({ ...authority, documents: [] })
      }
    ]
  })
  const read = vi.fn(async () => {
    throw new Error('Turn capture must not read Convex.')
  })
  const inputs = new RoomInputs(store, read, async () => [])
  const scene = {
    readSceneHeader: async () => {
      throw new Error('Actor capture must not read Scene state.')
    },
    readSceneEntities: async () => {
      throw new Error('Actor capture must not read Scene entities.')
    }
  }
  await store.transact(async (transaction) => {
    const context = (userId: string) =>
      roomEncounterReadTransaction({
        store,
        transaction,
        inputs,
        authorization,
        campaignId,
        epoch,
        userId,
        observed
      })
    const owner = await context(gmId)
    const player = await context(playerId)
    const input: LiveSessionEncounterRulesInput = {
      campaignId,
      authorityEpoch: epoch,
      expectedUserId: gmId,
      expectedRole: 'OWNER',
      encounterId,
      expectedVersion: 1,
      request: { kind: 'ACTOR', actorId: actor.id }
    }
    const capture = (ctx: typeof owner, value: LiveSessionEncounterRulesInput) =>
      readRoomEncounterTurnCapture(ctx, inputs, transaction, value, observed, scene)
    const first = await capture(owner, input)
    if (first.kind !== 'ACTOR') throw new Error('Missing actor capture.')
    expect(first.actor).toEqual(actor)
    expect(first.effects.map(({ id }) => id)).toEqual(
      [0, 1, 2, 3].map((index) => uuid(0xe30 + index))
    )
    expect(first.continueAfter).toBe(uuid(0xe33))
    expect(first.revisions).toEqual(observed)
    const second = await capture(owner, {
      ...input,
      request: { kind: 'EFFECTS', actorId: actor.id, afterEffectId: first.continueAfter }
    })
    if (second.kind !== 'EFFECTS') throw new Error('Missing effects capture.')
    expect(second.effects.map(({ id }) => id)).toEqual([uuid(0xe34), uuid(0xe35)])
    expect(second.continueAfter).toBeNull()
    await expect(capture(owner, { ...input, expectedUserId: playerId })).rejects.toThrow(
      'identity mismatch'
    )
    await expect(capture(owner, { ...input, expectedRole: 'PLAYER' })).rejects.toThrow(
      'role mismatch'
    )
    await expect(capture(owner, { ...input, expectedVersion: 2 })).rejects.toThrow(
      'scope or version mismatch'
    )
    await expect(capture(owner, { ...input, authorityEpoch: uuid(0xe40) })).rejects.toThrow(
      'live authority changed'
    )
    await expect(
      capture(owner, { ...input, request: { kind: 'ACTOR_TOKEN_BINDINGS' } })
    ).resolves.toMatchObject({ kind: 'ACTOR_TOKEN_BINDINGS', bindings: [] })
    const playerInput: LiveSessionEncounterRulesInput = {
      ...input,
      expectedUserId: playerId,
      expectedRole: 'PLAYER'
    }
    await expect(capture(player, playerInput)).rejects.toThrow('role mismatch')
    const command = {
      type: 'ADVANCE_TURN' as const,
      encounterId,
      commandId: uuid(0xe41),
      expectedVersion: 1
    }
    const admitted = await capture(player, { ...playerInput, turnCommand: command })
    if (admitted.kind !== 'ACTOR') throw new Error('Missing admitted player capture.')
    expect(admitted.actor).toEqual(actor)
    expect(admitted.effects).toEqual(first.effects)
    const otherPlayer = await context(otherPlayerId)
    await expect(
      capture(otherPlayer, {
        ...playerInput,
        expectedUserId: otherPlayerId,
        turnCommand: command
      })
    ).rejects.toThrow('NOT_ACTOR_CONTROLLER')
    const turn = await capture(owner, { ...input, request: { kind: 'TURN_COMMAND', command } })
    expect(turn).toMatchObject({
      kind: 'TURN_COMMAND',
      campaignOwnerUserId: gmId,
      autoRollDice: false,
      autoRollByActorId: { [actor.id]: true, [otherActor.id]: false },
      responderControlledActorIds: [actor.id, otherActor.id].sort(),
      command,
      fingerprint: checksumCanonicalJson(command),
      occurrenceVersion: null,
      snapshot: null,
      result: null,
      appRoll: null
    })
  })
  expect(read).not.toHaveBeenCalled()
  expect(store.sequence).toBe(0)
  expect(store.documents('encounterRunCommands')).toEqual([])
})

it.each([
  {
    name: 'frozen Character actor that is still assigned',
    assigned: true,
    frozenState: {
      currentHitPoints: 7,
      maxHitPoints: 11,
      tempHitPoints: 0,
      conditions: [],
      deathSaves: { successes: 0, failures: 0, stable: false }
    }
  },
  { name: 'unfrozen Character actor without an assignment', assigned: false, frozenState: null }
])('refuses actor and effects capture for a departed $name (D74)', async (departed) => {
  const campaignId = uuid(0xe50)
  const systemId = DND5E_SYSTEM_ID
  const epoch = uuid(0xe51)
  const gmId = uuid(0xe52)
  const playerId = uuid(0xe53)
  const characterId = uuid(0xe54)
  const encounterId = uuid(0xe55)
  const sideId = uuid(0xe56)
  const now = '2026-09-30T12:00:00.000Z'
  const actor = encounterRunActorStateSchema.parse({
    id: uuid(0xe57),
    encounterId,
    sideId,
    label: 'Departed Character',
    kind: 'CHARACTER',
    sourceId: characterId,
    stableTieKey: uuid(0xe57),
    public: true,
    controllerUserIds: [],
    disposition: 'HOSTILE',
    initiative: 0,
    manualOrder: 0,
    healthDisplay: null,
    systemId,
    resources: {},
    gmNotes: null,
    snapshot: {},
    frozenState: departed.frozenState,
    absence: null,
    form: null,
    createdAt: now,
    updatedAt: now
  })
  const optionalCombatSnapshot = { schemaVersion: 1, gameSystemId: systemId, definitions: [] }
  const state = encounterRunStateSchema.parse({
    id: encounterId,
    campaignId,
    gameSystemId: systemId,
    blueprintId: uuid(0xe58),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Departed Character capture',
    status: 'ACTIVE',
    automationMode: 'MANUAL',
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: 1,
    currentActorId: actor.id,
    actorIds: [actor.id],
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 0,
    sides: [{ id: sideId, label: 'Characters', sortOrder: 0 }],
    createdAt: now,
    updatedAt: now
  })
  const members = [
    { userId: gmId, role: 'OWNER' as const, membershipEpoch: now },
    { userId: playerId, role: 'PLAYER' as const, membershipEpoch: now }
  ]
  const assignments = departed.assigned ? [{ userId: playerId, characterId }] : []
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({ members, assignments })
  )
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    { campaignId, systemId, ownerUserId: gmId, members, assignments }
  )
  if (authority.kind !== 'AUTHORITY') throw new Error('Missing Campaign authority fixture.')
  const observed = [
    ...authority.revisions,
    { scope: 'PLAY' as const, id: campaignId, revision: null }
  ]
  const { storage } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  store.hydrate({
    epoch,
    documents: [...authority.documents, ...(await storedRunDocuments(state, [actor]))],
    records: [
      {
        kind: 'ROOM_INPUT',
        key: 'AUTHORITY',
        revision: JSON.stringify(authority.revisions),
        json: JSON.stringify({ ...authority, documents: [] })
      }
    ]
  })
  const inputs = new RoomInputs(
    store,
    async () => {
      throw new Error('Turn capture must not read Convex.')
    },
    async () => []
  )
  const scene = {
    readSceneHeader: async () => {
      throw new Error('Actor capture must not read Scene state.')
    },
    readSceneEntities: async () => {
      throw new Error('Actor capture must not read Scene entities.')
    }
  }
  await store.transact(async (transaction) => {
    const owner = await roomEncounterReadTransaction({
      store,
      transaction,
      inputs,
      authorization,
      campaignId,
      epoch,
      userId: gmId,
      observed
    })
    const input: LiveSessionEncounterRulesInput = {
      campaignId,
      authorityEpoch: epoch,
      expectedUserId: gmId,
      expectedRole: 'OWNER',
      encounterId,
      expectedVersion: 1,
      request: { kind: 'ACTOR', actorId: actor.id }
    }
    const refusal = {
      data: {
        code: 'DOMAIN_REJECTED',
        reason: 'TARGET_UNAVAILABLE',
        message: 'That Character has left the Campaign.'
      }
    }
    for (const request of [
      input.request,
      { kind: 'EFFECTS' as const, actorId: actor.id, afterEffectId: null }
    ])
      await expect(
        readRoomEncounterTurnCapture(
          owner,
          inputs,
          transaction,
          { ...input, request },
          observed,
          scene
        )
      ).rejects.toMatchObject(refusal)
  })
})
