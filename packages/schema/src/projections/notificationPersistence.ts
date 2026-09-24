import { z } from '../zod.js'
import {
  notificationIntentDataSchema,
  notificationSourceKindSchema,
  notificationWorkflowKeySchema
} from '../api/notifications.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'

export const notificationEnqueueInputSchema = z.strictObject({
  recipientUserId: uuidSchema,
  data: notificationIntentDataSchema
})

export const notificationCancellationInputSchema = z.strictObject({
  recipientUserId: uuidSchema,
  workflowKey: notificationWorkflowKeySchema,
  sourcePublicId: uuidSchema,
  occurredAt: timestampSchema
})

export const notificationStoredIntentSchema = z
  .strictObject({
    id: uuidSchema,
    recipientUserId: uuidSchema,
    workflowKey: notificationWorkflowKeySchema,
    sourceKind: notificationSourceKindSchema,
    sourcePublicId: uuidSchema,
    groupingKey: z.nullable(z.string().check(z.minLength(1)).check(z.maxLength(200))),
    data: z.nullable(notificationIntentDataSchema),
    occurredAt: timestampSchema,
    status: z.enum(['PENDING', 'DISPATCHED', 'CANCELLED', 'FAILED']),
    attemptCount: z.number().check(z.int()).check(z.gte(0)).check(z.lte(10)),
    nextAttemptAt: timestampSchema,
    feedRecorded: z.boolean(),
    providerEmailId: z.nullable(z.string().check(z.minLength(1))),
    dispatchedAt: z.nullable(timestampSchema),
    cancelledAt: z.nullable(timestampSchema),
    lastErrorCode: z.nullable(
      z.enum(['INVALID_PAYLOAD', 'DELIVERY_ERROR', 'ATTEMPTS_EXHAUSTED', 'RECIPIENT_UNAVAILABLE'])
    )
  })
  .check(
    z.superRefine((intent, context) => {
      const data = intent.data
      if (!data) {
        if (intent.status !== 'CANCELLED' && intent.status !== 'FAILED')
          context.addIssue({
            code: 'custom',
            message: 'Pending or dispatched notifications require data.'
          })
        return
      }
      const sourceKind =
        data.kind === 'CAMPAIGN_ANNOUNCEMENT'
          ? 'CAMPAIGN_ANNOUNCEMENT'
          : data.kind.startsWith('SOCIAL_APPLICATION')
            ? 'SOCIAL_APPLICATION'
            : 'CAMPAIGN_INVITE'
      const sourceId =
        data.kind === 'CAMPAIGN_ANNOUNCEMENT' ? data.announcementPublicId : data.sourcePublicId
      if (
        intent.workflowKey !== data.kind.toLowerCase().replaceAll('_', '-') ||
        intent.sourceKind !== sourceKind ||
        intent.sourcePublicId !== sourceId ||
        intent.occurredAt !== data.occurredAt ||
        intent.groupingKey !==
          (data.kind === 'SOCIAL_APPLICATION_SUBMITTED' ? data.listingPublicId : null)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Notification source metadata does not match its payload.'
        })
      }
    })
  )

export type NotificationEnqueueInput = z.infer<typeof notificationEnqueueInputSchema>
export type NotificationCancellationInput = z.infer<typeof notificationCancellationInputSchema>
