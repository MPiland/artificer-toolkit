export type NotificationWorkflowKey =
  | 'social-application-submitted'
  | 'social-application-decided'
  | 'social-invitation-received'
  | 'social-invitation-decided'
  | 'campaign-announcement'

export type NotificationIntentOperation = 'TRIGGER' | 'CANCEL'

export type NotificationIntentPayload =
  | {
      kind: 'SOCIAL_APPLICATION_SUBMITTED'
      sourcePublicId: string
      listingPublicId: string
      listingTitle: string
      applicantUsername: string
      occurredAt: string
    }
  | {
      kind: 'SOCIAL_APPLICATION_DECIDED'
      sourcePublicId: string
      listingPublicId: string
      listingTitle: string
      decision: 'ACCEPTED' | 'DECLINED'
      occurredAt: string
    }
  | {
      kind: 'SOCIAL_INVITATION_RECEIVED'
      sourcePublicId: string
      listingPublicId: string
      listingTitle: string
      hostUsername: string
      expiresAt: string
      occurredAt: string
    }
  | {
      kind: 'SOCIAL_INVITATION_DECIDED'
      sourcePublicId: string
      listingPublicId: string
      listingTitle: string
      recipientUsername: string
      decision: 'ACCEPTED' | 'DECLINED'
      occurredAt: string
    }
  | {
      kind: 'CAMPAIGN_ANNOUNCEMENT'
      announcementPublicId: string
      campaignPublicId: string
      summary: string
      scope: 'TABLE' | 'PARTY'
      occurredAt: string
    }

export type ClaimedNotificationIntent = {
  id: string
  operation: NotificationIntentOperation
  workflow_key: NotificationWorkflowKey
  source_kind: string
  source_public_id: string
  recipient_notification_id: string
  recipient_user_id: string
  grouping_key: string | null
  payload: unknown
  attempt_count: number
  recipient_email: string | null
  recipient_username: string | null
  in_app_enabled: boolean
  email_enabled: boolean
}

export type NotificationEmail = {
  html: string
  subject: string
}
