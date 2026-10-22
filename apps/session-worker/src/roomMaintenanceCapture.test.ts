import { expect, it, vi } from 'vitest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  activeRuleEffectDefinitionDtoSchema,
  encounterMaintainedEffectDescriptorDtoSchema
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import {
  characterActiveRuleEffectStoredSchema,
  encounterActiveRuleEffectStoredSchema,
  encounterMaintainedEffectStateStoredSchema
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { liveSessionEncounterRulesResponseSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { RoomEncounterStore, type RoomDocument } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { readRoomMaintenanceCapture } from './roomMaintenanceCapture.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { storedRunDocuments } from './testing/storedRunFixture.js'

it('pages both native dependent owner kinds through exhaustion and rejects cursors outside the selected scope', async () => {
  const campaignId = uuid(0xd00)
  // Creature actors are stored with the facts their System evaluated, so the System is installed.
  const systemId = DND5E_SYSTEM_ID
  const epoch = uuid(0xd02)
  const gmId = uuid(0xd03)
  const encounterId = uuid(0xd04)
  const stateId = uuid(0xd05)
  const otherStateId = uuid(0xd06)
  const definitionId = uuid(0xd07)
  const now = '2026-09-30T12:00:00.000Z'
  const sideId = uuid(0xd08)
  const actors = [0, 1].map((ordinal) =>
    encounterRunActorStateSchema.parse({
      id: uuid(0xd10 + ordinal),
      encounterId,
      sideId,
      label: `Owner ${ordinal}`,
      kind: 'CREATURE',
      sourceId: uuid(0xd20 + ordinal),
      sourceRevision: 1,
      stableTieKey: uuid(0xd10 + ordinal),
      public: true,
      controllerUserIds: [],
      disposition: 'HOSTILE',
      initiative: 0,
      manualOrder: ordinal,
      healthDisplay: null,
      systemId,
      resources: {},
      gmNotes: null,
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
  )
  const optionalCombatSnapshot = { schemaVersion: 1, gameSystemId: systemId, definitions: [] }
  const state = encounterRunStateSchema.parse({
    id: encounterId,
    campaignId,
    gameSystemId: systemId,
    blueprintId: uuid(0xd09),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Maintenance capture',
    status: 'ACTIVE',
    automationMode: 'MANUAL',
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: 1,
    currentActorId: null,
    actorIds: actors.map(({ id }) => id),
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 0,
    sides: [{ id: sideId, label: 'Owners', sortOrder: 0 }],
    createdAt: now,
    updatedAt: now
  })
  const definition = activeRuleEffectDefinitionDtoSchema.parse({
    schemaVersion: 2,
    linkedEffectId: null,
    stateContributions: [],
    origin: {
      kind: 'ENCOUNTER',
      sourceAggregateId: encounterId,
      sourceOccurrenceId: uuid(0xd30),
      rootCommandId: uuid(0xd31),
      sourceActorId: actors[0]!.id
    },
    authoredEffectId: definitionId,
    compiledEntryId: uuid(0xd32),
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
      sourceEntryBindings: [{ sourceEntryId: uuid(0xd32), nodeId: 'entry' }],
      outputs: { result: { kind: 'LITERAL', value: true } }
    },
    adapterFacts: {},
    perceptionContributions: [],
    recurrence: {
      recurrenceStage: 'NONE',
      consumeOnFirstEvents: [],
      endOnEvents: [],
      endOnTriggers: [],
      endOnConditionIds: [],
      holderEnd: null,
      lifetimeScope: 'ENCOUNTER',
      expiration: {
        kind: 'TICKS',
        initialRemaining: 3,
        decrementStage: 'END_OF_TURN',
        anchor: 'HOLDER'
      }
    }
  })
  const descriptor = encounterMaintainedEffectDescriptorDtoSchema.parse({
    schemaVersion: 2,
    maintenanceDefinitionId: definitionId,
    definitionChecksum: 'b'.repeat(64),
    provenance: { kind: 'ACTION', sourceActionId: uuid(0xd31), sourceOccurrenceId: uuid(0xd30) },
    sourceActorId: actors[0]!.id,
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
  })
  const lifecycle = { schemaVersion: 1, remainingTicks: 3 }
  const members = [{ userId: gmId, role: 'OWNER' as const, membershipEpoch: now }]
  const authority = roomInputsResponse(
    { kind: 'AUTHORITY', cursor: null },
    {
      campaignId,
      systemId,
      ownerUserId: gmId,
      members,
      // Only an assigned Character's dependents are the room's to count (D81).
      assignments: [0, 1].map((index) => ({
        characterId: uuid(0xd60 + index),
        userId: uuid(0xd70 + index)
      }))
    }
  )
  if (authority.kind !== 'AUTHORITY') throw new Error('Missing Campaign authority fixture.')
  const documents: RoomDocument[] = [
    ...authority.documents,
    ...(await storedRunDocuments(state, actors)),
    ...[stateId, otherStateId].map((id, index) => {
      const value = {
        ...descriptor,
        maintenanceDefinitionId: index === 0 ? definitionId : uuid(0xd33)
      }
      return {
        table: 'encounterMaintainedEffectStates' as const,
        id: `maintenance:slot:${index}`,
        creationTime: 0,
        fields: encounterMaintainedEffectStateStoredSchema.parse({
          id,
          encounterId,
          ownerActorId: actors[0]!.id,
          maintenanceDefinitionId: value.maintenanceDefinitionId,
          descriptorJson: JSON.stringify(value),
          descriptorChecksum: checksumCanonicalJson(value),
          version: 1,
          createdAt: now,
          updatedAt: now
        })
      }
    })
  ]
  for (const ownerKind of ['CHARACTER', 'ENCOUNTER_ACTOR'] as const) {
    for (let index = 0; index < 7; index++) {
      const common = {
        id: uuid((ownerKind === 'CHARACTER' ? 0xd40 : 0xd50) + index),
        maintainedEffectStateId: index === 6 ? otherStateId : stateId,
        createdOrdinal: index + 1,
        version: 1,
        definitionJson: JSON.stringify(definition),
        definitionChecksum: checksumCanonicalJson(definition),
        lifecycle,
        lifecycleChecksum: checksumCanonicalJson(lifecycle),
        createdAt: now,
        updatedAt: now
      }
      documents.push(
        ownerKind === 'CHARACTER'
          ? {
              table: 'characterActiveRuleEffects',
              id: `${ownerKind}:effect:${index}`,
              creationTime: 0,
              fields: characterActiveRuleEffectStoredSchema.parse({
                ...common,
                characterId: uuid(0xd60 + (index % 2)),
                concentrationCasterCharacterId: null,
                sourceEncounterId: encounterId
              })
            }
          : {
              table: 'encounterActiveRuleEffects',
              id: `${ownerKind}:effect:${index}`,
              creationTime: 0,
              fields: encounterActiveRuleEffectStoredSchema.parse({
                ...common,
                encounterId,
                targetActorId: actors[index % 2]!.id
              })
            }
      )
    }
  }
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
    throw new Error('Maintenance capture must not read Convex.')
  })
  const inputs = new RoomInputs(store, read, async () => [])
  await store.transact(async (transaction) => {
    const ctx = await roomEncounterReadTransaction({
      store,
      transaction,
      inputs,
      authorization: liveSessionRoomAuthorizationSchema.parse(
        roomAuthorizationResponse({ members })
      ),
      campaignId,
      epoch,
      userId: gmId,
      observed: authority.revisions
    })
    for (const ownerKind of ['CHARACTER', 'ENCOUNTER_ACTOR'] as const) {
      const request = {
        kind: 'MAINTENANCE_DEPENDENTS' as const,
        actorId: actors[0]!.id,
        definitionId,
        stateId,
        ownerKind,
        cursor: null
      }
      const first = await readRoomMaintenanceCapture(ctx, state, request)
      if (first.kind !== 'MAINTENANCE_DEPENDENTS') throw new Error('Missing dependent response.')
      expect(first.effects).toHaveLength(4)
      expect(first.continueCursor).not.toBeNull()
      const table =
        ownerKind === 'CHARACTER' ? 'characterActiveRuleEffects' : 'encounterActiveRuleEffects'
      const lastFirst = store.documents(table).find(({ id }) => id === first.effects[3]!.id)
      expect(first.continueCursor).toBe(lastFirst?._id)
      const second = await readRoomMaintenanceCapture(ctx, state, {
        ...request,
        cursor: first.continueCursor
      })
      if (second.kind !== 'MAINTENANCE_DEPENDENTS') throw new Error('Missing dependent response.')
      expect(second.effects).toHaveLength(2)
      expect(second.continueCursor).toBeNull()
      expect(
        await readRoomMaintenanceCapture(ctx, state, { ...request, cursor: first.continueCursor })
      ).toEqual(second)
      expect([...first.effects, ...second.effects].map(({ id }) => id).sort()).toEqual(
        Array.from({ length: 6 }, (_, index) =>
          uuid((ownerKind === 'CHARACTER' ? 0xd40 : 0xd50) + index)
        ).sort()
      )
      const terminal = store.documents(table).find(({ id }) => id === second.effects[1]!.id)
      if (!terminal) throw new Error('Missing terminal native dependent.')
      expect(
        await readRoomMaintenanceCapture(ctx, state, { ...request, cursor: terminal._id })
      ).toEqual({
        kind: 'MAINTENANCE_DEPENDENTS',
        effects: [],
        continueCursor: null
      })
      for (const cursor of [
        'unknown-row',
        `${ownerKind}:effect:6`,
        `${ownerKind === 'CHARACTER' ? 'ENCOUNTER_ACTOR' : 'CHARACTER'}:effect:0`
      ])
        await expect(
          readRoomMaintenanceCapture(ctx, state, { ...request, cursor })
        ).rejects.toThrow('Maintained effect capture cursor is unavailable.')
    }

    // Each real response must satisfy the schema the Convex reader parses it with.
    const parsed = (response: Awaited<ReturnType<typeof readRoomMaintenanceCapture>>) =>
      liveSessionEncounterRulesResponseSchema.parse({
        ...response,
        revisions: [
          ...authority.revisions,
          { scope: 'PLAY', id: uuid(0xd90), revision: uuid(0xd91) }
        ]
      })
    const slot = { actorId: actors[0]!.id, definitionId }
    const found = parsed(
      await readRoomMaintenanceCapture(ctx, state, { kind: 'MAINTENANCE_SLOT', ...slot })
    )
    if (found.kind !== 'MAINTENANCE_SLOT') throw new Error('Missing slot response.')
    expect(found.state?.id).toBe(stateId)
    const absent = parsed(
      await readRoomMaintenanceCapture(ctx, state, {
        kind: 'MAINTENANCE_SLOT',
        actorId: actors[1]!.id,
        definitionId
      })
    )
    expect(absent).toMatchObject({ kind: 'MAINTENANCE_SLOT', state: null })

    const owner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId,
      targetActorId: actors[0]!.id
    }
    expect(
      parsed(
        await readRoomMaintenanceCapture(ctx, state, {
          kind: 'MAINTENANCE_OWNER',
          ...slot,
          stateId,
          owner
        })
      )
    ).toMatchObject({ kind: 'MAINTENANCE_OWNER', owner, character: null })
    const ownerEffects = parsed(
      await readRoomMaintenanceCapture(ctx, state, {
        kind: 'MAINTENANCE_OWNER_EFFECTS',
        ...slot,
        stateId,
        owner,
        afterEffectId: null
      })
    )
    if (ownerEffects.kind !== 'MAINTENANCE_OWNER_EFFECTS') throw new Error('Missing effects.')
    expect(ownerEffects.effects.length).toBeGreaterThan(0)
  })
  expect(read).not.toHaveBeenCalled()
})
