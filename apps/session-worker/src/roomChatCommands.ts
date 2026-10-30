import { buildConversationEntryRecords } from '@artificer-toolkit/encounter-persistence/conversationEntryRecords'
import {
  openConversation,
  insertConversationEntry,
  readConversationEntryReplay
} from '@artificer-toolkit/encounter-persistence/conversationPersistence'
import { presentChatEntries } from '@artificer-toolkit/encounter-persistence/conversationPresentation'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  readRollNoticeCreatureLabel,
  readRollRevealRefusal,
  rollNoticeNonce,
  withRollRevealed
} from '@artificer-toolkit/encounter-persistence/rollReveals'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { ExecuteCampaignRollInput } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { RollHistoryEntryDto } from '@artificer-toolkit/schema/api/rolls'
import {
  campaignChatLiveCommandSchema,
  type CampaignChatLiveCommand
} from '@artificer-toolkit/schema/api/campaignChatLiveCommands'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { createRollRecord } from '@artificer-toolkit/rules-runtime/character/rollRecord'
import { presentRetainedRoll } from '@artificer-toolkit/rules-runtime/character/rollPresentation'
import { resolveCharacterSheetRoll } from '@artificer-toolkit/rules-runtime/character/sheetRoll'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import {
  projectRoomCharacterSheet,
  projectRoomCharacterSheetForViewer
} from './roomCharacterSheetProjection.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import {
  readRoomPrivateRoll,
  retainRoomPrivateRoll,
  reviseRoomPrivateRollBinding
} from './roomPrivateRolls.js'
import {
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { type LiveSessionCommandDto } from '@artificer-toolkit/schema/api/liveSessionCommands'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterCommandRefusal, RoomAdmissionExpiredError } from './nativeRoomEncounterCommand.js'
import {
  accountBucket,
  replayReceipt,
  send,
  type Admission,
  type SocketAttachment
} from './roomSocket.js'
import { RoomRateLimitedError } from './roomRateLimits.js'
import { admitsRoomMember } from './roomAuthorization.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** A refusal the sender should read, as opposed to an unavailable room. */
export class CampaignChatCommandError extends Error {}

/**
 * One chat message or Campaign roll as a room command (D69). The entry's header and payload are
 * written together through the shared conversation writer, so the room's next checkpoint carries
 * both; the caller commits the receipt, rate charge and sequence in the same transaction. A GM's
 * private roll posts no entry: it is retained in the room (`privateRoll`, for the GM alone) until a
 * reveal posts its card or only a notice to the TABLE (Q14, D83). A message or roll whose nonce
 * already posted an entry, before this epoch's journal, replays that entry (`replayed`, free).
 */
