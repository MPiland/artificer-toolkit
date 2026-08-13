import { z } from 'zod'

import { timestampSchema, uuidSchema } from './campaignContractSchemas.js'

const listingTitleSchema = z.string().trim().min(1).max(100)
const usernameSchema = z.string().trim().min(3).max(30)

export const notificationWorkflowKeySchema = z.enum([
  'social-application-submitted',
  'social-application-decided',
  'social-invitation-received',
  'social-invitation-decided',
  'campaign-announcement'
])

export const notificationIntentOperationSchema = z.enum(['TRIGGER', 'CANCEL'])
export const notificationSourceKindSchema = z.enum([
  'SOCIAL_APPLICATION',
  'CAMPAIGN_INVITE',
  'CAMPAIGN_ANNOUNCEMENT'
])

const socialSourceSchema = z.strictObject({
  sourcePublicId: uuidSchema,
  listingPublicId: uuidSchema,
  listingTitle: listingTitleSchema,
  occurredAt: timestampSchema
})

export const socialApplicationSubmittedNotificationDataSchema = socialSourceSchema.extend({
  kind: z.literal('SOCIAL_APPLICATION_SUBMITTED'),
  applicantUsername: usernameSchema
})

export const socialApplicationDecidedNotificationDataSchema = socialSourceSchema.extend({
  kind: z.literal('SOCIAL_APPLICATION_DECIDED'),
  decision: z.enum(['ACCEPTED', 'DECLINED'])
})

export const socialInvitationReceivedNotificationDataSchema = socialSourceSchema.extend({
  kind: z.literal('SOCIAL_INVITATION_RECEIVED'),
  hostUsername: usernameSchema,
  expiresAt: timestampSchema
})

export const socialInvitationDecidedNotificationDataSchema = socialSourceSchema.extend({
  kind: z.literal('SOCIAL_INVITATION_DECIDED'),
  recipientUsername: usernameSchema,
  decision: z.enum(['ACCEPTED', 'DECLINED'])
})

export const campaignAnnouncementNotificationDataSchema = z.strictObject({
  kind: z.literal('CAMPAIGN_ANNOUNCEMENT'),
  announcementPublicId: uuidSchema,
  campaignPublicId: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(240),
  scope: z.enum(['TABLE', 'PARTY']),
  occurredAt: timestampSchema
})

export const notificationIntentDataSchema = z.discriminatedUnion('kind', [
  socialApplicationSubmittedNotificationDataSchema,
  socialApplicationDecidedNotificationDataSchema,
  socialInvitationReceivedNotificationDataSchema,
  socialInvitationDecidedNotificationDataSchema,
  campaignAnnouncementNotificationDataSchema
])

export const notificationCategorySchema = z.enum(['SOCIAL', 'CAMPAIGN'])

export const notificationFeedItemDtoSchema = z.strictObject({
  id: uuidSchema,
  workflowKey: notificationWorkflowKeySchema,
  sourceKind: notificationSourceKindSchema,
  sourcePublicId: uuidSchema,
  groupingKey: z.string().trim().min(1).max(200).nullable(),
  data: notificationIntentDataSchema,
  occurredAt: timestampSchema,
  seenAt: timestampSchema.nullable(),
  readAt: timestampSchema.nullable()
})

export const notificationFeedDtoSchema = z.strictObject({
  items: z.array(notificationFeedItemDtoSchema).max(25),
  unseenCount: z.number().int().nonnegative()
})

export const notificationFeedItemIdInputSchema = z.strictObject({
  id: uuidSchema
})

const notificationChannelPreferencesSchema = z.strictObject({
  inApp: z.boolean(),
  email: z.boolean()
})

export const notificationPreferencesDtoSchema = z.strictObject({
  social: notificationChannelPreferencesSchema,
  campaign: notificationChannelPreferencesSchema
})

export const updateNotificationPreferencesInputSchema = z.strictObject({
  category: notificationCategorySchema,
  inApp: z.boolean(),
  email: z.boolean()
})

export type NotificationWorkflowKey = z.infer<typeof notificationWorkflowKeySchema>
export type NotificationIntentOperation = z.infer<typeof notificationIntentOperationSchema>
export type NotificationSourceKind = z.infer<typeof notificationSourceKindSchema>
export type NotificationIntentData = z.infer<typeof notificationIntentDataSchema>
export type NotificationCategory = z.infer<typeof notificationCategorySchema>
export type NotificationFeedItemDto = z.infer<typeof notificationFeedItemDtoSchema>
export type NotificationFeedDto = z.infer<typeof notificationFeedDtoSchema>
export type NotificationFeedItemIdInput = z.infer<typeof notificationFeedItemIdInputSchema>
export type NotificationPreferencesDto = z.infer<typeof notificationPreferencesDtoSchema>
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesInputSchema
>
