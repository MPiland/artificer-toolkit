import {
  notificationIntentDataSchema,
  notificationWorkflowKeySchema,
  type NotificationWorkflowKey
} from '@artificer-toolkit/schema/api/notifications'
import type { Notification } from '@novu/react'
import { z } from 'zod'

const notificationIdentitySchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  isRead: z.boolean(),
  workflow: z.object({ identifier: notificationWorkflowKeySchema }).optional()
})

const notificationProviderDataSchema = z
  .object({ activityCount: z.number().int().positive().optional() })
  .passthrough()

const workflowByDataKind = {
  SOCIAL_APPLICATION_SUBMITTED: 'social-application-submitted',
  SOCIAL_APPLICATION_DECIDED: 'social-application-decided',
  SOCIAL_INVITATION_RECEIVED: 'social-invitation-received',
  SOCIAL_INVITATION_DECIDED: 'social-invitation-decided',
  CAMPAIGN_ANNOUNCEMENT: 'campaign-announcement'
} as const satisfies Record<string, NotificationWorkflowKey>

export type NotificationDestination =
  | { kind: 'HOST_APPLICATIONS'; listingPublicId: string }
  | { kind: 'MY_APPLICATION'; applicationPublicId: string }
  | { kind: 'MY_INVITATION'; invitePublicId: string }
  | { kind: 'HOST_INVITATION'; invitePublicId: string; listingPublicId: string }
  | {
      kind: 'CAMPAIGN_ANNOUNCEMENT'
      announcementPublicId: string
      campaignPublicId: string
    }

export interface NotificationViewModel {
  body: string
  destination?: NotificationDestination
  id: string
  insertedAt: string
  isRead: boolean
  title: string
}

export interface NotificationFeedViewProps {
  contained?: boolean
  isError?: boolean
  isLoading?: boolean
  items: readonly NotificationViewModel[]
  onExplore?: () => void
  onOpen?: (id: string, destination: NotificationDestination) => void
  onRetry?: () => void
}

export const notificationHistoryLimit = 25

type NovuNotification = Pick<Notification, 'createdAt' | 'id' | 'isRead'> & {
  data?: Record<string, unknown>
  workflow?: { identifier: string }
}

export function formatNotificationTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

export function notificationBellLabel(newCount: number) {
  return newCount === 0 ? 'Notifications' : 'Notifications, ' + newCount + ' new'
}

export function notificationBadge(newCount: number) {
  return newCount > 99 ? '99+' : String(newCount)
}

export function toNotificationViewModel(input: NovuNotification): NotificationViewModel {
  const identity = notificationIdentitySchema.safeParse(input)
  const providerData = notificationProviderDataSchema.safeParse(input.data)
  if (!providerData.success) return malformedNotification(input)
  const { activityCount, ...intentData } = providerData.data
  const data = notificationIntentDataSchema.safeParse(intentData)
  if (
    !identity.success ||
    !data.success ||
    (identity.data.workflow &&
      workflowByDataKind[data.data.kind] !== identity.data.workflow.identifier) ||
    (activityCount !== undefined && data.data.kind !== 'SOCIAL_APPLICATION_SUBMITTED')
  ) {
    return malformedNotification(input)
  }

  const base = {
    id: identity.data.id,
    insertedAt: identity.data.createdAt,
    isRead: identity.data.isRead
  }

  switch (data.data.kind) {
    case 'SOCIAL_APPLICATION_SUBMITTED':
      return {
        ...base,
        title:
          activityCount && activityCount > 1
            ? activityCount + ' new applications for ' + data.data.listingTitle
            : 'New application for ' + data.data.listingTitle,
        body:
          activityCount && activityCount > 1
            ? 'Review ' + activityCount + ' new applicants.'
            : 'Review the latest applicant.',
        destination: {
          kind: 'HOST_APPLICATIONS',
          listingPublicId: data.data.listingPublicId
        }
      }
    case 'SOCIAL_APPLICATION_DECIDED':
      return {
        ...base,
        title: 'Application ' + data.data.decision.toLowerCase(),
        body:
          'Your application for ' +
          data.data.listingTitle +
          ' was ' +
          data.data.decision.toLowerCase() +
          '.',
        destination: {
          kind: 'MY_APPLICATION',
          applicationPublicId: data.data.sourcePublicId
        }
      }
    case 'SOCIAL_INVITATION_RECEIVED':
      return {
        ...base,
        title: 'Invitation from @' + data.data.hostUsername,
        body: 'You were invited to ' + data.data.listingTitle + '.',
        destination: {
          kind: 'MY_INVITATION',
          invitePublicId: data.data.sourcePublicId
        }
      }
    case 'SOCIAL_INVITATION_DECIDED':
      return {
        ...base,
        title: 'Invitation ' + data.data.decision.toLowerCase(),
        body:
          '@' +
          data.data.recipientUsername +
          ' ' +
          data.data.decision.toLowerCase() +
          ' the invitation to ' +
          data.data.listingTitle +
          '.',
        destination: {
          kind: 'HOST_INVITATION',
          invitePublicId: data.data.sourcePublicId,
          listingPublicId: data.data.listingPublicId
        }
      }
    case 'CAMPAIGN_ANNOUNCEMENT':
      return {
        ...base,
        title: 'Campaign announcement',
        body: data.data.summary,
        destination: {
          kind: 'CAMPAIGN_ANNOUNCEMENT',
          announcementPublicId: data.data.announcementPublicId,
          campaignPublicId: data.data.campaignPublicId
        }
      }
  }
}

function malformedNotification(input: unknown): NotificationViewModel {
  const identity = z
    .object({
      createdAt: z.string().datetime(),
      id: z.string().min(1),
      isRead: z.boolean()
    })
    .safeParse(input)

  return {
    id: identity.success ? identity.data.id : 'unavailable-notification',
    insertedAt: identity.success ? identity.data.createdAt : new Date(0).toISOString(),
    isRead: identity.success && identity.data.isRead,
    title: 'Notification unavailable',
    body: 'This notification can no longer be displayed.'
  }
}
