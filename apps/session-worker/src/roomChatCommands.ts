import { buildConversationEntryRecords } from '@artificer-toolkit/encounter-persistence/conversationEntryRecords'
import { openConversation, insertConversationEntry } from '@artificer-toolkit/encounter-persistence/conversationPersistence'
import { presentChatEntries } from '@artificer-toolkit/encounter-persistence/conversationPresentation'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import type { CampaignChatEntryDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import {
  campaignChatLiveCommandSchema,
  type CampaignChatLiveCommand
} from '@artificer-toolkit/schema/api/campaignChatLiveCommands'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { createRollRecord } from '@artificer-toolkit/rules-runtime/character/rollRecord'
import { resolveCharacterSheetRoll } from '@artificer-toolkit/rules-runtime/character/sheetRoll'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'
import { prepareRoomLiveCharacterSheet } from './roomCharacterRules.js'
import {
  projectRoomCharacterSheet,
  projectRoomCharacterSheetForViewer
} from './roomCharacterSheetProjection.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import { secureRandomInt } from './nativeRulesRuntime.js'

/** A refusal the sender should read, as opposed to an unavailable room. */
export class CampaignChatCommandError extends Error {}

/**
 * One chat message or Campaign roll as a room command (D69). The entry's header and payload are
 * written together through the shared conversation writer, so the room's next checkpoint carries
 * both; the caller commits the receipt, rate charge and sequence in the same transaction.
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
}): Promise<{ entry: CampaignChatEntryDto; recipientUserIds: string[] }> {
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
  if (!username) throw new CampaignChatCommandError('A username is required to post in this Campaign.')
  const requirePeer = ctx.ports.requireCampaignAuthority
  const assignedCharacterId = async (characterId: string) => {
    await ctx.ports.requireCampaignCharacterAuthority(campaignId, characterId, userId)
    const owner = (await inputs.character(characterId, observed, transaction)).inputs?.owner
    if (!owner || owner.status !== 'ACTIVE')
      throw new CampaignChatCommandError('Character requires Builder repair before rolling.')
    return owner
  }
  const clientNonce = command.commandId.toLowerCase()
  // A nonce sent before this epoch has no journal receipt to replay.
  const prior = await ctx.db
    .query('campaignConversationEntries')
    .withIndex('by_campaignId_authorUserId_clientNonce', (q) =>
      q.eq('campaignId', campaignId).eq('authorUserId', userId).eq('clientNonce', clientNonce)
    )
    .unique()
  if (prior) throw new CampaignChatCommandError('This message was already sent.')
  const members = authorization.campaign.members
  // Entries cannot precede a current member's freshly advanced access cutoff.
  const createdAt = new Date(
    Math.max(Date.now(), ...members.map((member) => Date.parse(member.membershipEpoch)))
  ).toISOString()

  const { access, content } = await (async () => {
    if (command.type === 'SEND_CHAT') {
      const chat = command.input
      const access = await openConversation(
        ctx,
        authority,
        chat.room,
        requirePeer,
        chat.directUserId
      )
      if (chat.mode === 'ROLEPLAY' && membership.role !== 'PLAYER')
        throw new CampaignChatCommandError('Assigned Character is unavailable.')
      const character =
        chat.mode === 'ROLEPLAY'
          ? await assignedCharacterId(chat.assignedCharacterId!.toLowerCase())
          : null
      return {
        access,
        content: {
          kind: 'CHAT' as const,
          mode: chat.mode,
          body: chat.body,
          character: character && { id: character.id, label: character.label }
        }
      }
    }
    const { roll, destination } = command.input
    if (roll.characterId === null && (membership.role !== 'OWNER' || roll.source.kind !== 'MANUAL'))
      throw new CampaignChatCommandError(
        'Only the Campaign owner may roll without an assigned Character.'
      )
    if (destination === 'GM' && membership.role === 'OWNER')
      throw new CampaignChatCommandError('The GM rolls privately instead of to the GM.')
    const access =
      destination === 'TABLE'
        ? await openConversation(ctx, authority, 'TABLE', requirePeer)
        : await openConversation(ctx, authority, 'DIRECT', requirePeer, campaign.ownerUserId)
    const character = roll.characterId
      ? await assignedCharacterId(roll.characterId.toLowerCase())
      : null
    if (!roll.characterId && authorization.campaign.assignments.length === 0)
      throw new CampaignChatCommandError(
        'Assign at least one Character before making a Campaign roll.'
      )
    const system = await ctx.ports.requireSystem(campaign.gameSystemId)
    let resolved = {
      expression: roll.expression,
      rollMode: roll.rollMode ?? ('NORMAL' as const),
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
    return {
      access,
      content: {
        kind: 'ROLL' as const,
        revealedByGm: false,
        roll: createRollRecord({
          characterId: character?.id ?? null,
          label: character?.label ?? username,
          system,
          resolved,
          nextInt: secureRandomInt
        })
      }
    }
  })()

  const { identity, payload } = buildConversationEntryRecords({
    campaignId,
    conversationId: access.conversation.id,
    authorUserId: userId,
    clientNonce,
    createdAt,
    username,
    content
  })
  await insertConversationEntry(ctx, identity, payload)
  const [entry] = presentChatEntries(
    [{ header: identity, payload }],
    access.conversation,
    campaign.contentMaturity,
    [username]
  )
  return {
    entry: entry!,
    recipientUserIds:
      access.conversation.kind === 'DIRECT'
        ? access.conversation.participantUserIds
        : members
            .filter((member) => access.conversation.kind === 'TABLE' || member.role === 'PLAYER')
            .map((member) => member.userId)
  }
}
