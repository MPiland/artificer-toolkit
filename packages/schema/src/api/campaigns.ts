import { z } from 'zod'
import { parseRollExpression, validateRollMode } from '@artificer-toolkit/shared/rolls'

import { authoredRichTextSchema } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterSheetAdjustmentCommandDtoSchema } from './characterSheet.js'
import { authoredSubjectKindDtoSchema } from './content.js'
import { rollRecordDtoSchema, rollSourceDtoSchema } from './rolls.js'

const uuidSchema = z.string().uuid()
const versionSchema = z.number().int().nonnegative()
const timestampSchema = z.string().datetime()
const shortTextSchema = z.string().trim().min(1).max(120)
const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'Use an IANA time zone, such as America/Chicago.')
const campaignDescriptionSchema = authoredRichTextSchema
const jsonSchema = z.json()

export const entitlementTierDtoSchema = z.enum(['FREE', 'PLAYER', 'GM', 'PRO_GM'])

export const entitlementLimitDtoSchema = z.strictObject({
  storageBytes: z.number().int().nonnegative().nullable(),
  personalCharacters: z.number().int().nonnegative().nullable(),
  homebrewRoots: z.number().int().nonnegative().nullable(),
  activeHostedCampaigns: z.number().int().nonnegative().nullable(),
  playerSeatsPerCampaign: z.number().int().positive(),
  publicListings: z.number().int().nonnegative().nullable(),
  savedEncounters: z.number().int().nonnegative().nullable(),
  paidTablesEnabled: z.boolean(),
  platformFeeBasisPoints: z.number().int().nonnegative()
})

export const entitlementUsageDtoSchema = z.strictObject({
  storageBytes: z.number().int().nonnegative(),
  personalCharacters: z.number().int().nonnegative(),
  homebrewRoots: z.number().int().nonnegative(),
  activeHostedCampaigns: z.number().int().nonnegative(),
  publicListings: z.number().int().nonnegative(),
  savedEncounters: z.number().int().nonnegative()
})

export const entitlementPricingDtoSchema = z.strictObject({
  currency: z.literal('USD'),
  monthlyPriceCents: z.number().int().nonnegative(),
  annualPriceCents: z.number().int().nonnegative()
})

export const entitlementProjectionDtoSchema = z.strictObject({
  tier: entitlementTierDtoSchema,
  limits: entitlementLimitDtoSchema,
  usage: entitlementUsageDtoSchema,
  pricing: entitlementPricingDtoSchema
})

export const campaignRoleDtoSchema = z.enum(['OWNER', 'PLAYER'])
export const campaignStatusDtoSchema = z.enum(['ACTIVE', 'ARCHIVED'])
export const campaignVisibilityDtoSchema = z.enum(['PRIVATE', 'PUBLIC'])

export const campaignCapabilitiesDtoSchema = z.strictObject({
  edit: z.boolean(),
  archive: z.boolean(),
  delete: z.boolean(),
  invite: z.boolean(),
  manageMembers: z.boolean(),
  manageCharacters: z.boolean(),
  assignOwnCharacter: z.boolean(),
  manageContent: z.boolean(),
  submitContent: z.boolean(),
  managePartyInventory: z.boolean(),
  transferOwnInventory: z.boolean(),
  manageNotes: z.boolean(),
  contributeSessionNotes: z.boolean(),
  readTableChat: z.boolean(),
  readPartyChat: z.boolean()
})

export const campaignCharacterSummaryDtoSchema = z.strictObject({
  id: uuidSchema,
  publicId: z.string().trim().min(1),
  label: z.string().trim().min(1).max(100),
  systemId: postgresUuidSchema
})

export const campaignMembershipDtoSchema = z.strictObject({
  userId: uuidSchema,
  username: z.string().trim().min(1).max(30),
  role: campaignRoleDtoSchema,
  accessStartedAt: timestampSchema,
  acceptedAt: timestampSchema,
  assignedCharacter: campaignCharacterSummaryDtoSchema.nullable()
})

