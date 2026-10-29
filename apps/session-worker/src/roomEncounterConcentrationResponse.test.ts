import { afterEach, expect, it, vi } from 'vitest'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { createEncounterInitiativeStore } from '@artificer-toolkit/encounter-persistence/initiativeStore'
import { persistNativeConcentrationPending } from '@artificer-toolkit/encounter-persistence/actionChildPersistence'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  characterStoredHeadSchema,
  characterStoredRowSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { liveSessionCheckpointRetainedRollSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import {
  createNativeConcentrationContext,
  prepareEncounterConcentrationState
} from '@artificer-toolkit/rules-runtime/encounterConcentration'
import { concentrationOccurrenceId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { nativeConcentrationParentDamage } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  createStagedInitiativeRoundState,
  hydrateStagedState,
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from '@artificer-toolkit/rules-runtime/encounterInitiativeStaging'
import { settleEncounterInitiativeRound } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import { createDnd5eConcentrationCheckDefinition } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationPolicy'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  RoomEncounterStore,
  type RoomDocument,
  type RoomTransaction
} from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'
import { executeRoomEncounterCommand } from './roomEncounterCommands.js'
import { createNativeLiveRulesRuntime } from './nativeRulesRuntime.js'
import { ROOM_PRIVATE_ROLL } from './roomPrivateRolls.js'
import { roomInputsResponse } from '../test/roomInputsFixture.js'
import { roomAuthorizationResponse } from '../test/roomAuthorizationFixture.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'
import { uuid } from './testing/roomAggregateFixture.js'
import { srdCharacterScope, srdRoomCharacter } from './testing/srdRoomCharacter.js'

afterEach(() => vi.restoreAllMocks())

it('atomically resolves a failed native Concentration save, retains the private roll, and replays after eviction', async () => {
  const room = srdRoomCharacter({
    characterId: uuid(0x111a),
    userId: uuid(0x111b),
    campaignId: uuid(0x111c)
  })
  const { part: page, system } = room
  if (!page.inputs) throw new Error('Missing Character fixture.')
  const owner = characterStoredRowSchema.parse(page.inputs.owner)
  const revisions = page.revisions.map((revision) => ({ ...revision, revision: null }))
  const part = { ...page, revisions, inputs: { ...page.inputs, owner } }
  const campaignId = part.inputs.campaign.id
  const epoch = uuid(0x1100)
  const gmId = uuid(0x1101)
  const encounterId = uuid(0x1102)
  const actorId = uuid(0x1103)
  const sideId = uuid(0x1104)
  const parentOccurrenceId = uuid(0x1105)
  const parentCommandId = uuid(0x1106)
  const now = '2026-09-30T12:00:00.000Z'
  const members = [
    { userId: gmId, role: 'OWNER' as const, membershipEpoch: owner.createdAt },
    { userId: owner.userId, role: 'PLAYER' as const, membershipEpoch: owner.createdAt }
  ]
  const assignments = [{ userId: owner.userId, characterId: owner.id }]
  const authorization = liveSessionRoomAuthorizationSchema.parse(
    roomAuthorizationResponse({
      members,
      assignments,
      characterRevisions: [{ characterId: owner.id, revision: null }]
    })
  )
  const campaignFixture = {
    campaignId,
    systemId: owner.systemId,
    ownerUserId: gmId,
    members,
    assignments
  }
  const authority = roomInputsResponse({ kind: 'AUTHORITY', cursor: null }, campaignFixture)
  const play = roomInputsResponse({ kind: 'CAMPAIGN_PLAY' }, campaignFixture)
  if (authority.kind !== 'AUTHORITY' || play.kind !== 'CAMPAIGN_PLAY')
    throw new Error('Missing Campaign fixture.')
  const vocabularyIdentity = {
    snapshotId: uuid(0x1107),
    systemId: system.id,
    snapshotVersion: 1,
    schemaVersion: 1,
    document: system
  }
  const vocabulary = systemVocabularySnapshotSchema.parse({
    ...vocabularyIdentity,
    checksum: checksumCanonicalJson(vocabularyIdentity)
  })
  const published = createDnd5eConcentrationCheckDefinition()
  const maintenanceDocument = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'RULE_MAINTENANCE',
    id: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
    gameSystemId: system.id,
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
    damageCheckDefinitionId: published.id
  })
  const definitions = [maintenanceDocument, published.definition].map((document) =>
    reusableDefinitionCurrentDtoSchema.parse({
      id: document.id,
      gameSystemId: system.id,
      contentSourceId: uuid(0x1108),
      definitionFamilyKey: 'kind' in document ? 'rule-maintenance' : document.definitionFamilyKey,
      label: 'kind' in document ? 'Concentration maintenance' : 'Concentration save',
      description: null,
      document,
      checksum: checksumRuleDocument(document),
      contractVersion: 1,
      version: 1,
      publishedAt: now,
      publishedBy: gmId
    })
  )
  const actor = encounterRunActorStateSchema.parse({
    id: actorId,
    encounterId,
    sideId,
    kind: 'CHARACTER',
    label: owner.label,
    sourceId: owner.id,
    stableTieKey: actorId,
    public: false,
    controllerUserIds: [],
    disposition: 'FRIENDLY',
    initiative: 0,
    manualOrder: 0,
    healthDisplay: null,
    systemId: system.id,
    resources: {},
    gmNotes: 'Private concentrating actor',
    snapshot: {},
    frozenState: null,
    absence: null,
    form: null,
    createdAt: now,
    updatedAt: now
  })
  if (actor.kind !== 'CHARACTER') throw new Error('Missing concentrating Character actor.')
  const { frozenState: _frozenState, absence: _absence, ...actorBase } = actor
  const recipientActor = encounterRunActorStateSchema.parse({
    ...actorBase,
    id: uuid(0x1117),
    stableTieKey: uuid(0x1117),
    kind: 'CUSTOM',
    label: 'Maintained target',
    sourceId: null,
    sourceRevision: null,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: [],
    defeated: false,
    form: null,
    absence: null
  })
  const optionalCombatSnapshot = { schemaVersion: 1, gameSystemId: system.id, definitions: [] }
  const state = encounterRunStateSchema.parse({
    id: encounterId,
    campaignId,
    gameSystemId: system.id,
    blueprintId: uuid(0x1109),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Native Concentration response',
    status: 'ACTIVE',
    automationMode: 'ASSISTED',
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: 1,
    currentActorId: actor.id,
    actorIds: [actor.id, recipientActor.id],
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 1,
    sides: [{ id: sideId, label: 'Concentrating Character', sortOrder: 0 }],
    createdAt: now,
    updatedAt: now
  })
  const scope = srdCharacterScope({ part }, epoch)
  const objects = await room.loadContent()
  const prepareSheet = () =>
    part.inputs && prepareLiveCharacterSheetFacts({ scope, inputs: part.inputs, system, objects })
  const memory = createMemoryEncounterStore({ idPrefix: 'native-concentration-fixture' })
  const ctx = { db: memory.store }
  const {
    _id,
    _creationTime,
    documentJson: _documentJson,
    sheetState: _sheetState,
    checksum: _checksum,
    sheetStateChecksum: _sheetStateChecksum,
    play: _play,
    ...head
  } = owner
  const { _id: playId, _creationTime: playCreationTime, ...playFields } = owner.play
  await ctx.db.insert('characters', characterStoredHeadSchema.parse(head))
  await ctx.db.insert('characterPlayStates', playFields)
  await ctx.db.insert('encounterRuns', {
    id: state.id,
    campaignId,
    gameSystemId: system.id,
    status: state.status,
    version: state.version,
    stateJson: JSON.stringify(state),
    stateChecksum: checksumCanonicalJson(state),
    createCommandId: crypto.randomUUID(),
    createCommandFingerprint: checksumCanonicalJson(state),
    concentrationCasterCharacterIds: [],
    createdAt: now,
    updatedAt: now
  })
  await insertRunActor(ctx, actor)
  await insertRunActor(ctx, recipientActor)
  const staged = inMemoryInitiativeRepository(
    hydrateStagedState(
      createStagedInitiativeRoundState({
        encounter: {
          ...state,
          actors: [actor, recipientActor].map(({ id, sideId }) => ({ id, sideId }))
        },
        round: state.round
      })
    )
  )
  const settled = await settleEncounterInitiativeRound({
    repository: staged.repository,
    state: staged.read(),
    orderedActorIds: state.actorIds
  })
  await createEncounterInitiativeStore(ctx).persistStagedInitiativeRound(
    serializeStagedInitiativeRoundState(settled)
  )
  const effects = createActiveRuleEffectStore(ctx)
  const slot = await effects.createMaintainedState({
    id: uuid(0x110b),
    encounterId,
    ownerActorId: actor.id,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: maintenanceDocument.id,
      definitionChecksum: checksumRuleDocument(maintenanceDocument),
      provenance: {
        kind: 'ACTION',
        sourceActionId: uuid(0x110c),
        sourceOccurrenceId: uuid(0x110d)
      },
      sourceActorId: actor.id,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    }
  })
  const authoredEffectId = uuid(0x110e)
  const compiledEntryId = uuid(0x110f)
  const dependent = await effects.create({
    id: uuid(0x1110),
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: recipientActor.id },
    maintainedEffectStateId: slot.id,
    lifecycle: { schemaVersion: 1, remainingTicks: 3 },
    definition: activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 2,
      linkedEffectId: null,
      originLevel: null,
      stateContributions: [],
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: encounterId,
        sourceOccurrenceId: uuid(0x1111),
        rootCommandId: uuid(0x1112),
        sourceActorId: actor.id
      },
      authoredEffectId,
      compiledEntryId,
      frozenGraphNodeId: 'entry',
      frozenGraph: {
        schemaVersion: 1,
        source: {
          definitionId: authoredEffectId,
          gameSystemId: system.id,
          definitionFamilyKey: 'effect',
          checksum: 'a'.repeat(64)
        },
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [{ id: 'entry', operation: { key: 'comparison', contractVersion: 1 }, inputs: {} }],
        sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'entry' }],
        outputs: { result: { kind: 'LITERAL', value: true } }
      },
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: 'NONE',
        anchor: 'HOLDER',
        endTriggers: [],
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
  })
  // The finalized parent damage uses the same stored Cleaving receipt framing as shared tests.
  const parent = storedRuleExecutionResultDtoSchema.parse({
    status: 'AGGREGATE_CHOICE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: parentOccurrenceId,
    occurrenceVersion: 1,
    applicationOutputs: {
      kind: 'CLEAVING_DAMAGE',
      schemaVersion: 1,
      occurrenceId: parentOccurrenceId,
      parentOccurrenceId: uuid(0x1113),
      sourceActorId: actor.id,
      targetActorId: actor.id,
      selectedOptionId: 'a'.repeat(64),
      sealedContextChecksum: 'b'.repeat(64),
      outcome: 'APPLIED',
      damage: {
        sourceNodeId: 'cleave_damage',
        sourceOperationKey: 'effect.damage',
        damageTypeId: uuid(0x1114),
        requestedAmount: 1,
        resolvedAmount: 1,
        appliedAmount: 1
      },
      targetTransition: {
        checksum: 'c'.repeat(64),
        before: {
          currentHitPoints: 11,
          temporaryHitPoints: 1,
          maximumHitPoints: 11,
          conditionIds: [],
          deathSaves: null
        },
        after: {
          currentHitPoints: 11,
          temporaryHitPoints: 0,
          maximumHitPoints: 11,
          conditionIds: [],
          deathSaves: null
        }
      }
    }
  })
  const parentFingerprint = checksumCanonicalJson({ commandId: parentCommandId })
  await ctx.db.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: parentOccurrenceId,
      campaignId,
      encounterId,
      rootCommandId: parentCommandId,
      state: 'COMPLETED',
      version: 1,
      expectedEncounterVersion: state.version,
      pendingSnapshotChecksum: null,
      completedAt: now,
      createdAt: now,
      updatedAt: now
    })
  )
  await ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: uuid(0x1115),
      campaignId,
      encounterId,
      occurrenceId: parentOccurrenceId,
      commandId: parentCommandId,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      commandFingerprint: parentFingerprint,
      encounterVersion: state.version,
      actorUserId: gmId,
      correlationId: null,
      createdAt: now,
      resultJson: JSON.stringify(parent),
      resultChecksum: checksumRuleDocument(parent),
      commandMetadataJson: JSON.stringify(
        serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
          schemaVersion: 1,
          transition: 'OPTIONAL_COMBAT_CLEAVING',
          commandType: 'RESOLVE_RULE_OCCURRENCE',
          expectedAggregateVersion: 0,
          expectedOccurrenceVersion: 0,
          response: { kind: 'OPTION', optionId: 'a'.repeat(64) },
          optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
        })
      )
    })
  )
  const runtime = createNativeLiveRulesRuntime()
  const applications = nativeConcentrationParentDamage(parent)
  const application = applications[0]
  if (!application) throw new Error('Missing parent damage application.')
  const target = buildMovementTarget({
    actor,
    gameSystemId: system.id,
    campaignId,
    activeEffects: [],
    characterFacts: await prepareSheet(),
    includeReactionSources: true
  })
  const current = await prepareEncounterConcentrationState({
    state,
    targetActorId: actor.id,
    maintained: slot,
    loadTarget: () => target,
    readVocabulary: async () => vocabulary,
    readDefinition: async (id) => definitions.find((definition) => definition.id === id) ?? null
  })
  if (!current) throw new Error('Missing maintained Character concentration.')
  const pending = createNativeConcentrationContext({
    gameSystemId: state.gameSystemId,
    current,
    parentOccurrenceId,
    parentCommandFingerprint: parentFingerprint,
    application,
    remaining: [],
    finalizedDamageEnvelopeChecksum: checksumRuleDocument(applications),
    sourceLabels: []
  })
  const occurrenceId = concentrationOccurrenceId(parentOccurrenceId, application)
  const started = await runtime.executeResolved({
    command: { definitionId: published.id, occurrenceId, facts: pending.facts },
    published
  })
  if (started.status !== 'PAUSED') throw new Error('Expected Concentration d20 evidence.')
  await persistNativeConcentrationPending(ctx, {
    state,
    context: pending.context,
    continuation: started.continuation,
    occurredAt: now
  })
  const documents: RoomDocument[] = [
    ...authority.documents,
    { table: 'characters', id: _id, creationTime: _creationTime, fields: head },
    { table: 'characterPlayStates', id: playId, creationTime: playCreationTime, fields: playFields }
  ]
  for (const table of [
    'encounterRuns',
    'encounterRunActors',
    'encounterActorSnapshots',
    'encounterSourceProjectionFacts',
    'encounterMaintainedEffectStates',
    'encounterActiveRuleEffects',
    'encounterInitiativeRounds',
    'encounterInitiativeParticipants',
    'encounterInitiativeSides',
    'encounterRuleOccurrences',
    'encounterRuleReceipts',
    'encounterPendingSnapshotParts'
  ] as const) {
    for (const { _id, _creationTime, ...fields } of memory.documents(table))
      documents.push({ table, id: _id, creationTime: _creationTime, fields })
  }
  const sharedRevisions = revisions.filter((revision) => revision.scope !== 'CHARACTER')
  const definitionRevisions = sharedRevisions.filter(
    (revision) => revision.scope === 'SYSTEM' || revision.scope === 'CAMPAIGN'
  )
  const systemInput = { kind: 'SYSTEM', revisions: sharedRevisions, system, vocabulary }
  const { storage, database } = createNodeSqliteRoomStorage()
  let store = new RoomEncounterStore(storage)
  store.hydrate({
    epoch,
    documents,
    records: [
      {
        kind: 'ROOM_INPUT',
        key: 'AUTHORITY',
        revision: JSON.stringify(authority.revisions),
        json: JSON.stringify({ ...authority, documents: [] })
      },
      {
        kind: 'ROOM_INPUT',
        key: 'CAMPAIGN_PLAY',
        revision: JSON.stringify(play.revisions),
        json: JSON.stringify(play)
      },
      {
        kind: 'ROOM_INPUT',
        key: `CHARACTER:${owner.id}`,
        revision: JSON.stringify(revisions),
        json: JSON.stringify(part)
      },
      {
        kind: 'ROOM_INPUT',
        key: `RUN:${state.id}`,
        revision: null,
        json: JSON.stringify({
          kind: 'RUN',
          encounterVersion: state.version,
          activeEncounterId: null,
          maintenanceCharacterOwners: [],
          documents: [],
          continueCursor: null
        })
      },
      ...['SYSTEM:SYSTEM', 'SYSTEM:VOCABULARY'].map((key) => ({
        kind: 'ROOM_INPUT',
        key,
        revision: JSON.stringify(sharedRevisions),
        json: JSON.stringify(systemInput)
      })),
      ...definitions.map((definition) => ({
        kind: 'ROOM_DEFINITION',
        key: definition.id,
        revision: JSON.stringify(definitionRevisions),
        json: JSON.stringify({ id: definition.id, sourceKind: 'PLATFORM', definition })
      })),
      {
        kind: 'ROOM_INPUT',
        key: 'DEFINITIONS',
        revision: JSON.stringify(definitionRevisions),
        json: JSON.stringify({
          kind: 'DEFINITIONS',
          revisions: definitionRevisions,
          definitions: [],
          continueCursor: null
        })
      }
    ]
  })
  const read = vi.fn(async () => {
    throw new Error('Hydrated concentration must not read backend inputs.')
  })
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('Hydrated concentration must not fetch.'))
  let inputs = new RoomInputs(store, read, room.loadContent)
  const command: ResolveRuleOccurrenceInputDto = {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId,
    commandId: uuid(0x1116),
    expectedVersion: state.version,
    occurrenceId,
    expectedOccurrenceVersion: 0,
    correlationId: null,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: started.continuation.request.requestId,
      rawFaces: [1],
      rollMode: 'NORMAL'
    }
  }
  function resolve(transaction: RoomTransaction) {
    return executeRoomEncounterCommand({
      store,
      transaction,
      inputs,
      authorization,
      campaignId,
      epoch,
      userId: owner.userId,
      recipientUserIds: [gmId, owner.userId],
      command,
      random: () => {
        throw new Error('Entered dice must not reroll.')
      },
      sceneTokens: async () => null,
      turnExecution: { runtime }
    })
  }
  function evidence(value = store) {
    return {
      sequence: value.sequence,
      checksum: value.checksum,
      runs: value.documents('encounterRuns'),
      actors: value.documents('encounterRunActors'),
      heads: value.documents('characters'),
      play: value.documents('characterPlayStates'),
      maintained: value.documents('encounterMaintainedEffectStates'),
      effects: value.documents('encounterActiveRuleEffects'),
      occurrences: value.documents('encounterRuleOccurrences'),
      receipts: value.documents('encounterRuleReceipts'),
      commands: value.documents('encounterRunCommands'),
      pending: value.documents('encounterPendingSnapshotParts'),
      privateRolls: value.records(ROOM_PRIVATE_ROLL),
      records: value.records('ROOM_INPUT'),
      writes: storage.sql
        .exec('SELECT sequence, json, checksum, chain FROM room_writeset_log ORDER BY sequence')
        .toArray()
    }
  }
  try {
    const before = evidence()
    await expect(
      store.transact(resolve, (entry) => {
        expect(entry.sequence).toBe(1)
        expect(storage.sql.exec('SELECT sequence FROM room_writeset_log').toArray()).toEqual([
          { sequence: 1 }
        ])
        throw new Error('Injected Concentration durable commit failure')
      })
    ).rejects.toThrow('Injected Concentration durable commit failure')
    expect(evidence()).toEqual(before)
    expect(evidence(new RoomEncounterStore(storage))).toEqual(before)
    const pendingRow = store
      .documents('encounterRuleOccurrences')
      .find((row) => row.id === occurrenceId)
    if (!pendingRow) throw new Error('Missing retained pending Concentration occurrence.')
    expect(pendingRow.state).toBe('PENDING')
    expect(await readPendingSnapshot({ db: store.store }, pendingRow)).toMatchObject({
      applicationContext: pending.context
    })
    const committed = await store.transact(resolve)
    const gmResult = committed.recipients.get(gmId)
    const playerResult = committed.recipients.get(owner.userId)
    if (!gmResult || !playerResult) throw new Error('Missing Concentration recipients.')
    expect(gmResult.occurrence).toMatchObject({
      occurrenceId,
      status: 'COMPLETE',
      pending: null
    })
    expect(gmResult.projection.actors).toHaveLength(2)
    expect(playerResult.projection.actors).toEqual([])
    expect(playerResult.occurrence).toEqual(gmResult.occurrence)
    expect(store.documents('encounterMaintainedEffectStates')).toEqual([])
    expect(store.documents('encounterActiveRuleEffects')).toEqual([])
    const latestPlay = store.documents('characterPlayStates')[0]
    expect(latestPlay?.streamVersion).toBe(owner.play.streamVersion)
    expect(latestPlay?.state).toEqual(owner.play.state)
    expect(store.documents('characters')).toEqual(before.heads)
    expect(readRunState(store.documents('encounterRuns')[0]!)).toMatchObject({
      version: state.version + 1,
      turnSequence: state.turnSequence
    })
    expect(store.documents('encounterPendingSnapshotParts')).toEqual([])
    const receipt = store
      .documents('encounterRuleReceipts')
      .find((row) => row.commandId === command.commandId)
    if (!receipt) throw new Error('Missing native Concentration receipt.')
    const execution = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    expect(execution).toMatchObject({
      status: 'COMPLETE',
      applicationOutputs: {
        kind: 'DAMAGE_SAVE_CHECK',
        source: 'CONCENTRATION',
        outcome: 'SAVE_FAILURE',
        cleanup: {
          maintainedStateId: slot.id,
          removedDependentEffectIds: [dependent.id],
          removedZoneIds: [],
          characterOwnerTransitions: []
        }
      }
    })
    expect(receipt.resultChecksum).toBe(checksumRuleDocument(execution))
    expect(store.documents('encounterRunCommands')).toHaveLength(1)
    const rolls = store
      .records(ROOM_PRIVATE_ROLL)
      .map((row) => liveSessionCheckpointRetainedRollSchema.parse(JSON.parse(row.json)))
    const roll = rolls.find((retained) => retained.userId === gmId)
    expect(roll).toMatchObject({
      userId: gmId,
      gmCampaignRoll: {
        campaignId,
        creature: { encounterId: expect.any(String), actorId: actor.id },
        revealedAt: null,
        noticedAt: null
      },
      record: {
        characterLabel: actor.label,
        ruleCheck: { kind: 'CONCENTRATION', actorId: actor.id, outcome: 'LOST' }
      }
    })
    // The hidden Character's own player keeps the generic copy, with no reveal to offer (ATTACK-17.6).
    expect(rolls.filter((retained) => retained.userId !== gmId)).toEqual([
      expect.objectContaining({ userId: owner.userId, gmCampaignRoll: null, record: roll!.record })
    ])
    expect(rolls).toHaveLength(2)
    expect(store.documents('campaignConversationEntries')).toEqual([])
    const after = evidence()
    expect(after.sequence).toBe(1)
    store = new RoomEncounterStore(storage)
    inputs = new RoomInputs(store, read, room.loadContent)
    expect(store.corruption).toBeNull()
    expect(evidence()).toEqual(after)
    const retry = await store.transact(resolve)
    expect(retry.recipients.get(gmId)).toEqual(gmResult)
    expect(retry.recipients.get(owner.userId)).toEqual(playerResult)
    expect(evidence()).toEqual(after)
    // Removing a Character actor releases a Convex-owned hold, so its acknowledgement waits for a
    // checkpoint; removing any other actor rides the next flush.
    const remove = (actorId: string, commandId: string, expectedVersion: number) =>
      store.transact((transaction) =>
        executeRoomEncounterCommand({
          store,
          transaction,
          inputs,
          authorization,
          campaignId,
          epoch,
          userId: gmId,
          recipientUserIds: [gmId],
          command: { type: 'REMOVE_ACTOR', encounterId, commandId, expectedVersion, actorId },
          random: () => {
            throw new Error('Removing an actor must not roll.')
          },
          sceneTokens: async () => null,
          turnExecution: { runtime }
        })
      )
    expect(
      (await remove(recipientActor.id, uuid(0x1118), state.version + 1))
        .checkpointBeforeAcknowledgement
    ).toBe(false)
    expect(
      (await remove(actor.id, uuid(0x1119), state.version + 2)).checkpointBeforeAcknowledgement
    ).toBe(true)
    expect(read).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  } finally {
    database.close()
  }
})
