import { z } from 'zod'
import { parseRollExpression, validateRollMode } from '@artificer-toolkit/shared/rolls'

import { rollRecordDtoSchema, rollSourceDtoSchema } from './rolls.js'
import { timestampSchema, uuidSchema } from './campaignContractSchemas.js'

export const campaignRealtimeScopeDtoSchema = z.enum(['TABLE', 'PARTY', 'DIRECT', 'OWNER', 'USER'])
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
export const campaignRealtimeEnvelopeDtoSchema = z
  .strictObject({
    scope: campaignRealtimeScopeDtoSchema,
    conversationId: uuidSchema.optional(),
    recipientUserId: uuidSchema.optional(),
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
    cursor: z.string().trim().min(1).max(200)
  })
  .superRefine((envelope, context) => {
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

export const campaignConversationKindDtoSchema = z.enum(['TABLE', 'PARTY', 'DIRECT'])
export const campaignChatRoomDtoSchema = campaignConversationKindDtoSchema
export const campaignChatEntryKindDtoSchema = z.enum(['CHAT', 'ROLL'])
export const campaignChatModeDtoSchema = z.enum(['OOC', 'ROLEPLAY'])
export const campaignChatEntryDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  conversationId: uuidSchema,
  room: campaignChatRoomDtoSchema,
  kind: campaignChatEntryKindDtoSchema,
  mode: campaignChatModeDtoSchema.nullable(),
  body: z.string().max(2000).nullable(),
  roll: rollRecordDtoSchema.nullable(),
  authorUserId: uuidSchema,
  authorUsername: z.string().trim().min(1).max(30),
  characterId: uuidSchema.nullable(),
  characterLabel: z.string().trim().min(1).max(100).nullable(),
  editedAt: timestampSchema.nullable(),
  unsentAt: timestampSchema.nullable(),
  createdAt: timestampSchema
})
export const campaignConversationDtoSchema = z
  .strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    kind: campaignConversationKindDtoSchema,
    participantUserIds: z.array(uuidSchema).max(2),
    createdAt: timestampSchema,
    lastReadAt: timestampSchema.nullable(),
    unreadCount: z.number().int().nonnegative()
  })
  .superRefine((conversation, context) => {
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
export const campaignConversationsDtoSchema = z.array(campaignConversationDtoSchema)
export const listCampaignConversationsInputSchema = z.strictObject({ campaignId: uuidSchema })
export const getCampaignConversationInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    kind: campaignConversationKindDtoSchema,
    directUserId: uuidSchema.optional()
  })
  .superRefine((input, context) => {
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
export const markCampaignConversationReadInputSchema = z.strictObject({
  campaignId: uuidSchema,
  conversationId: uuidSchema,
  entryId: uuidSchema
})
export const sendCampaignChatEntryInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    room: campaignChatRoomDtoSchema,
    directUserId: uuidSchema.optional(),
    mode: campaignChatModeDtoSchema,
    body: z.string().trim().min(1).max(2000),
    assignedCharacterId: uuidSchema.optional(),
    clientNonce: uuidSchema
  })
  .superRefine((input, context) => {
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
const executeCampaignRollDetailsSchema = z
  .strictObject({
    characterId: uuidSchema.nullable(),
    expression: z.string().trim().min(1).max(200),
    rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']).optional(),
    source: rollSourceDtoSchema
  })
  .superRefine(({ expression, rollMode }, context) => {
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
export const executeCampaignRollInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    room: campaignChatRoomDtoSchema,
    directUserId: uuidSchema.optional(),
    clientNonce: uuidSchema,
    roll: executeCampaignRollDetailsSchema
  })
  .superRefine((input, context) => {
    if (input.room !== 'TABLE')
      context.addIssue({
        code: 'custom',
        path: ['room'],
        message: 'Campaign rolls can only be sent to the TABLE conversation.'
      })
    if (input.room !== 'DIRECT' && input.directUserId)
      context.addIssue({
        code: 'custom',
        path: ['directUserId'],
        message: 'Only direct conversations have a participant.'
      })
    if (input.room === 'TABLE' && input.roll.characterId === null) return
    if (input.roll.characterId === null)
      context.addIssue({
        code: 'custom',
        path: ['roll', 'characterId'],
        message: 'A player Campaign roll requires an assigned Character.'
      })
  })
export const executeCampaignPrivateRollInputSchema = z
  .strictObject({ campaignId: uuidSchema, roll: executeCampaignRollDetailsSchema })
  .superRefine((input, context) => {
    if (input.roll.characterId !== null)
      context.addIssue({
        code: 'custom',
        path: ['roll', 'characterId'],
        message: 'GM private rolls do not use a Character.'
      })
  })
export const editCampaignChatEntryInputSchema = z.strictObject({
  campaignId: uuidSchema,
  entryId: uuidSchema,
  body: z.string().trim().min(1).max(2000)
})
export const unsendCampaignChatEntryInputSchema = z.strictObject({
  campaignId: uuidSchema,
  entryId: uuidSchema
})
export const listCampaignChatEntriesInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    room: campaignChatRoomDtoSchema,
    directUserId: uuidSchema.optional(),
    cursor: uuidSchema.optional(),
    limit: z.number().int().min(1).max(100).default(50)
  })
  .superRefine((input, context) => {
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
export const campaignChatPageDtoSchema = z.strictObject({
  entries: z.array(campaignChatEntryDtoSchema),
  nextCursor: uuidSchema.nullable(),
  lastReadAt: timestampSchema.nullable(),
  unreadCount: z.number().int().nonnegative()
})

export type CampaignRealtimeEnvelopeDto = z.infer<typeof campaignRealtimeEnvelopeDtoSchema>
export type CampaignConversationDto = z.infer<typeof campaignConversationDtoSchema>
export type CampaignChatEntryDto = z.infer<typeof campaignChatEntryDtoSchema>
export type SendCampaignChatEntryInput = z.input<typeof sendCampaignChatEntryInputSchema>
export type ExecuteCampaignRollInput = z.input<typeof executeCampaignRollInputSchema>
export type ExecuteCampaignPrivateRollInput = z.input<typeof executeCampaignPrivateRollInputSchema>
export type CampaignChatPageDto = z.infer<typeof campaignChatPageDtoSchema>