const campaignBaseDtoSchema = z.strictObject({
  id: uuidSchema,
  publicId: z.string().trim().min(1),
  name: shortTextSchema,
  description: campaignDescriptionSchema.nullable(),
  status: campaignStatusDtoSchema,
  visibility: campaignVisibilityDtoSchema,
  role: campaignRoleDtoSchema,
  version: versionSchema,
  memberCount: z.number().int().nonnegative(),
  playerCount: z.number().int().nonnegative(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  capabilities: campaignCapabilitiesDtoSchema,
  assignedCharacter: campaignCharacterSummaryDtoSchema.nullable()
})

export const campaignSummaryDtoSchema = campaignBaseDtoSchema
export const campaignSummariesDtoSchema = z.array(campaignSummaryDtoSchema)
export const campaignDetailDtoSchema = campaignBaseDtoSchema.extend({
  attunementSlotOverride: z.number().int().nonnegative().nullable(),
  memberships: z.array(campaignMembershipDtoSchema)
})

export const createCampaignInputSchema = z.strictObject({
  name: shortTextSchema,
  description: campaignDescriptionSchema.nullable().optional(),
  visibility: campaignVisibilityDtoSchema.default('PRIVATE')
})

export const campaignPublicIdInputSchema = z.strictObject({
  campaignPublicId: z.string().trim().min(1)
})

export const updateCampaignInputSchema = z.strictObject({
  campaignId: uuidSchema,
  name: shortTextSchema.optional(),
  description: campaignDescriptionSchema.nullable().optional(),
  attunementSlotOverride: z.number().int().nonnegative().nullable().optional(),
  visibility: campaignVisibilityDtoSchema.optional(),
  expectedVersion: versionSchema
})

const campaignVersionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  expectedVersion: versionSchema
})

export const archiveCampaignInputSchema = campaignVersionInputSchema
export const deleteCampaignInputSchema = campaignVersionInputSchema.extend({
  confirmation: z.literal('DELETE')
})
export const campaignIdInputSchema = z.strictObject({ campaignId: uuidSchema })
export const leaveCampaignInputSchema = campaignIdInputSchema
export const removeCampaignMemberInputSchema = z.strictObject({
  campaignId: uuidSchema,
  userId: uuidSchema
})
export const assignCampaignCharacterInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema
})
export const unassignCampaignCharacterInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema.optional()
})

export const campaignInviteKindDtoSchema = z.enum(['LINK', 'USERNAME', 'EMAIL'])
export const createCampaignInviteInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    kind: campaignInviteKindDtoSchema,
    target: z.string().trim().min(1).max(320).optional(),
    expiresAt: timestampSchema.optional()
  })
  .superRefine(({ kind, target }, context) => {
    if (kind === 'LINK' && target !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'Link invites cannot target an account.'
      })
    }
    if (kind !== 'LINK' && target === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'Target is required for direct invites.'
      })
    }
  })

export const campaignInviteDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  kind: campaignInviteKindDtoSchema,
  token: z.string().min(1),
  expiresAt: timestampSchema,
  createdAt: timestampSchema
})

export const acceptCampaignInviteInputSchema = z.strictObject({ token: z.string().min(1).max(512) })
export const revokeCampaignInviteInputSchema = z.strictObject({
  campaignId: uuidSchema,
  inviteId: uuidSchema
})
export const requestCampaignOwnershipTransferInputSchema = z.strictObject({
  campaignId: uuidSchema,
  recipientUserId: uuidSchema
})
export const acceptCampaignOwnershipTransferInputSchema = z.strictObject({
  campaignId: uuidSchema
})

export const campaignContentBindingDtoSchema = z.strictObject({
  id: uuidSchema,
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema,
  version: versionSchema,
  snapshot: jsonSchema,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  createdAt: timestampSchema,
  reviewedAt: timestampSchema.nullable()
})
export const campaignContentBindingsDtoSchema = z.array(campaignContentBindingDtoSchema)

export const campaignCharacterBindingSummaryDtoSchema = z.strictObject({
  characterId: uuidSchema,
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema,
  campaignContentBindingId: uuidSchema,
  version: versionSchema
})

export const submitCampaignContentVersionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: uuidSchema,
  version: versionSchema,
  snapshot: jsonSchema
})
export const reviewCampaignContentVersionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  contentVersionId: uuidSchema,
  decision: z.enum(['APPROVE', 'REJECT'])
})

export const currencyDenominationDtoSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().trim().min(1).max(80),
  abbreviation: z.string().trim().min(1).max(16),
  scaleInReference: z.number().int().safe().positive()
})
const currencyDenominationInputSchema = currencyDenominationDtoSchema
  .omit({ id: true })
  .extend({ id: uuidSchema.optional() })
export const currencySystemDtoSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().trim().min(1).max(80),
  isReference: z.boolean(),
  denominations: z.array(currencyDenominationDtoSchema).min(1).max(5),
  version: versionSchema
})
export const saveCampaignCurrencySystemInputSchema = z.strictObject({
  campaignId: uuidSchema,
  systemId: uuidSchema.optional(),
  label: z.string().trim().min(1).max(80),
  isReference: z.boolean(),
  denominations: z.array(currencyDenominationInputSchema).min(1).max(5),
  expectedVersion: versionSchema.optional()
})
export const deleteCampaignCurrencySystemInputSchema = z.strictObject({
  campaignId: uuidSchema,
  systemId: uuidSchema,
  expectedVersion: versionSchema
})

