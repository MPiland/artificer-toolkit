import { notificationIntentDataSchema } from '@artificer-toolkit/schema/api/notifications'
import { z } from 'zod'

const notificationIdentitySchema = z.object({
  id: z.string().min(1),
  occurredAt: z.string().datetime(),
  readAt: z.string().datetime().nullable()
})

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

interface NotificationViewModel {
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

export function toNotificationViewModel(input: unknown): NotificationViewModel {
  const identity = notificationIdentitySchema.safeParse(input)
  const data = notificationIntentDataSchema.safeParse(
    typeof input === 'object' && input !== null && 'data' in input ? input.data : undefined
  )
  if (!identity.success || !data.success) {
    return malformedNotification(input)
  }

  const base = {
    id: identity.data.id,
    insertedAt: identity.data.occurredAt,
    isRead: identity.data.readAt !== null
  }

  switch (data.data.kind) {
    case 'SOCIAL_APPLICATION_SUBMITTED':
      return {
        ...base,
        title: 'New application for ' + data.data.listingTitle,
        body: 'Review the latest applicant.',
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
      occurredAt: z.string().datetime(),
      id: z.string().min(1),
      readAt: z.string().datetime().nullable()
    })
    .safeParse(input)

  return {
    id: identity.success ? identity.data.id : 'unavailable-notification',
    insertedAt: identity.success ? identity.data.occurredAt : new Date(0).toISOString(),
    isRead: identity.success && identity.data.readAt !== null,
    title: 'Notification unavailable',
    body: 'This notification can no longer be displayed.'
  }
}
