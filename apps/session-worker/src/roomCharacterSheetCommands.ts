import { endCharacterActiveEffect } from '@artificer-toolkit/encounter-persistence/characterActiveEffects'
import { endGrantsOnHitPointsRegained } from '@artificer-toolkit/encounter-persistence/consumedGrantPersistence'
import {
  endChosenConcentration,
  endOutsideCasterConcentration
} from '@artificer-toolkit/encounter-persistence/concentrationChosenEnd'
import { endConcentrationAfterEdit } from '@artificer-toolkit/encounter-persistence/concentrationEditEnd'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { engageStoredIdleTurnActor } from '@artificer-toolkit/encounter-persistence/idleTurnMark'
import { recordRuleRollCard } from '@artificer-toolkit/encounter-persistence/ruleRollCards'
import {
  readCharacterCommandReplay,
  writeCharacterCommandReceipt
} from '@artificer-toolkit/encounter-persistence/characterSheetReceipts'
import {
  liveSessionCommandDtoSchema,
  type LiveSessionCommandDto
} from '@artificer-toolkit/schema/api/liveSessionCommands'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  applyCharacterSheetCommand,
  CharacterSheetCommandError,
  summarizeCharacterSheetCommand
} from '@artificer-toolkit/rules-runtime/character/sheetCommandReducer'
import {
  getProspectiveSheetResourceUsage,
  getSheetCommandResourceUsageUpdate
} from '@artificer-toolkit/rules-runtime/character/sheetResourceUsage'
import { settleCharacterEndedEffects } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import { deathSaveRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import {
  assertCampaignGmSheetCommandAllowed,
  assertGmOnlySheetCommandAllowed
} from '@artificer-toolkit/rules-runtime/character/sheetCommandValidation'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import { projectRoomCharacterSheet } from './roomCharacterSheetProjection.js'
import { endRoomOrphanedSummons } from './roomActionSummonTokens.js'
import {
  actorIdsOutOfPlayByEffect,
  flagRoomReturnsOntoOccupiedSpace
} from './roomEncounterReturnsToPlay.js'
import {
  roomEncounterWriteTransaction,
  type RoomEncounterWriteTransaction
} from './roomEncounterWritePorts.js'
import {
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { checksumCanonicalJson, equalCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createNativeLiveSessionState } from './nativeLiveSessionState.js'
import { encounterCommandRefusal, RoomAdmissionExpiredError } from './nativeRoomEncounterCommand.js'
import { send, type Admission, type SocketAttachment } from './roomSocket.js'
import { readRoomSceneMovedBy } from './roomSceneRead.js'
import { composeRoomSceneVision } from './roomSceneVision.js'
import { EncounterDomainRejection } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { admitsRoomMember } from './roomAuthorization.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** Character play and its Sheet receipt join the caller's atomic room command commit. */
export async function executeRoomCharacterSheetCommand(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  userId: string
  command: Extract<LiveSessionCommandDto, { scope: 'CHARACTER_SHEET' }>
  random(maximum: number): number
  /** The caller's write transaction, when this edit is part of its command; its chat entries join it. */
  ctx?: RoomEncounterWriteTransaction
}) {
  const { store, transaction, inputs, authorization } = input
  const campaignId = postgresUuidSchema.parse(input.campaignId)
  const epoch = postgresUuidSchema.parse(input.epoch)
  const userId = postgresUuidSchema.parse(input.userId)
  const envelope = liveSessionCommandDtoSchema.parse(input.command)
  if (envelope.scope !== 'CHARACTER_SHEET')
    throw new Error('This command is not a live Character Sheet command.')
  const characterId = envelope.characterId.toLowerCase()
  const encounterId = envelope.encounterId.toLowerCase()
  const command = envelope.command
  if (store.epoch !== epoch || inputs.epoch !== epoch)
    throw new Error('Room Character Sheet authority changed.')

  await inputs.encounter(encounterId, transaction)
  const observed = inputs.revisions(campaignId, authorization.revisions)
  const ctx =
    input.ctx ??
    (await roomEncounterWriteTransaction({
      store,
      transaction,
      inputs,
      authorization,
      campaignId,
      epoch,
      userId,
      observed
    }))
  const { campaign, membership, assignment } = await ctx.ports.requireCampaignCharacterAuthority(
    campaignId,
    characterId,
    userId
  )
  const cachedMember = authorization.campaign.members.filter((member) => member.userId === userId)
  const cachedAssignment = authorization.campaign.assignments.filter(
    (assigned) => assigned.characterId === characterId
  )
  const cachedCharacter = authorization.characters.filter(
    (character) => character.characterId === characterId
  )
  if (
    cachedMember.length !== 1 ||
    cachedMember[0].role !== membership.role ||
    cachedAssignment.length !== 1 ||
    cachedAssignment[0].userId !== assignment.userId ||
    cachedCharacter.length !== 1 ||
    cachedCharacter[0].ownerUserId !== assignment.userId ||
    (membership.role === 'OWNER'
      ? campaign.ownerUserId !== userId
      : membership.role !== 'PLAYER' || assignment.userId !== userId)
  )
    throw new Error('Room Character Sheet assignment authority changed.')

  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const state = readRunState(run)
  if (
    state.status !== 'ACTIVE' ||
    state.campaignId !== campaign.id ||
    state.gameSystemId !== campaign.gameSystemId
  )
    throw new Error('Character Sheet requires an active Campaign Encounter.')
  const runActors = await readRunActors(ctx, state)
  const holder = runActors.find(
    (actor) =>
      actor.kind === 'CHARACTER' && actor.sourceId === characterId && actor.frozenState === null
  )
  if (assignment.userId !== userId) assertCampaignGmSheetCommandAllowed(command)
  assertGmOnlySheetCommandAllowed(command, membership.role === 'OWNER')
  if (!holder) {
    // The caster is outside this Run, so Convex owns their play. Only ending a Concentration whose
    // carried grants a Character the Run holds still carries reaches the room (SPELLS-5.11, Q1).
    if (command.type !== 'END_CONCENTRATION')
      throw new Error('Character is not held by this active Encounter.')
    const occurredAt = new Date().toISOString()
    await endOutsideCasterConcentration(ctx, {
      state,
      actors: runActors,
      casterCharacterId: characterId,
      commandId: command.commandId.toLowerCase(),
      userId,
      occurredAt
    })
    return {
      acknowledgement: await writeCharacterCommandReceipt(
        {
          characterId,
          streamVersion: command.expectedVersion,
          userId,
          command,
          occurredAt,
          summary: summarizeCharacterSheetCommand(command),
          contentMaturity: campaign.contentMaturity,
          viewer: membership.role === 'OWNER' ? 'CAMPAIGN_OWNER' : 'CHARACTER_OWNER'
        },
        async () => undefined
      ),
      facts: null,
      replayed: false,
      chatEntries: ctx.postedChatEntries,
      privateRolls: ctx.retainedPrivateRolls
    }
  }

  const scope = {
    campaignId,
    authorityEpoch: epoch,
    characterId,
    expectedUserId: userId,
    expectedRole: membership.role
  }
  const initial = await prepareRoomLiveCharacterSheet(store, inputs, scope, observed, transaction)
  if (
    initial.active.id !== characterId ||
    initial.active.status !== 'ACTIVE' ||
    initial.active.userId !== assignment.userId ||
    initial.active.systemId !== campaign.gameSystemId ||
    initial.character.userId !== assignment.userId
  )
    throw new Error('Stored Campaign Character assignment mismatch.')
  const activeEffects = await listActiveRuleEffects(
    ctx,
    { kind: 'CHARACTER', characterId },
    { ownerVerified: true }
  )
  const sheet = projectRoomCharacterSheet(initial, activeEffects)

  const replay = await readCharacterCommandReplay(
    {
      characterId,
      userId,
      command,
      streamVersion: initial.active.play.streamVersion,
      contentMaturity: initial.campaignContext.contentMaturity,
      viewer: initial.campaignContext.viewer
    },
    () =>
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (query) =>
          query.eq('characterId', characterId).eq('commandId', command.commandId.toLowerCase())
        )
        .unique()
  )
  if (replay)
    return {
      acknowledgement: replay,
      facts: initial,
      replayed: true,
      chatEntries: [],
      privateRolls: []
    }
  if (command.expectedVersion !== initial.active.play.streamVersion)
    throw new CharacterSheetCommandError(
      'Character Sheet changed; refresh before applying this command.'
    )

  const resourceUsageUpdate = getSheetCommandResourceUsageUpdate({
    sheet,
    resourceUsage: initial.sheetState.resourceUsage,
    command
  })
  const occurredAt = new Date(
    Math.max(
      Date.now(),
      Date.parse(initial.active.updatedAt) + 1,
      Date.parse(initial.active.play.updatedAt) + 1
    )
  ).toISOString()
  const deathSaveDie = command.type === 'ROLL_DEATH_SAVE' ? input.random(20) + 1 : undefined
  const updated = characterAuthoredDtoSchema.parse(
    applyCharacterSheetCommand(initial.character, command, sheet, {
      now: () => occurredAt,
      attunementSlotLimit: initial.ruleEvaluation.output.rest.attunementSlotLimit,
      deathSaveDie
    })
  )
  if (command.type === 'END_ACTIVE_EFFECT') {
    await endCharacterActiveEffect(ctx, {
      characterId,
      effectId: command.effectId,
      isCampaignOwner: membership.role === 'OWNER',
      economyEnforced: state.automationMode !== 'MANUAL'
    })
    // The ended effect settles the Character as every effect end does (QUALITY-1.T1).
    const settled = settleCharacterEndedEffects({
      state: updated.state,
      maximumHitPoints: initial.active.play.maximumHitPoints,
      removed: activeEffects.filter((effect) => effect.id === command.effectId),
      remaining: activeEffects.filter((effect) => effect.id !== command.effectId)
    })
    if (settled.changed) {
      updated.state.conditions = settled.conditions
      updated.state.hitpoints = settled.hitpoints
    }
  }
  if (updated.state.hitpoints.current > initial.character.state.hitpoints.current)
    await endGrantsOnHitPointsRegained(ctx, { kind: 'CHARACTER', characterId })
  const nextSheetState = characterSheetStateSchema.parse({
    ...initial.sheetState,
    partyVisibility:
      command.type === 'SET_PARTY_VISIBILITY'
        ? command.visibility
        : initial.sheetState.partyVisibility,
    resourceUsage: getProspectiveSheetResourceUsage({
      resourceUsage: initial.sheetState.resourceUsage,
      resourceUsageUpdate,
      characterId,
      userId,
      now: occurredAt
    })
  })
  const sheetStateChanged =
    canonicalizeRuleDocument(JSON.parse(JSON.stringify(nextSheetState))) !==
    canonicalizeRuleDocument(initial.sheetState)
  const current = await ctx.ports.readCharacterRow(characterId)
  if (!current) throw new Error('Room Character head is missing.')
  await ctx.ports.writeCharacterRecord({
    current,
    fields: { streamVersion: initial.active.play.streamVersion + 1, updatedAt: occurredAt },
    document: updated,
    ...(sheetStateChanged ? { sheetState: nextSheetState } : {})
  })
  // The end shares the Sheet write's stream-version increment.
  if (command.type === 'END_CONCENTRATION')
    await endChosenConcentration(ctx, {
      state,
      actors: runActors,
      holder,
      commandId: command.commandId.toLowerCase(),
      userId,
      occurredAt,
      advancedCharacterIds: new Set([characterId])
    })
  // The edit may leave the Character's Concentration without a holder able to act (D95).
  await endConcentrationAfterEdit(ctx, {
    state,
    actors: runActors,
    holder,
    editCommandId: command.commandId.toLowerCase(),
    userId,
    occurredAt,
    advancedCharacterIds: new Set([characterId])
  })
  // Hit points the player lowers at the Sheet are damage taken: they engage a Rage (SRD).
  if (
    updated.state.hitpoints.current < initial.character.state.hitpoints.current ||
    updated.state.hitpoints.temp < initial.character.state.hitpoints.temp
  )
    await engageStoredIdleTurnActor(ctx, state, holder.id)
  if (deathSaveDie !== undefined) {
    const system = await ctx.ports.requireSystem(campaign.gameSystemId)
    const roll = deathSaveRollRecord({
      occurrenceId: command.commandId,
      rawDie: deathSaveDie,
      characterId,
      rollerLabel: initial.character.label,
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: occurredAt
    })
    await recordRuleRollCard(ctx, {
      campaign,
      encounterId: null,
      roller: null,
      initiatorUserId: userId,
      visibility: undefined,
      clientNonce: roll.id,
      roll
    })
  }
  // An Encounter command that carries this edit flags the return and ends the carriers once, after
  // all its effects.
  if (!input.ctx) {
    await flagRoomReturnsOntoOccupiedSpace({
      ctx,
      transaction,
      encounterId,
      userId,
      occurredAt,
      outOfPlayBefore: actorIdsOutOfPlayByEffect(runActors)
    })
    await endRoomOrphanedSummons({ ctx, transaction, userId, encounterId, occurredAt })
  }
  const facts = await prepareRoomLiveCharacterSheet(store, inputs, scope, observed, transaction)
  const acknowledgement = await writeCharacterCommandReceipt(
    {
      characterId,
      streamVersion: facts.active.play.streamVersion,
      userId,
      command,
      occurredAt,
      summary: summarizeCharacterSheetCommand(command, sheet),
      contentMaturity: facts.campaignContext.contentMaturity,
      viewer: facts.campaignContext.viewer
    },
    async (receipt) => {
      await ctx.db.insert('characterCommandReceipts', receipt)
    }
  )
  return {
    acknowledgement,
    facts,
    replayed: false,
    chatEntries: ctx.postedChatEntries,
    privateRolls: ctx.retainedPrivateRolls
  }
}