export const inventoryOwnerRefDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CHARACTER'), characterId: uuidSchema }),
  z.strictObject({ kind: z.literal('CAMPAIGN'), campaignId: uuidSchema })
])
export const inventoryItemDtoSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().trim().min(1).max(120),
  quantity: z.number().int().safe().positive(),
  containerId: uuidSchema.nullable(),
  isContainer: z.boolean()
})
export const inventoryCurrencyDtoSchema = z.strictObject({
  kind: z.enum(['RULESET', 'CAMPAIGN']),
  denominationId: postgresUuidSchema,
  label: z.string().trim().min(1).max(80),
  abbreviation: z.string().trim().min(1).max(16),
  amount: z.number().int().safe().nonnegative(),
  containerId: uuidSchema.nullable()
})
export const inventoryDtoSchema = z.strictObject({
  owner: inventoryOwnerRefDtoSchema,
  version: versionSchema,
  items: z.array(inventoryItemDtoSchema),
  currencies: z.array(inventoryCurrencyDtoSchema)
})
export const getCampaignInventoryInputSchema = z.strictObject({
  campaignId: uuidSchema,
  owner: inventoryOwnerRefDtoSchema
})
export const transferCampaignInventoryInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ITEM'),
    campaignId: uuidSchema,
    source: inventoryOwnerRefDtoSchema,
    destination: inventoryOwnerRefDtoSchema,
    itemId: uuidSchema,
    amount: z.number().int().safe().positive(),
    expectedSourceVersion: versionSchema,
    expectedDestinationVersion: versionSchema,
    idempotencyKey: uuidSchema
  }),
  z.strictObject({
    kind: z.literal('CURRENCY'),
    campaignId: uuidSchema,
    source: inventoryOwnerRefDtoSchema,
    destination: inventoryOwnerRefDtoSchema,
    denominationId: postgresUuidSchema,
    amount: z.number().int().safe().positive(),
    expectedSourceVersion: versionSchema,
    expectedDestinationVersion: versionSchema,
    idempotencyKey: uuidSchema
  })
])
export const campaignInventoryTransferResultDtoSchema = z.strictObject({ eventId: uuidSchema })

const inventoryMutationVersionFields = {
  campaignId: uuidSchema,
  expectedOwnerVersion: versionSchema,
  idempotencyKey: uuidSchema
}
export const campaignPartyInventoryMutationInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_ADD'),
    equipmentId: postgresUuidSchema,
    quantity: z.number().int().safe().positive()
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_UPDATE'),
    itemId: uuidSchema,
    quantity: z.number().int().safe().positive()
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_CONSUME'),
    itemId: uuidSchema,
    amount: z.number().int().safe().positive()
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_REMOVE'),
    itemId: uuidSchema
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('CURRENCY_ADJUST'),
    denominationId: postgresUuidSchema,
    amount: z
      .number()
      .int()
      .safe()
      .refine((value) => value !== 0)
  })
])
export const campaignPartyInventoryMutationResultDtoSchema = z.strictObject({
  eventId: uuidSchema
})
export const listCampaignInventoryAuditInputSchema = z.strictObject({
  campaignId: uuidSchema,
  cursor: uuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50)
})
export const campaignInventoryAuditEventDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  actorUserId: uuidSchema.nullable(),
  subjectCharacterId: uuidSchema.nullable(),
  kind: z.string().trim().min(1).max(80),
  visibility: z.literal('OWNER'),
  payload: jsonSchema,
  createdAt: timestampSchema
})
export const campaignInventoryAuditPageDtoSchema = z.strictObject({
  events: z.array(campaignInventoryAuditEventDtoSchema),
  nextCursor: uuidSchema.nullable()
})

export const campaignAdjustmentVisibilityDtoSchema = z.enum(['VISIBLE', 'SECRET'])
export const campaignAdjustmentDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  characterId: uuidSchema,
  adjustment: characterSheetAdjustmentCommandDtoSchema,
  visibility: campaignAdjustmentVisibilityDtoSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const campaignAdjustmentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  adjustment: characterSheetAdjustmentCommandDtoSchema,
  visibility: campaignAdjustmentVisibilityDtoSchema,
  expectedVersion: versionSchema
})
export const deleteCampaignAdjustmentInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  adjustmentId: uuidSchema,
  expectedVersion: versionSchema
})
export const listCampaignAdjustmentsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema
})
export const campaignAdjustmentsDtoSchema = z.array(campaignAdjustmentDtoSchema)

