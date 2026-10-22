import { z, lazySchema } from '../zod.js'
import { systemVocabularyCodeSchema } from '../shared/systemVocabularyCode.js'
import { parseRollExpression, validateRollMode } from '@artificer-toolkit/shared/rolls'

import { rollRecordDtoSchema, rollRevealModeDtoSchema, rollSourceDtoSchema } from './rolls.js'
import {
  campaignAuthorLabelSchema,
  timestampSchema,
  uuidSchema
} from './campaignContractSchemas.js'

export const campaignRealtimeScopeDtoSchema = lazySchema(() =>
  z.enum(['TABLE', 'PARTY', 'DIRECT', 'OWNER', 'USER'])
)
export function getCampaignRealtimeTopic(input: {
  campaignId: string
  scope: z.infer<typeof campaignRealtimeScopeDtoSchema>
  userId: string
  accessStartedAt: string
  conversationId?: string
}): string {
  if (input.scope === 'DIRECT' && !input.conversationId)
    throw new Error('Direct realtime topics require a conversation ID.')
  const conversation = input.scope === 'DIRECT' ? `:${input.conversationId ?? ''}` : ''
  return `campaign:${input.campaignId}:${input.scope.toLowerCase()}${conversation}:${input.userId}:${Date.parse(input.accessStartedAt)}`
}
export const campaignRealtimeEnvelopeDtoSchema = lazySchema(() =>
  z
    .strictObject({
      scope: campaignRealtimeScopeDtoSchema,
      conversationId: z.optional(uuidSchema),
      recipientUserId: z.optional(uuidSchema),
      entity: z.enum([
        'CAMPAIGN',
        'MEMBERSHIP',
        'CHARACTER',
        'CONTENT',
        'INVENTORY',
        'CHAT',
        'NOTE',
        'SESSION',
        'CLOCK'
      ]),
      entityId: uuidSchema,
      event: z.enum(['CREATED', 'UPDATED', 'DELETED']),
      eventId: uuidSchema,
      cursor: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(200))
    })
    .check(
      z.superRefine((envelope, context) => {
        if (envelope.scope === 'DIRECT' && !envelope.conversationId)
          context.addIssue({
            code: 'custom',
            path: ['conversationId'],
            message: 'Direct broadcasts require a conversation ID.'
          })
        if (envelope.scope !== 'DIRECT' && envelope.conversationId)
          context.addIssue({
            code: 'custom',
            path: ['conversationId'],
            message: 'Only direct broadcasts have a conversation ID.'
          })
        if (envelope.scope === 'USER' && !envelope.recipientUserId)
          context.addIssue({
            code: 'custom',
            path: ['recipientUserId'],
            message: 'User broadcasts require a recipient user ID.'
          })
        if (envelope.scope !== 'USER' && envelope.recipientUserId)
          context.addIssue({
            code: 'custom',
            path: ['recipientUserId'],
            message: 'Only user broadcasts have a recipient user ID.'
          })
      })
    )
)

export const campaignConversationKindDtoSchema = lazySchema(() =>
  z.enum(['TABLE', 'PARTY', 'DIRECT'])
)
const campaignChatRoomDtoSchema = campaignConversationKindDtoSchema
export const campaignChatEntryKindDtoSchema = lazySchema(() =>
  z.enum(['CHAT', 'ROLL', 'ROLL_NOTICE'])
)
export const campaignChatModeDtoSchema = lazySchema(() => z.enum(['OOC', 'ROLEPLAY']))
/**
 * Unread counts are exact below this value; this value means "at least this many". The count is
 * read from the entry index, so the cap bounds its reads to about one page of entry headers.
 */
