import type {
  NotificationIntentData,
  NotificationWorkflowKey
} from '@artificer-toolkit/schema/api/notifications'

export type SocialEmailContent = {
  actionLabel: string
  actionUrl: string
  body: string
  preferencesUrl: string
  preview: string
  subject: string
  title: string
}

export type SocialNotificationEmailInput = {
  activityCount?: number
  appUrl: string
  data: NotificationIntentData
  workflowKey: NotificationWorkflowKey
}

export function getSocialEmailContent({
  activityCount,
  appUrl,
  data,
  workflowKey
}: SocialNotificationEmailInput): SocialEmailContent {
  const preferencesUrl = socialUrl(appUrl, '/settings/preferences')

  switch (workflowKey) {
    case 'campaign-announcement': {
      if (data.kind !== 'CAMPAIGN_ANNOUNCEMENT') invalidWorkflowData(workflowKey, data.kind)
      return {
        subject: 'New Campaign announcement',
        preview: data.summary,
        title: 'New Campaign announcement',
        body: data.summary,
        preferencesUrl,
        actionLabel: 'View announcement',
        actionUrl: socialUrl(
          appUrl,
          `/campaigns/${encodeURIComponent(data.campaignPublicId)}?tab=announcements&announcementPublicId=${encodeURIComponent(data.announcementPublicId)}`
        )
      }
    }
    case 'social-application-submitted': {
      if (data.kind !== 'SOCIAL_APPLICATION_SUBMITTED') invalidWorkflowData(workflowKey, data.kind)
      const count = Math.max(1, activityCount ?? 1)
      const isBatch = count > 1

      return {
        subject: isBatch
          ? `${count} new applications for ${data.listingTitle}`
          : `New application for ${data.listingTitle}`,
        preview: isBatch
          ? `Review ${count} new applications for ${data.listingTitle}.`
          : `Review the new application for ${data.listingTitle}.`,
        title: isBatch ? `${count} new applications received` : 'New application received',
        body: isBatch
          ? `You have ${count} new applications for ${data.listingTitle}.`
          : `@${data.applicantUsername} applied to join ${data.listingTitle}.`,
        preferencesUrl,
        actionLabel: 'Review applications',
        actionUrl: socialUrl(
          appUrl,
          `/social/hosting/${data.listingPublicId}/edit?section=applications`
        )
      }
    }
    case 'social-application-decided': {
      if (data.kind !== 'SOCIAL_APPLICATION_DECIDED') invalidWorkflowData(workflowKey, data.kind)

      return {
        subject: `Your application was ${data.decision.toLowerCase()}`,
        preview: `The host responded to your application for ${data.listingTitle}.`,
        title: `Application ${data.decision.toLowerCase()}`,
        body: `Your application for ${data.listingTitle} was ${data.decision.toLowerCase()}.`,
        preferencesUrl,
        actionLabel: 'View application',
        actionUrl: socialUrl(
          appUrl,
          `/social?view=applications&applicationPublicId=${encodeURIComponent(data.sourcePublicId)}`
        )
      }
    }
    case 'social-invitation-received': {
      if (data.kind !== 'SOCIAL_INVITATION_RECEIVED') invalidWorkflowData(workflowKey, data.kind)

      return {
        subject: `Invitation to ${data.listingTitle}`,
        preview: `@${data.hostUsername} invited you to ${data.listingTitle}.`,
        title: `Invitation to ${data.listingTitle}`,
        body: `@${data.hostUsername} invited you to join ${data.listingTitle}.`,
        preferencesUrl,
        actionLabel: 'View invitation',
        actionUrl: socialUrl(
          appUrl,
          `/social?view=invitations&invitePublicId=${encodeURIComponent(data.sourcePublicId)}`
        )
      }
    }
    case 'social-invitation-decided': {
      if (data.kind !== 'SOCIAL_INVITATION_DECIDED') invalidWorkflowData(workflowKey, data.kind)

      return {
        subject: `@${data.recipientUsername} ${data.decision.toLowerCase()} your invitation`,
        preview: `@${data.recipientUsername} ${data.decision.toLowerCase()} your invitation to ${data.listingTitle}.`,
        title: `Invitation ${data.decision.toLowerCase()}`,
        body: `@${data.recipientUsername} ${data.decision.toLowerCase()} the invitation to ${data.listingTitle}.`,
        preferencesUrl,
        actionLabel: 'View invitation',
        actionUrl: socialUrl(
          appUrl,
          `/social/hosting/${data.listingPublicId}/edit?section=invitations&invitePublicId=${encodeURIComponent(data.sourcePublicId)}`
        )
      }
    }
  }
}

function socialUrl(appUrl: string, path: string): string {
  return new URL(path, appUrl).toString()
}

function invalidWorkflowData(
  workflowKey: NotificationWorkflowKey,
  kind: NotificationIntentData['kind']
): never {
  throw new Error(`Notification data ${kind} does not match workflow ${workflowKey}`)
}