export const campaignConditionValueDtoSchema = z.strictObject({
  conditionTypeId: uuidSchema,
  notes: z.string().trim().max(2000).optional()
})
export const campaignConditionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  characterId: uuidSchema,
  conditionTypeId: uuidSchema,
  notes: z.string().trim().max(2000).optional(),
  visibility: campaignAdjustmentVisibilityDtoSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const saveCampaignConditionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  conditionTypeId: uuidSchema,
  notes: z.string().trim().max(2000).optional(),
  visibility: campaignAdjustmentVisibilityDtoSchema,
  expectedVersion: versionSchema
})
export const deleteCampaignConditionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  conditionId: uuidSchema,
  expectedVersion: versionSchema
})
export const campaignConditionsDtoSchema = z.array(campaignConditionDtoSchema)

export const campaignEventVisibilityDtoSchema = z.enum(['TABLE', 'OWNER', 'SUBJECT'])
export const campaignEventDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  type: z.string().trim().min(1).max(80),
  visibility: campaignEventVisibilityDtoSchema,
  subjectCharacterId: uuidSchema.nullable(),
  payload: jsonSchema,
  createdAt: timestampSchema
})
export const listCampaignEventsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  characterId: uuidSchema,
  cursor: uuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50)
})
export const campaignEventPageDtoSchema = z.strictObject({
  events: z.array(campaignEventDtoSchema),
  nextCursor: uuidSchema.nullable()
})

export const campaignRealtimeScopeDtoSchema = z.enum(['TABLE', 'PARTY', 'DIRECT', 'OWNER'])

export function getCampaignRealtimeTopic(input: {
  campaignId: string
  scope: z.infer<typeof campaignRealtimeScopeDtoSchema>
  userId: string
  accessStartedAt: string
  conversationId?: string
}): string {
  if (input.scope === 'DIRECT' && !input.conversationId) {
    throw new Error('Direct realtime topics require a conversation ID.')
  }
  const conversation = input.scope === 'DIRECT' ? `:${input.conversationId ?? ''}` : ''
  return `campaign:${input.campaignId}:${input.scope.toLowerCase()}${conversation}:${input.userId}:${Date.parse(input.accessStartedAt)}`
}

export const campaignRealtimeEnvelopeDtoSchema = z
  .strictObject({
    scope: campaignRealtimeScopeDtoSchema,
    conversationId: uuidSchema.optional(),
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
    if (envelope.scope === 'DIRECT' && !envelope.conversationId) {
      context.addIssue({
        code: 'custom',
        path: ['conversationId'],
        message: 'Direct broadcasts require a conversation ID.'
      })
    }
    if (envelope.scope !== 'DIRECT' && envelope.conversationId) {
      context.addIssue({
        code: 'custom',
        path: ['conversationId'],
        message: 'Only direct broadcasts have a conversation ID.'
      })
    }
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
    if (conversation.kind === 'DIRECT' && conversation.participantUserIds.length !== 2) {
      context.addIssue({
        code: 'custom',
        path: ['participantUserIds'],
        message: 'Direct conversations require exactly two participants.'
      })
    }
    if (
      conversation.kind === 'DIRECT' &&
      conversation.participantUserIds.length === 2 &&
      conversation.participantUserIds[0] === conversation.participantUserIds[1]
    ) {
      context.addIssue({
        code: 'custom',
        path: ['participantUserIds'],
        message: 'Direct participants must be distinct.'
      })
    }
    if (conversation.kind !== 'DIRECT' && conversation.participantUserIds.length !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['participantUserIds'],
        message: 'Only direct conversations have participants.'
      })
    }
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
    if (input.kind === 'DIRECT' && !input.directUserId) {
      context.addIssue({
        code: 'custom',
        path: ['directUserId'],
        message: 'Direct conversations require a participant.'
      })
    }
    if (input.kind !== 'DIRECT' && input.directUserId) {
      context.addIssue({
        code: 'custom',
        path: ['directUserId'],
        message: 'Only direct conversations have a participant.'
      })
    }
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
    if (input.room === 'DIRECT' && !input.directUserId) {
      context.addIssue({
        code: 'custom',
        path: ['directUserId'],
        message: 'Direct chat requires a participant.'
      })
    }
    if (input.room !== 'DIRECT' && input.directUserId) {
      context.addIssue({
        code: 'custom',
        path: ['directUserId'],
        message: 'Only direct chat has a participant.'
      })
    }
    if (input.mode === 'ROLEPLAY' && !input.assignedCharacterId) {
      context.addIssue({
        code: 'custom',
        path: ['assignedCharacterId'],
        message: 'Roleplay chat requires an assigned Character.'
      })
    }
    if (input.mode === 'OOC' && input.assignedCharacterId) {
      context.addIssue({
        code: 'custom',
        path: ['assignedCharacterId'],
        message: 'Out-of-character chat uses the account username.'
      })
    }
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
    if (input.room !== 'TABLE') {
      context.addIssue({
        code: 'custom',
        path: ['room'],
        message: 'Campaign rolls can only be sent to the TABLE conversation.'
      })
    }
    if (input.room !== 'DIRECT' && input.directUserId) {
      context.addIssue({
        code: 'custom',
        path: ['directUserId'],
        message: 'Only direct conversations have a participant.'
      })
    }
    if (input.room === 'TABLE' && input.roll.characterId === null) return
    if (input.roll.characterId === null) {
      context.addIssue({
        code: 'custom',
        path: ['roll', 'characterId'],
        message: 'A player Campaign roll requires an assigned Character.'
      })
    }
  })

export const executeCampaignPrivateRollInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    roll: executeCampaignRollDetailsSchema
  })
  .superRefine((input, context) => {
    if (input.roll.characterId !== null) {
      context.addIssue({
        code: 'custom',
        path: ['roll', 'characterId'],
        message: 'GM private rolls do not use a Character.'
      })
    }
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
    if (input.room === 'DIRECT' && !input.directUserId) {
      context.addIssue({
        code: 'custom',
        path: ['directUserId'],
        message: 'Direct chat requires a participant.'
      })
    }
    if (input.room !== 'DIRECT' && input.directUserId) {
      context.addIssue({
        code: 'custom',
        path: ['directUserId'],
        message: 'Only direct chat has a participant.'
      })
    }
  })
export const campaignChatPageDtoSchema = z.strictObject({
  entries: z.array(campaignChatEntryDtoSchema),
  nextCursor: uuidSchema.nullable(),
  lastReadAt: timestampSchema.nullable(),
  unreadCount: z.number().int().nonnegative()
})

export const campaignNotebookVisibilityDtoSchema = z.enum(['GM_PRIVATE', 'SHARED'])
export const campaignNotebookCategoryDtoSchema = z.enum(['GENERAL', 'PEOPLE', 'PLACES'])
export const campaignNotebookSectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  title: shortTextSchema,
  content: authoredRichTextSchema,
  visibility: campaignNotebookVisibilityDtoSchema,
  category: campaignNotebookCategoryDtoSchema,
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const createCampaignNotebookSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  title: shortTextSchema,
  content: authoredRichTextSchema,
  visibility: campaignNotebookVisibilityDtoSchema.default('GM_PRIVATE'),
  category: campaignNotebookCategoryDtoSchema.default('GENERAL')
})
export const updateCampaignNotebookSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sectionId: uuidSchema,
  title: shortTextSchema.optional(),
  content: authoredRichTextSchema.optional(),
  visibility: campaignNotebookVisibilityDtoSchema.optional(),
  category: campaignNotebookCategoryDtoSchema.optional(),
  expectedVersion: versionSchema
})
export const deleteCampaignNotebookSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sectionId: uuidSchema
})

export const campaignSessionStatusDtoSchema = z.enum(['OPEN', 'FINISHED'])
function validateCampaignSessionSchedule(
  value: {
    scheduledStartAt: string | null
    scheduledEndAt: string | null
    timeZone: string | null
  },
  context: z.RefinementCtx
): void {
  const { scheduledStartAt, scheduledEndAt, timeZone } = value
  if (scheduledStartAt === null && scheduledEndAt === null && timeZone === null) return
  if (scheduledStartAt === null || scheduledEndAt === null || timeZone === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Session scheduling requires a start, end, and time zone.'
    })
    return
  }
  if (Date.parse(scheduledEndAt) <= Date.parse(scheduledStartAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Session end must be after its start.',
      path: ['scheduledEndAt']
    })
  }
}
export const campaignSessionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionNumber: z.number().int().positive(),
  title: shortTextSchema.nullable(),
  scheduledStartAt: timestampSchema.nullable(),
  scheduledEndAt: timestampSchema.nullable(),
  timeZone: timeZoneSchema.nullable(),
  status: campaignSessionStatusDtoSchema,
  finishedAt: timestampSchema.nullable(),
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const createCampaignSessionInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    title: shortTextSchema.nullable().optional(),
    scheduledStartAt: timestampSchema.nullable().default(null),
    scheduledEndAt: timestampSchema.nullable().default(null),
    timeZone: timeZoneSchema.nullable().default(null)
  })
  .superRefine(validateCampaignSessionSchedule)