export const campaignChatUnreadCountLimit = 50
const campaignChatUnreadCountSchema = lazySchema(() =>
  z.number().check(z.int()).check(z.nonnegative()).check(z.lte(campaignChatUnreadCountLimit))
)
export const deletedCampaignAuthorLabel = 'Deleted user'
/** The author shown on roll entries the rules write, such as a settled Concentration check. */
export const ruleCheckAuthorLabel = 'Rules'
/** The chat line the table sees when the GM skips a pending movement decision (D26). */
export const MOVEMENT_DECISION_SKIPPED_MESSAGE = 'The GM skipped this decision.'
export const campaignChatEntryDtoSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    conversationId: uuidSchema,
    room: campaignChatRoomDtoSchema,
    kind: campaignChatEntryKindDtoSchema,
    mode: z.nullable(campaignChatModeDtoSchema),
    body: z.nullable(z.string().check(z.maxLength(2000))),
    roll: z.nullable(rollRecordDtoSchema),
    revealedByGm: z.boolean(),
    authorUserId: uuidSchema,
    authorUsername: campaignAuthorLabelSchema,
    characterId: z.nullable(uuidSchema),
    characterLabel: z.nullable(
      z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(100))
    ),
    editedAt: z.nullable(timestampSchema),
    unsentAt: z.nullable(timestampSchema),
    createdAt: timestampSchema
  })
)
export const campaignConversationDtoSchema = lazySchema(() =>
  z
    .strictObject({
      id: uuidSchema,
      campaignId: uuidSchema,
      kind: campaignConversationKindDtoSchema,
      participantUserIds: z.array(uuidSchema).check(z.maxLength(2)),
      createdAt: timestampSchema,
      lastReadAt: z.nullable(timestampSchema),
      unreadCount: campaignChatUnreadCountSchema
    })
    .check(
      z.superRefine((conversation, context) => {
        if (conversation.kind === 'DIRECT' && conversation.participantUserIds.length !== 2)
          context.addIssue({
            code: 'custom',
            path: ['participantUserIds'],
            message: 'Direct conversations require exactly two participants.'
          })
        if (
          conversation.kind === 'DIRECT' &&
          conversation.participantUserIds.length === 2 &&
          conversation.participantUserIds[0] === conversation.participantUserIds[1]
        )
          context.addIssue({
            code: 'custom',
            path: ['participantUserIds'],
            message: 'Direct participants must be distinct.'
          })
        if (conversation.kind !== 'DIRECT' && conversation.participantUserIds.length !== 0)
          context.addIssue({
            code: 'custom',
            path: ['participantUserIds'],
            message: 'Only direct conversations have participants.'
          })
      })
    )
)
export const campaignConversationsDtoSchema = lazySchema(() =>
  z.array(campaignConversationDtoSchema)
)
export const listCampaignConversationsInputSchema = lazySchema(() =>
  z.strictObject({ campaignId: uuidSchema })
)
export const getCampaignConversationInputSchema = lazySchema(() =>
  z
    .strictObject({
      campaignId: uuidSchema,
      kind: campaignConversationKindDtoSchema,
      directUserId: z.optional(uuidSchema)
    })
    .check(
      z.superRefine((input, context) => {
        if (input.kind === 'DIRECT' && !input.directUserId)
          context.addIssue({
            code: 'custom',
            path: ['directUserId'],
            message: 'Direct conversations require a participant.'
          })
        if (input.kind !== 'DIRECT' && input.directUserId)
          context.addIssue({
            code: 'custom',
            path: ['directUserId'],
            message: 'Only direct conversations have a participant.'
          })
      })
    )
)
export const markCampaignConversationReadInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    conversationId: uuidSchema,
    entryId: uuidSchema
  })
)
export const sendCampaignChatEntryInputSchema = lazySchema(() =>
  z
    .strictObject({
      campaignId: uuidSchema,
      room: campaignChatRoomDtoSchema,
      directUserId: z.optional(uuidSchema),
      mode: campaignChatModeDtoSchema,
      body: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(2000)),
      assignedCharacterId: z.optional(uuidSchema),
      clientNonce: uuidSchema
    })
    .check(
      z.superRefine((input, context) => {
        if (input.room === 'DIRECT' && !input.directUserId)
          context.addIssue({
            code: 'custom',
            path: ['directUserId'],
            message: 'Direct chat requires a participant.'
          })
        if (input.room !== 'DIRECT' && input.directUserId)
          context.addIssue({
            code: 'custom',
            path: ['directUserId'],
            message: 'Only direct chat has a participant.'
          })
        if (input.mode === 'ROLEPLAY' && !input.assignedCharacterId)
          context.addIssue({
            code: 'custom',
            path: ['assignedCharacterId'],
            message: 'Roleplay chat requires an assigned Character.'
          })
        if (input.mode === 'OOC' && input.assignedCharacterId)
          context.addIssue({
            code: 'custom',
            path: ['assignedCharacterId'],
            message: 'Out-of-character chat uses the account username.'
          })
      })
    )
)
const executeCampaignRollDetailsSchema = lazySchema(() =>
  z
    .strictObject({
      characterId: z.nullable(uuidSchema),
      expression: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(200)),
      rollMode: z.optional(systemVocabularyCodeSchema),
      source: rollSourceDtoSchema
    })
    .check(
      z.superRefine(({ expression, rollMode }, context) => {
        try {
          validateRollMode(parseRollExpression(expression), rollMode ?? 'NORMAL')
        } catch (error) {
          context.addIssue({
            code: 'custom',
            path: ['expression'],
            message: error instanceof Error ? error.message : 'Invalid roll expression.'
          })
        }
      })
    )
)
/** TABLE posts to everyone; GM posts to the caller's DIRECT conversation with the Campaign owner. */
export const campaignRollDestinationDtoSchema = lazySchema(() => z.enum(['TABLE', 'GM']))
export const executeCampaignRollInputSchema = lazySchema(() =>
  z
    .strictObject({
      campaignId: uuidSchema,
      destination: campaignRollDestinationDtoSchema,
      clientNonce: uuidSchema,
      roll: executeCampaignRollDetailsSchema
    })
    .check(
      z.superRefine((input, context) => {
        if (input.destination === 'GM' && input.roll.characterId === null)
          context.addIssue({
            code: 'custom',
            path: ['roll', 'characterId'],
            message: 'A roll to the GM requires an assigned Character.'
          })
      })
    )
)
/**
 * GM-only roll retained in the GM's private history; players see nothing until a reveal. The nonce
 * becomes the retained roll's id, so a retry returns the same roll.
 */
export const executeCampaignPrivateRollInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    clientNonce: uuidSchema,
    roll: executeCampaignRollDetailsSchema
  })
)
/**
 * FULL posts the roll card to the table. NOTICE posts "the GM made a roll" without its result or
 * reason, naming the creature only while players can see it. Each mode happens once per roll.
 */
export const revealCampaignRollInputSchema = lazySchema(() =>
  z.strictObject({ campaignId: uuidSchema, rollId: uuidSchema, mode: rollRevealModeDtoSchema })
)
export const editCampaignChatEntryInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    entryId: uuidSchema,
    body: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(2000))
  })
)
export const unsendCampaignChatEntryInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    entryId: uuidSchema
  })
)
export const listCampaignChatEntriesInputSchema = lazySchema(() =>
  z
    .strictObject({
      campaignId: uuidSchema,
      room: campaignChatRoomDtoSchema,
      directUserId: z.optional(uuidSchema),
      cursor: z.optional(uuidSchema),
      limit: z._default(z.number().check(z.int()).check(z.gte(1)).check(z.lte(100)), 50)
    })
    .check(
      z.superRefine((input, context) => {
        if (input.room === 'DIRECT' && !input.directUserId)
          context.addIssue({
            code: 'custom',
            path: ['directUserId'],
            message: 'Direct chat requires a participant.'
          })
        if (input.room !== 'DIRECT' && input.directUserId)
          context.addIssue({
            code: 'custom',
            path: ['directUserId'],
            message: 'Only direct chat has a participant.'
          })
      })
    )
)
export const campaignChatPageDtoSchema = lazySchema(() =>
  z.strictObject({
    entries: z.array(campaignChatEntryDtoSchema),
    nextCursor: z.nullable(uuidSchema),
    lastReadAt: z.nullable(timestampSchema),
    unreadCount: campaignChatUnreadCountSchema
  })
)

export type CampaignRealtimeEnvelopeDto = z.infer<typeof campaignRealtimeEnvelopeDtoSchema>
export type CampaignConversationDto = z.infer<typeof campaignConversationDtoSchema>
export type CampaignChatEntryDto = z.infer<typeof campaignChatEntryDtoSchema>
export type SendCampaignChatEntryInput = z.input<typeof sendCampaignChatEntryInputSchema>
export type ExecuteCampaignRollInput = z.input<typeof executeCampaignRollInputSchema>
export type ExecuteCampaignPrivateRollInput = z.input<typeof executeCampaignPrivateRollInputSchema>
export type CampaignRollDestinationDto = z.infer<typeof campaignRollDestinationDtoSchema>
export type RevealCampaignRollInput = z.input<typeof revealCampaignRollInputSchema>
export type CampaignChatPageDto = z.infer<typeof campaignChatPageDtoSchema>
export type ListCampaignChatEntriesInput = z.input<typeof listCampaignChatEntriesInputSchema>
