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

export const notificationSessionDtoSchema = z.strictObject({
  recipientId: uuidSchema,
  subscriberHash: z.string().regex(/^[a-f0-9]{64}$/),
  applicationIdentifier: z.string().trim().min(1).max(200)
})

export type NotificationWorkflowKey = z.infer<typeof notificationWorkflowKeySchema>
export type NotificationIntentOperation = z.infer<typeof notificationIntentOperationSchema>
export type NotificationSourceKind = z.infer<typeof notificationSourceKindSchema>
export type NotificationIntentData = z.infer<typeof notificationIntentDataSchema>
export type NotificationSessionDto = z.infer<typeof notificationSessionDtoSchema>