export const updateCampaignSessionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  title: shortTextSchema.nullable().optional(),
  scheduledStartAt: timestampSchema.nullable().optional(),
  scheduledEndAt: timestampSchema.nullable().optional(),
  timeZone: timeZoneSchema.nullable().optional(),
  expectedVersion: versionSchema
})
export const deleteCampaignSessionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
const campaignLivePlayCommandBaseSchema = z.strictObject({
  campaignId: uuidSchema,
  commandId: uuidSchema,
  expectedVersion: versionSchema
})
export const finishCampaignSessionInputSchema = campaignLivePlayCommandBaseSchema.extend({
  sessionId: uuidSchema
})
export const reopenCampaignSessionInputSchema = campaignLivePlayCommandBaseSchema.extend({
  sessionId: uuidSchema
})
export const getCampaignSessionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionNumber: z.number().int().positive()
})
export const campaignSessionAttendanceDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  characterId: uuidSchema,
  present: z.boolean()
})
export const campaignSessionRsvpDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  userId: uuidSchema,
  response: z.enum(['YES', 'NO', 'MAYBE']),
  updatedAt: timestampSchema
})
export const campaignSessionRsvpDtoListSchema = z.array(campaignSessionRsvpDtoSchema)
export const listCampaignSessionRsvpsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const setCampaignSessionRsvpInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  response: z.enum(['YES', 'NO', 'MAYBE'])
})
const campaignSessionReferencePinTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CAMPAIGN_NOTE'), noteSectionId: uuidSchema }),
  z.strictObject({
    kind: z.literal('AUTHORED_ROUTE'),
    routeSubjectKind: authoredSubjectKindDtoSchema,
    publicId: z.string().trim().min(1).max(120)
  })
])
export const campaignSessionReferencePinDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  target: campaignSessionReferencePinTargetSchema,
  label: shortTextSchema,
  createdAt: timestampSchema
})
export const campaignSessionReferencePinsDtoSchema = z.array(campaignSessionReferencePinDtoSchema)
export const createCampaignSessionReferencePinInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  target: campaignSessionReferencePinTargetSchema
})
export const deleteCampaignSessionReferencePinInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  pinId: uuidSchema
})
export const listCampaignSessionReferencePinsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const campaignSessionAttendanceDtoListSchema = z.array(campaignSessionAttendanceDtoSchema)
export const listCampaignSessionAttendanceInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const setCampaignSessionAttendanceInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  characterId: uuidSchema,
  present: z.boolean(),
  expectedVersion: versionSchema
})
export const campaignClockDtoSchema = z.strictObject({
  campaignId: uuidSchema,
  day: z.number().int().min(1),
  minuteOfDay: z.number().int().min(0).max(1439),
  running: z.boolean(),
  runningSince: timestampSchema.nullable(),
  dawnMinute: z.number().int().min(0).max(1439),
  duskMinute: z.number().int().min(0).max(1439),
  processedBoundaryAbsoluteMinute: z.number().int(),
  version: versionSchema,
  updatedAt: timestampSchema
})
export const initializeCampaignClockInputSchema = campaignLivePlayCommandBaseSchema.extend({
  day: z.number().int().min(1),
  minuteOfDay: z.number().int().min(0).max(1439),
  dawnMinute: z.number().int().min(0).max(1439),
  duskMinute: z.number().int().min(0).max(1439)
})
export const configureCampaignClockInputSchema = campaignLivePlayCommandBaseSchema.extend({
  day: z.number().int().min(1).optional(),
  minuteOfDay: z.number().int().min(0).max(1439).optional(),
  dawnMinute: z.number().int().min(0).max(1439).optional(),
  duskMinute: z.number().int().min(0).max(1439).optional()
})
export const startCampaignClockInputSchema = campaignLivePlayCommandBaseSchema
export const pauseCampaignClockInputSchema = campaignLivePlayCommandBaseSchema
export const advanceCampaignClockInputSchema = campaignLivePlayCommandBaseSchema.extend({
  minutes: z.number().int().positive()
})
export const rewindCampaignClockInputSchema = campaignLivePlayCommandBaseSchema.extend({
  minutes: z.number().int().positive(),
  correctionReason: z.string().trim().min(1).max(500)
})
export const reconcileCampaignClockInputSchema = campaignLivePlayCommandBaseSchema
export const campaignSessionNoteSectionDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  authorUserId: uuidSchema,
  title: shortTextSchema,
  content: authoredRichTextSchema,
  visibility: z.enum(['SHARED', 'GM_PRIVATE']),
  kind: z.enum([
    'SHARED_NOTE',
    'AGENDA',
    'SCENE',
    'SECRET',
    'REWARD',
    'SCRATCHPAD',
    'RECAP',
    'ENDING_STATE',
    'CANON',
    'RULING',
    'FOLLOW_UP'
  ]),
  sortOrder: z.number().int().nonnegative(),
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
function validateCampaignSessionNoteAccess(
  value: { visibility: 'SHARED' | 'GM_PRIVATE'; kind: string },
  context: z.RefinementCtx
): void {
  if ((value.kind === 'SHARED_NOTE') !== (value.visibility === 'SHARED')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Shared notes must be shared; all other Session section kinds are GM-private.'
    })
  }
}
export const createCampaignSessionNoteSectionInputSchema = z
  .strictObject({
    campaignId: uuidSchema,
    sessionId: uuidSchema,
    title: shortTextSchema,
    content: authoredRichTextSchema,
    visibility: z.enum(['SHARED', 'GM_PRIVATE']),
    kind: z.enum([
      'SHARED_NOTE',
      'AGENDA',
      'SCENE',
      'SECRET',
      'REWARD',
      'SCRATCHPAD',
      'RECAP',
      'ENDING_STATE',
      'CANON',
      'RULING',
      'FOLLOW_UP'
    ]),
    sortOrder: z.number().int().nonnegative().optional()
  })
  .superRefine(validateCampaignSessionNoteAccess)
export const updateCampaignSessionNoteSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  sectionId: uuidSchema,
  title: shortTextSchema.optional(),
  content: authoredRichTextSchema.optional(),
  visibility: z.enum(['SHARED', 'GM_PRIVATE']).optional(),
  kind: z
    .enum([
      'SHARED_NOTE',
      'AGENDA',
      'SCENE',
      'SECRET',
      'REWARD',
      'SCRATCHPAD',
      'RECAP',
      'ENDING_STATE',
      'CANON',
      'RULING',
      'FOLLOW_UP'
    ])
    .optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  expectedVersion: versionSchema
})
export const deleteCampaignSessionNoteSectionInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema,
  sectionId: uuidSchema
})
export const listCampaignNotebookSectionsInputSchema = z.strictObject({ campaignId: uuidSchema })
export const listCampaignSessionsInputSchema = z.strictObject({ campaignId: uuidSchema })
export const listCampaignSessionNoteSectionsInputSchema = z.strictObject({
  campaignId: uuidSchema,
  sessionId: uuidSchema
})
export const campaignNotebookSectionsDtoSchema = z.array(campaignNotebookSectionDtoSchema)
export const campaignSessionsDtoSchema = z.array(campaignSessionDtoSchema)
export const campaignSessionNoteSectionsDtoSchema = z.array(campaignSessionNoteSectionDtoSchema)

export type EntitlementTierDto = z.infer<typeof entitlementTierDtoSchema>
export type EntitlementLimitDto = z.infer<typeof entitlementLimitDtoSchema>
export type EntitlementUsageDto = z.infer<typeof entitlementUsageDtoSchema>
export type EntitlementPricingDto = z.infer<typeof entitlementPricingDtoSchema>
export type EntitlementProjectionDto = z.infer<typeof entitlementProjectionDtoSchema>
export type CampaignSummaryDto = z.infer<typeof campaignSummaryDtoSchema>
export type CampaignDetailDto = z.infer<typeof campaignDetailDtoSchema>
export type CreateCampaignInput = z.input<typeof createCampaignInputSchema>
export type CampaignPublicIdInput = z.input<typeof campaignPublicIdInputSchema>
export type UpdateCampaignInput = z.input<typeof updateCampaignInputSchema>
export type CampaignInviteDto = z.infer<typeof campaignInviteDtoSchema>
export type CreateCampaignInviteInput = z.input<typeof createCampaignInviteInputSchema>
export type CampaignContentBindingDto = z.infer<typeof campaignContentBindingDtoSchema>
export type CampaignContentBindingsDto = z.infer<typeof campaignContentBindingsDtoSchema>
export type CampaignCharacterBindingSummaryDto = z.infer<
  typeof campaignCharacterBindingSummaryDtoSchema
>
export type SubmitCampaignContentVersionInput = z.input<
  typeof submitCampaignContentVersionInputSchema