export async function executeRoomCampaignChatCommand(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  userId: string
  command: CampaignChatLiveCommand
  random: (maximum: number) => number
}): Promise<{
  entry: CampaignChatEntryDto | null
  privateRoll: RollHistoryEntryDto | null
  recipientUserIds: string[]
  replayed: boolean
}> {
  const { store, transaction, inputs, authorization } = input
  const campaignId = postgresUuidSchema.parse(input.campaignId)
  const userId = postgresUuidSchema.parse(input.userId)
  const command = campaignChatLiveCommandSchema.parse(input.command)
  if (command.input.campaignId.toLowerCase() !== campaignId)
    throw new CampaignChatCommandError('Campaign not found.')
  const observed = inputs.revisions(campaignId, authorization.revisions)
  const ctx = await roomEncounterWriteTransaction({
    store,
    transaction,
    inputs,
    authorization,
    campaignId,
    epoch: input.epoch,
    userId,
    observed
  })
  const authority = await ctx.ports.requireCampaignAuthority(campaignId, userId)
  const { campaign, membership } = authority
  const username = authorization.preferences.find((entry) => entry.userId === userId)?.username
  if (!username)
    throw new CampaignChatCommandError('A username is required to post in this Campaign.')
  const requirePeer = ctx.ports.requireCampaignAuthority
  const assignedCharacterId = async (characterId: string) => {
    await ctx.ports.requireCampaignCharacterAuthority(campaignId, characterId, userId)
    const owner = (await inputs.character(characterId, observed, transaction)).inputs?.owner
    if (!owner || owner.status !== 'ACTIVE')
      throw new CampaignChatCommandError('Character requires Builder repair before rolling.')
    return owner
  }
  const members = authorization.campaign.members
  // Entries cannot precede a current member's freshly advanced access cutoff.
  const createdAt = new Date(
    Math.max(Date.now(), ...members.map((member) => Date.parse(member.membershipEpoch)))
  ).toISOString()
  const tableRecipients = (kind: 'TABLE' | 'PARTY') =>
    members
      .filter((member) => kind === 'TABLE' || member.role === 'PLAYER')
      .map((member) => member.userId)

  const rollRecord = async (roll: ExecuteCampaignRollInput['roll']) => {
    if (roll.characterId === null && (membership.role !== 'OWNER' || roll.source.kind !== 'MANUAL'))
      throw new CampaignChatCommandError(
        'Only the Campaign owner may roll without an assigned Character.'
      )
    const character = roll.characterId
      ? await assignedCharacterId(roll.characterId.toLowerCase())
      : null
    if (!roll.characterId && authorization.campaign.assignments.length === 0)
      throw new CampaignChatCommandError(
        'Assign at least one Character before making a Campaign roll.'
      )
    const system = await ctx.ports.requireSystem(campaign.gameSystemId)
    let resolved: ReturnType<typeof resolveCharacterSheetRoll> = {
      expression: roll.expression,
      rollMode: roll.rollMode,
      source: roll.source
    }
    if (character && roll.source.kind !== 'MANUAL') {
      const facts = await prepareRoomLiveCharacterSheet(
        store,
        inputs,
        {
          campaignId,
          authorityEpoch: input.epoch,
          characterId: character.id,
          expectedUserId: userId,
          expectedRole: membership.role
        },
        observed,
        transaction
      )
      const activeEffects = await listActiveRuleEffects(
        ctx,
        { kind: 'CHARACTER', characterId: character.id },
        { ownerVerified: true }
      )
      resolved = resolveCharacterSheetRoll(
        { ...roll, characterId: character.id },
        projectRoomCharacterSheet(facts, activeEffects),
        projectRoomCharacterSheetForViewer(facts, activeEffects)
      )
    } else if (character) {
      resolved = { ...resolved, source: { kind: 'MANUAL', label: 'Manual roll' } }
    }
    return createRollRecord({
      characterId: character?.id ?? null,
      label: character?.label ?? username,
      system,
      resolved,
      // The dice the Sheet row carries (Bless, Divine Favor) join its roll, as on Convex.
      addedDice: resolved.addedDice,
      nextInt: input.random
    })
  }

  const postEntry = async (
    access: Awaited<ReturnType<typeof openConversation>>,
    clientNonce: string,
    content: Parameters<typeof buildConversationEntryRecords>[0]['content']
  ) => {
    const { identity, payload } = buildConversationEntryRecords({
      campaignId,
      conversationId: access.conversation.id,
      authorUserId: userId,
      clientNonce,
      createdAt,
      username,
      content
    })
    const stored = await insertConversationEntry(ctx, identity, payload)
    const [entry] = presentChatEntries(
      [{ header: stored, payload }],
      access.conversation,
      campaign.contentMaturity,
      [username]
    )
    return entry!
  }

  if (command.type === 'EXECUTE_PRIVATE_ROLL' || command.type === 'REVEAL_ROLL') {
    if (membership.role !== 'OWNER')
      throw new CampaignChatCommandError('Only the Campaign owner may roll privately or reveal.')
    if (command.type === 'EXECUTE_PRIVATE_ROLL') {
      const rollId = command.input.clientNonce.toLowerCase()
      // A nonce sent before this epoch has no journal receipt to replay.
      if (readRoomPrivateRoll(transaction, userId, rollId))
        throw new CampaignChatCommandError('This roll was already made.')
      const record = { ...(await rollRecord(command.input.roll)), id: rollId }
      const gmCampaignRoll = { campaignId, creature: null, revealedAt: null, noticedAt: null }
      retainRoomPrivateRoll(store, transaction, { userId, record, gmCampaignRoll })
      return {
        entry: null,
        privateRoll: presentRetainedRoll({ ...record, gmCampaignRoll }, campaign.contentMaturity),
        recipientUserIds: [userId],
        replayed: false
      }
    }
    const { rollId, mode } = command.input
    const retained = readRoomPrivateRoll(transaction, userId, rollId.toLowerCase())
    // Rolls made before the live table started are Convex-only: the room holds no bounded scope
    // to hydrate them from, so reveal waits until the session ends.
    if (!retained)
      throw new CampaignChatCommandError(
        'This roll was made before the live table started; reveal it after the session.'
      )
    // The owner's retained rolls always carry this Campaign's binding; only a member's own copy has none.
    const gmCampaignRoll = retained.gmCampaignRoll
    if (gmCampaignRoll?.campaignId !== campaignId)
      throw new CampaignChatCommandError('This roll is not a private GM roll of this Campaign.')
    const refusal = readRollRevealRefusal(gmCampaignRoll, mode)
    if (refusal) throw new CampaignChatCommandError(refusal)
    const access = await openConversation(ctx, authority, 'TABLE', requirePeer)
    const entry = await postEntry(
      access,
      mode === 'FULL' ? retained.record.id : rollNoticeNonce(retained.record.id),
      mode === 'FULL'
        ? { kind: 'ROLL', roll: retained.record, revealedByGm: true }
        : {
            kind: 'ROLL_NOTICE',
            creatureLabel: await readRollNoticeCreatureLabel(ctx, gmCampaignRoll.creature)
          }
    )
    reviseRoomPrivateRollBinding(transaction, {
      ...retained,
      gmCampaignRoll: withRollRevealed(gmCampaignRoll, mode, entry.createdAt)
    })
    return {
      entry,
      privateRoll: null,
      recipientUserIds: tableRecipients('TABLE'),
      replayed: false
    }
  }

  if (
    command.type === 'EXECUTE_ROLL' &&
    command.input.destination === 'GM' &&
    membership.role === 'OWNER'
  )
    throw new CampaignChatCommandError('The GM rolls privately instead of to the GM.')
  const access =
    command.type === 'SEND_CHAT'
      ? await openConversation(
          ctx,
          authority,
          command.input.room,
          requirePeer,
          command.input.directUserId
        )
      : command.input.destination === 'TABLE'
        ? await openConversation(ctx, authority, 'TABLE', requirePeer)
        : await openConversation(ctx, authority, 'DIRECT', requirePeer, campaign.ownerUserId)
  const recipientUserIds =
    access.conversation.kind === 'DIRECT'
      ? access.conversation.participantUserIds
      : tableRecipients(access.conversation.kind)
  const clientNonce = command.commandId.toLowerCase()
  // A nonce sent before this epoch has no journal receipt; its entry replays as Convex replays it.
  const prior = await readConversationEntryReplay(
    ctx,
    access,
    userId,
    clientNonce,
    command.type === 'SEND_CHAT' ? 'CHAT' : 'ROLL'
  )
  if (prior) {
    const [entry] = presentChatEntries([prior], access.conversation, campaign.contentMaturity, [
      username
    ])
    return { entry: entry!, privateRoll: null, recipientUserIds, replayed: true }
  }

  const content = await (async () => {
    if (command.type === 'SEND_CHAT') {
      const chat = command.input
      const character =
        chat.mode === 'ROLEPLAY'
          ? await assignedCharacterId(chat.assignedCharacterId!.toLowerCase())
          : null
      // Members speak only as their own Character; the GM's authority over others' does not extend here.
      if (character && character.userId !== userId)
        throw new CampaignChatCommandError('Assigned Character is unavailable.')
      return {
        kind: 'CHAT' as const,
        mode: chat.mode,
        body: chat.body,
        character: character && { id: character.id, label: character.label }
      }
    }
    return {
      kind: 'ROLL' as const,
      revealedByGm: false,
      roll: await rollRecord(command.input.roll)
    }
  })()

  const entry = await postEntry(access, clientNonce, content)
  return { entry, privateRoll: null, recipientUserIds, replayed: false }
}