/** The room steps a held Character Sheet command uses. */
export type RoomCharacterSheetHost = Pick<
  RoomCommandHost,
  | 'aggregateNeedsReload'
  | 'authorization'
  | 'authorizationBoundary'
  | 'broadcastStateSync'
  | 'cache'
  | 'flushOutbox'
  | 'inputs'
  | 'journal'
  | 'liveAdmission'
  | 'loadRoomAggregate'
  | 'prepareWithRetry'
  | 'presentationChanging'
  | 'rejectCommand'
  | 'scheduleAlarm'
  | 'sendDomainRejection'
  | 'setCache'
  | 'store'
  | 'webSockets'
>

/** Held Sheet play, its private history and the journal receipt commit before acknowledgement. */
export async function executeCharacterSheetCommand(
  host: RoomCharacterSheetHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  command: Extract<LiveSessionCommandDto, { scope: 'CHARACTER_SHEET' }>
): Promise<void> {
  const commandId = command.command.commandId
  const fingerprint = checksumCanonicalJson(command)
  try {
    if (host.aggregateNeedsReload()) await host.flushOutbox('RELOAD')
    await host.loadRoomAggregate(host.cache()?.scene?.id ?? null)
    const current = host.journal.readCurrent()
    if (!current || current.authorityEpoch !== value.authorityEpoch || current.status !== 'ACTIVE')
      throw new Error('Live Session authority changed.')
    const authorization = await host.authorizationBoundary(value)
    if (
      host.liveAdmission(socket)?.generation !== admission.generation ||
      !admitsRoomMember(authorization, admission)
    )
      return
    const assigned = authorization.campaign.assignments.find(
      (entry) => entry.characterId === command.characterId.toLowerCase()
    )
    const character = authorization.characters.find(
      (entry) => entry.characterId === command.characterId.toLowerCase()
    )
    if (
      !assigned ||
      !character ||
      assigned.userId !== character.ownerUserId ||
      (admission.role !== 'OWNER' && assigned.userId !== admission.userId)
    )
      throw new CharacterSheetCommandError('Assigned Character not found.')
    if (character.ownerUserId !== admission.userId)
      assertCampaignGmSheetCommandAllowed(command.command)
    host.store.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    const prior = host.journal.lookupCommand({
      actorId: admission.userId,
      commandId,
      fingerprint
    })
    if (prior.kind === 'MISMATCHED_REUSE') {
      host.rejectCommand(
        socket,
        commandId,
        'INVALID_COMMAND',
        'The command ID was already used for different input.'
      )
      return
    }
    if (prior.kind === 'REPLAY') {
      const receipt = liveSessionWebSocketServerMessageDtoSchema.parse(
        JSON.parse(prior.receipt.receiptJson)
      )
      if (
        receipt.type !== 'COMMAND_COMMITTED' ||
        receipt.delta?.scope !== 'CHARACTER_SHEET' ||
        receipt.delta.result.characterId !== character.characterId
      )
        throw new Error('Stored Character Sheet receipt scope mismatch.')
      const run = await host.store.store
        .query('encounterRuns')
        .withIndex('by_publicId', (query) => query.eq('id', command.encounterId.toLowerCase()))
        .unique()
      if (!run) throw new CharacterSheetCommandError('Encounter is unavailable.')
      const state = readRunState(run)
      if (state.status !== 'ACTIVE' || state.campaignId !== value.campaignId)
        throw new CharacterSheetCommandError('Character is not held by this active Encounter.')
      const held = (await readRunActors({ db: host.store.store }, state)).some(
        (actor) =>
          actor.kind === 'CHARACTER' &&
          actor.sourceId === character.characterId &&
          actor.frozenState === null
      )
      if (!held) {
        // A caster outside the Run holds no play here: the stored acknowledgement is the replay.
        if (command.command.type !== 'END_CONCENTRATION')
          throw new CharacterSheetCommandError('Character is not held by this active Encounter.')
        send(socket, receipt)
        return
      }
      // Member admission above already requires an ACTIVE Campaign: archived Campaigns have no members.
      const [play, campaignPlay] = await Promise.all([
        host.store.store
          .query('characterPlayStates')
          .withIndex('by_characterId', (query) => query.eq('characterId', character.characterId))
          .unique(),
        host.inputs.play(host.inputs.revisions(value.campaignId, authorization.revisions))
      ])
      if (
        !play ||
        campaignPlay.campaign.id !== value.campaignId ||
        state.gameSystemId !== campaignPlay.campaign.gameSystemId ||
        play.userId !== character.ownerUserId
      )
        throw new Error('Current Character Sheet replay scope mismatch.')
      readCharacterPlay(play)
      const result = await readCharacterCommandReplay(
        {
          characterId: character.characterId,
          userId: admission.userId,
          command: command.command,
          streamVersion: play.streamVersion,
          contentMaturity: campaignPlay.campaign.contentMaturity,
          viewer: character.ownerUserId === admission.userId ? 'CHARACTER_OWNER' : 'CAMPAIGN_OWNER'
        },
        () =>
          host.store.store
            .query('characterCommandReceipts')
            .withIndex('by_characterId_commandId', (query) =>
              query
                .eq('characterId', character.characterId)
                .eq('commandId', commandId.toLowerCase())
            )
            .unique()
      )
      if (
        !result ||
        result.historyEntry?.eventType !== command.command.type ||
        result.historyEntry?.eventId !== receipt.delta.result.historyEntry?.eventId
      )
        throw new Error('Stored Character Sheet replay identity mismatch.')
      send(socket, {
        ...receipt,
        sequence:
          result.streamVersion === receipt.delta.result.streamVersion
            ? receipt.sequence
            : current.sequence,
        delta: { scope: 'CHARACTER_SHEET', result }
      })
      return
    }
    const sceneCache = host.cache()
    let receipt: LiveSessionWebSocketServerMessageDto | null = null
    let nextStateJson = current.stateJson
    const { result, authorization: committedAuthorization } = await host.prepareWithRetry(
      authorization,
      (prepared, random) =>
        host.store.transact(
          async (transaction) => {
            const executed = await executeRoomCharacterSheetCommand({
              store: host.store,
              transaction,
              inputs: host.inputs,
              authorization: prepared,
              campaignId: value.campaignId,
              epoch: value.authorityEpoch,
              userId: admission.userId,
              command,
              random
            })
            // Ending Concentration may take a summon's token off the presented Scene.
            const moved = await readRoomSceneMovedBy(transaction, sceneCache?.sceneHeader)
            const uncomposedScene = moved?.scene ?? sceneCache?.uncomposedScene
            const composition = uncomposedScene
              ? await composeRoomSceneVision({
                  store: host.store,
                  transaction,
                  inputs: host.inputs,
                  authorization: prepared,
                  campaignId: value.campaignId,
                  epoch: value.authorityEpoch,
                  scene: uncomposedScene
                })
              : null
            if (composition)
              nextStateJson = createNativeLiveSessionState(composition.scene).stateJson
            receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
              type: 'COMMAND_COMMITTED',
              commandId,
              sequence: current.sequence + 1,
              delta: {
                scope: 'CHARACTER_SHEET',
                result: executed.acknowledgement
              }
            })
            return { ...executed, composition, moved }
          },
          (entry) => {
            const latest = host.authorization.current(value.authorityEpoch)
            if (
              host.liveAdmission(socket)?.generation !== admission.generation ||
              !latest ||
              !admitsRoomMember(latest, admission) ||
              checksumCanonicalJson(latest.revisions) !==
                checksumCanonicalJson(prepared.revisions) ||
              host.cache() !== sceneCache ||
              host.presentationChanging()
            )
              throw new RoomAdmissionExpiredError()
            if (!receipt || entry.sequence !== current.sequence + 1)
              throw new Error('Room Sheet command sequence does not match its authority.')
            const committed = host.journal.commitInTransaction({
              actorId: admission.userId,
              authorityEpoch: value.authorityEpoch,
              commandId,
              fingerprint,
              expectedSequence: current.sequence,
              expectedStateChecksum: current.stateChecksum,
              nextStateChecksum: entry.chainChecksum,
              nextStateJson,
              receiptJson: JSON.stringify(receipt)
            })
            if (committed.kind !== 'COMMITTED')
              throw new Error(
                'Room Sheet command unexpectedly replayed inside its write transaction.'
              )
          }
        )
    )
    host.authorization.applyCharacters(
      value.authorityEpoch,
      committedAuthorization.characters.map((entry) =>
        entry.characterId === character.characterId
          ? {
              ...entry,
              partyVisibility: result.facts?.sheetState.partyVisibility ?? entry.partyVisibility
            }
          : entry
      )
    )
    if (result.composition && sceneCache)
      host.setCache({
        ...sceneCache,
        scene: result.composition.scene,
        characterRevisions: result.composition.characterRevisions,
        ...(result.moved
          ? {
              uncomposedScene: result.moved.scene,
              baseOrdinals: result.moved.baseOrdinals,
              sceneHeader: result.moved.header
            }
          : {})
      })
    if (!receipt) throw new Error('Room Sheet command receipt is unavailable.')
    for (const recipient of host.webSockets()) {
      const member = host.liveAdmission(recipient)
      if (!member || !admitsRoomMember(committedAuthorization, member)) continue
      // Character history is private; every member still advances the same room sequence.
      send(
        recipient,
        member.userId === admission.userId
          ? receipt
          : {
              type: 'COMMAND_COMMITTED',
              commandId,
              delta: null,
              sequence: host.journal.readCurrent()!.sequence
            }
      )
      // A Concentration end or death save card the command caused tells the whole table, as the
      // encounter route does.
      for (const entry of result.chatEntries)
        send(recipient, {
          type: 'COMMAND_COMMITTED',
          commandId,
          sequence: current.sequence + 1,
          delta: { scope: 'CAMPAIGN_CHAT', entry, privateRoll: null }
        })
      // A roll retained for the GM reaches that user's sockets alone.
      for (const { userId, roll } of result.privateRolls)
        if (userId === member.userId)
          send(recipient, {
            type: 'COMMAND_COMMITTED',
            commandId,
            sequence: current.sequence + 1,
            delta: { scope: 'CAMPAIGN_CHAT', entry: null, privateRoll: roll }
          })
    }
    if (
      result.composition &&
      (command.command.type === 'SET_PARTY_VISIBILITY' ||
        !equalCanonicalJson(sceneCache?.scene?.tokens, result.composition.scene.tokens))
    )
      host.broadcastStateSync()
    await host.scheduleAlarm()
  } catch (error) {
    if (error instanceof CharacterSheetCommandError) {
      host.rejectCommand(socket, commandId, 'DOMAIN_REJECTED', error.message)
      return
    }
    if (error instanceof EncounterDomainRejection) {
      host.sendDomainRejection(socket, commandId, error)
      return
    }
    const refusal = encounterCommandRefusal(error)
    host.rejectCommand(socket, commandId, refusal.code, refusal.message)
  }
}