>
export type ReviewCampaignContentVersionInput = z.input<
  typeof reviewCampaignContentVersionInputSchema
>
export type CurrencySystemDto = z.infer<typeof currencySystemDtoSchema>
export type SaveCampaignCurrencySystemInput = z.input<typeof saveCampaignCurrencySystemInputSchema>
export type InventoryOwnerRefDto = z.infer<typeof inventoryOwnerRefDtoSchema>
export type InventoryDto = z.infer<typeof inventoryDtoSchema>
export type TransferCampaignInventoryInput = z.input<typeof transferCampaignInventoryInputSchema>
export type CampaignInventoryTransferResultDto = z.infer<
  typeof campaignInventoryTransferResultDtoSchema
>
export type CampaignPartyInventoryMutationInput = z.input<
  typeof campaignPartyInventoryMutationInputSchema
>
export type ListCampaignInventoryAuditInput = z.input<typeof listCampaignInventoryAuditInputSchema>
export type CampaignInventoryAuditEventDto = z.infer<typeof campaignInventoryAuditEventDtoSchema>
export type CampaignInventoryAuditPageDto = z.infer<typeof campaignInventoryAuditPageDtoSchema>
export type CampaignAdjustmentInput = z.input<typeof campaignAdjustmentInputSchema>
export type CampaignAdjustmentDto = z.infer<typeof campaignAdjustmentDtoSchema>
export type CampaignConditionDto = z.infer<typeof campaignConditionDtoSchema>
export type SaveCampaignConditionInput = z.input<typeof saveCampaignConditionInputSchema>
export type DeleteCampaignConditionInput = z.input<typeof deleteCampaignConditionInputSchema>
export type CampaignEventDto = z.infer<typeof campaignEventDtoSchema>
export type CampaignEventPageDto = z.infer<typeof campaignEventPageDtoSchema>
export type CampaignRealtimeEnvelopeDto = z.infer<typeof campaignRealtimeEnvelopeDtoSchema>
export type CampaignConversationDto = z.infer<typeof campaignConversationDtoSchema>
export type CampaignChatEntryDto = z.infer<typeof campaignChatEntryDtoSchema>
export type SendCampaignChatEntryInput = z.input<typeof sendCampaignChatEntryInputSchema>
export type ExecuteCampaignRollInput = z.input<typeof executeCampaignRollInputSchema>
export type ExecuteCampaignPrivateRollInput = z.input<typeof executeCampaignPrivateRollInputSchema>
export type CampaignChatPageDto = z.infer<typeof campaignChatPageDtoSchema>
export type CampaignNotebookSectionDto = z.infer<typeof campaignNotebookSectionDtoSchema>
export type CampaignSessionDto = z.infer<typeof campaignSessionDtoSchema>
export type CampaignSessionStatusDto = z.infer<typeof campaignSessionStatusDtoSchema>
export type FinishCampaignSessionInput = z.input<typeof finishCampaignSessionInputSchema>
export type ReopenCampaignSessionInput = z.input<typeof reopenCampaignSessionInputSchema>
export type GetCampaignSessionInput = z.input<typeof getCampaignSessionInputSchema>
export type CampaignSessionAttendanceDto = z.infer<typeof campaignSessionAttendanceDtoSchema>
export type CampaignSessionRsvpDto = z.infer<typeof campaignSessionRsvpDtoSchema>
export type SetCampaignSessionRsvpInput = z.input<typeof setCampaignSessionRsvpInputSchema>
export type CampaignSessionReferencePinDto = z.infer<typeof campaignSessionReferencePinDtoSchema>
export type SetCampaignSessionAttendanceInput = z.input<
  typeof setCampaignSessionAttendanceInputSchema
>
export type CampaignClockDto = z.infer<typeof campaignClockDtoSchema>
export type InitializeCampaignClockInput = z.input<typeof initializeCampaignClockInputSchema>
export type ConfigureCampaignClockInput = z.input<typeof configureCampaignClockInputSchema>
export type StartCampaignClockInput = z.input<typeof startCampaignClockInputSchema>
export type PauseCampaignClockInput = z.input<typeof pauseCampaignClockInputSchema>
export type AdvanceCampaignClockInput = z.input<typeof advanceCampaignClockInputSchema>
export type RewindCampaignClockInput = z.input<typeof rewindCampaignClockInputSchema>
export type ReconcileCampaignClockInput = z.input<typeof reconcileCampaignClockInputSchema>
export type CampaignSessionNoteSectionDto = z.infer<typeof campaignSessionNoteSectionDtoSchema>