/** The room steps a Campaign chat command uses. */
export type RoomCampaignChatHost = Pick<
  RoomCommandHost,
  | 'aggregateNeedsReload'
  | 'authorization'
  | 'authorizationBoundary'
  | 'buckets'
  | 'cache'
  | 'flushOutbox'
  | 'inputs'
  | 'journal'
  | 'liveAdmission'
  | 'loadRoomAggregate'
  | 'random'
  | 'rejectCommand'
  | 'scheduleAlarm'
  | 'store'
  | 'webSockets'
>

/**
 * General chat and Campaign rolls (D69): the entry fans out to its conversation immediately and
 * reaches Convex with the room's next checkpoint. The D72 charge, the journal receipt and the
 * records commit together, so an exact retry replays the original entry for free.
 */
export async function executeCampaignChatCommand(
  host: RoomCampaignChatHost,
  socket: WebSocket,
  admission: Admission,
  value: SocketAttachment,
  command: Extract<LiveSessionCommandDto, { scope: 'CAMPAIGN_CHAT' }>
): Promise<void> {
  const commandId = command.command.commandId
  const fingerprint = checksumCanonicalJson(command)
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
    send(socket, replayReceipt(prior.receipt.receiptJson))
    return
  }
  try {
    const bucket = accountBucket('TABLE', value, admission)
    if (!host.buckets.admits(bucket)) throw new RoomRateLimitedError()
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
    host.store.assertAuthorityHead({
      epoch: current.authorityEpoch,
      sequence: current.sequence,
      checksum: current.stateChecksum
    })
    let receipt: LiveSessionWebSocketServerMessageDto | null = null
    let replayed = false
    const executed = await host.store.transact(
      async (transaction) => {
        const posted = await executeRoomCampaignChatCommand({
          store: host.store,
          transaction,
          inputs: host.inputs,
          authorization,
          campaignId: value.campaignId,
          epoch: value.authorityEpoch,
          userId: admission.userId,
          command: command.command,
          random: host.random
        })
        replayed = posted.replayed
        receipt = liveSessionWebSocketServerMessageDtoSchema.parse({
          type: 'COMMAND_COMMITTED',
          commandId,
          sequence: current.sequence + 1,
          delta: {
            scope: 'CAMPAIGN_CHAT',
            entry: posted.entry,
            privateRoll: posted.privateRoll
          }
        })
        return posted
      },
      (entry) => {
        const latest = host.authorization.current(value.authorityEpoch)
        if (
          host.liveAdmission(socket)?.generation !== admission.generation ||
          !latest ||
          !admitsRoomMember(latest, admission) ||
          checksumCanonicalJson(latest.revisions) !== checksumCanonicalJson(authorization.revisions)
        )
          throw new RoomAdmissionExpiredError()
        if (!receipt || entry.sequence !== current.sequence + 1)
          throw new Error('Room chat command sequence does not match its authority.')
        // A replayed entry spends nothing, as an exact retry in this epoch spends nothing.
        if (!replayed) host.buckets.charge(bucket)
        const committed = host.journal.commitInTransaction({
          actorId: admission.userId,
          authorityEpoch: value.authorityEpoch,
          commandId,
          fingerprint,
          expectedSequence: current.sequence,
          expectedStateChecksum: current.stateChecksum,
          nextStateChecksum: entry.chainChecksum,
          nextStateJson: current.stateJson,
          receiptJson: JSON.stringify(receipt)
        })
        if (committed.kind !== 'COMMITTED')
          throw new Error('Room chat command unexpectedly replayed inside its transaction.')
      }
    )
    if (!receipt) throw new Error('Room chat command receipt is unavailable.')
    for (const recipient of host.webSockets()) {
      const member = host.liveAdmission(recipient)
      if (!member || !admitsRoomMember(authorization, member)) continue
      // Every member advances the same room sequence; only the conversation reads the entry.
      send(
        recipient,
        executed.recipientUserIds.includes(member.userId)
          ? member.userId === admission.userId
            ? receipt
            : {
                type: 'COMMAND_COMMITTED',
                commandId,
                sequence: current.sequence + 1,
                delta: {
                  scope: 'CAMPAIGN_CHAT',
                  entry: executed.entry,
                  privateRoll: null
                }
              }
          : {
              type: 'COMMAND_COMMITTED',
              commandId,
              sequence: current.sequence + 1,
              delta: null
            }
      )
    }
    await host.scheduleAlarm()
  } catch (error) {
    if (error instanceof RoomRateLimitedError)
      host.rejectCommand(socket, commandId, 'RATE_LIMITED', error.message)
    else if (error instanceof CampaignChatCommandError)
      host.rejectCommand(socket, commandId, 'DOMAIN_REJECTED', error.message)
    else {
      const refusal = encounterCommandRefusal(error)
      host.rejectCommand(socket, commandId, refusal.code, refusal.message)
    }
  }
}
