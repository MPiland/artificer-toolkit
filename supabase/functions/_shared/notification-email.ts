import type {
  NotificationEmail,
  NotificationIntentPayload,
  NotificationWorkflowKey
} from './notification-types.ts'

type EmailContent = NotificationEmail & {
  actionLabel: string
  actionUrl: string
  body: string
}

function appUrl(path: string): string {
  return new URL(path, requiredEnvironment('APP_URL')).toString()
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function contentFor(
  workflowKey: NotificationWorkflowKey,
  payload: NotificationIntentPayload
): EmailContent | null {
  switch (workflowKey) {
    case 'campaign-announcement':
      if (payload.kind !== 'CAMPAIGN_ANNOUNCEMENT') return null
      return {
        subject: 'New Campaign announcement',
        body: payload.summary,
        actionLabel: 'View announcement',
        actionUrl: appUrl(
          `/campaigns/${payload.campaignPublicId}/announcements/${payload.announcementPublicId}`
        ),
        html: ''
      }
    case 'social-application-submitted':
      if (payload.kind !== 'SOCIAL_APPLICATION_SUBMITTED') return null
      return {
        subject: `New application for ${payload.listingTitle}`,
        body: `@${payload.applicantUsername} applied to join ${payload.listingTitle}.`,
        actionLabel: 'Review applications',
        actionUrl: appUrl(`/social/hosting/${payload.listingPublicId}/edit?section=applications`),
        html: ''
      }
    case 'social-application-decided':
      if (payload.kind !== 'SOCIAL_APPLICATION_DECIDED') return null
      return {
        subject: `Your application was ${payload.decision.toLowerCase()}`,
        body: `Your application for ${payload.listingTitle} was ${payload.decision.toLowerCase()}.`,
        actionLabel: 'View application',
        actionUrl: appUrl(
          `/social?view=applications&applicationPublicId=${encodeURIComponent(payload.sourcePublicId)}`
        ),
        html: ''
      }
    case 'social-invitation-received':
      if (payload.kind !== 'SOCIAL_INVITATION_RECEIVED') return null
      return {
        subject: `Invitation to ${payload.listingTitle}`,
        body: `@${payload.hostUsername} invited you to ${payload.listingTitle}.`,
        actionLabel: 'View invitation',
        actionUrl: appUrl(
          `/social?view=invitations&invitePublicId=${encodeURIComponent(payload.sourcePublicId)}`
        ),
        html: ''
      }
    case 'social-invitation-decided':
      if (payload.kind !== 'SOCIAL_INVITATION_DECIDED') return null
      return {
        subject: `@${payload.recipientUsername} ${payload.decision.toLowerCase()} your invitation`,
        body: `@${payload.recipientUsername} ${payload.decision.toLowerCase()} the invitation to ${payload.listingTitle}.`,
        actionLabel: 'View invitation',
        actionUrl: appUrl(
          `/social/hosting/${payload.listingPublicId}/edit?section=invitations&invitePublicId=${encodeURIComponent(payload.sourcePublicId)}`
        ),
        html: ''
      }
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!
  )
}

export function renderNotificationEmail(
  workflowKey: NotificationWorkflowKey,
  payload: NotificationIntentPayload
): NotificationEmail | null {
  const content = contentFor(workflowKey, payload)
  if (!content) return null
  const preferencesUrl = appUrl('/settings/preferences')
  return {
    subject: content.subject,
    html: `<!doctype html><html lang="en"><body style="margin:0;padding:32px 12px;background:#f7f9fb;color:#151b20;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><main style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #d7dbe4;border-radius:12px;overflow:hidden"><header style="padding:24px;background:#ec8c06;color:#241002;font-size:24px;font-weight:700">Artificer Toolkit</header><section style="padding:28px 24px"><h1 style="margin:0 0 16px;font-size:24px">${escapeHtml(content.subject)}</h1><p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escapeHtml(content.body)}</p><a href="${escapeHtml(content.actionUrl)}" style="display:inline-block;padding:14px 20px;border-radius:8px;background:#ec8c06;color:#241002;text-decoration:none;font-weight:700">${escapeHtml(content.actionLabel)}</a></section><footer style="padding:16px 24px;border-top:1px solid #d7dbe4;color:#55626d;font-size:13px">Artificer Toolkit · <a href="${escapeHtml(preferencesUrl)}" style="color:#55626d">Manage notification preferences</a></footer></main></body></html>`
  }
}
