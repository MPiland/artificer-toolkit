import { renderSocialNotificationEmail } from '@artificer-toolkit/emails'
import type { NotificationIntentData } from '@artificer-toolkit/schema/api/notifications'
import { workflow } from '@novu/framework'

const socialEmailFrom = {
  email: 'notifications@artificertoolkit.app',
  name: 'Artificer Toolkit Notifications'
} as const

// Novu's `Schema` type does not accept Zod 4's generated JSON-schema union
// (its optional oneOf member is wider than the SDK type), so keep this
// provider schema aligned with the canonical safe payload fields explicitly.
const socialApplicationSubmittedPayloadSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['SOCIAL_APPLICATION_SUBMITTED'] },
    sourcePublicId: { type: 'string', format: 'uuid' },
    listingPublicId: { type: 'string', format: 'uuid' },
    listingTitle: { type: 'string', minLength: 1, maxLength: 100 },
    applicantUsername: { type: 'string', minLength: 3, maxLength: 30 },
    occurredAt: { type: 'string', format: 'date-time' }
  },
  required: [
    'kind',
    'sourcePublicId',
    'listingPublicId',
    'listingTitle',
    'applicantUsername',
    'occurredAt'
  ],
  additionalProperties: false
} as const

const socialApplicationDecidedPayloadSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['SOCIAL_APPLICATION_DECIDED'] },
    sourcePublicId: { type: 'string', format: 'uuid' },
    listingPublicId: { type: 'string', format: 'uuid' },
    listingTitle: { type: 'string', minLength: 1, maxLength: 100 },
    decision: { type: 'string', enum: ['ACCEPTED', 'DECLINED'] },
    occurredAt: { type: 'string', format: 'date-time' }
  },
  required: ['kind', 'sourcePublicId', 'listingPublicId', 'listingTitle', 'decision', 'occurredAt'],
  additionalProperties: false
} as const

const socialInvitationReceivedPayloadSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['SOCIAL_INVITATION_RECEIVED'] },
    sourcePublicId: { type: 'string', format: 'uuid' },
    listingPublicId: { type: 'string', format: 'uuid' },
    listingTitle: { type: 'string', minLength: 1, maxLength: 100 },
    hostUsername: { type: 'string', minLength: 3, maxLength: 30 },
    expiresAt: { type: 'string', format: 'date-time' },
    occurredAt: { type: 'string', format: 'date-time' }
  },
  required: [
    'kind',
    'sourcePublicId',
    'listingPublicId',
    'listingTitle',
    'hostUsername',
    'expiresAt',
    'occurredAt'
  ],
  additionalProperties: false
} as const

const socialInvitationDecidedPayloadSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['SOCIAL_INVITATION_DECIDED'] },
    sourcePublicId: { type: 'string', format: 'uuid' },
    listingPublicId: { type: 'string', format: 'uuid' },
    listingTitle: { type: 'string', minLength: 1, maxLength: 100 },
    recipientUsername: { type: 'string', minLength: 3, maxLength: 30 },
    decision: { type: 'string', enum: ['ACCEPTED', 'DECLINED'] },
    occurredAt: { type: 'string', format: 'date-time' }
  },
  required: [
    'kind',
    'sourcePublicId',
    'listingPublicId',
    'listingTitle',
    'recipientUsername',
    'decision',
    'occurredAt'
  ],
  additionalProperties: false
} as const

function siteUrl(): string {
  const value = process.env.SITE_URL
  if (!value) throw new Error('SITE_URL is required to render notification email content.')
  return value
}

function emailInput(workflowKey: NotificationIntentData['kind'], data: NotificationIntentData) {
  const workflowByKind = {
    SOCIAL_APPLICATION_SUBMITTED: 'social-application-submitted',
    SOCIAL_APPLICATION_DECIDED: 'social-application-decided',
    SOCIAL_INVITATION_RECEIVED: 'social-invitation-received',
    SOCIAL_INVITATION_DECIDED: 'social-invitation-decided'
  } as const

  return {
    workflowKey: workflowByKind[workflowKey],
    data,
    appUrl: siteUrl()
  }
}

export const socialApplicationSubmittedWorkflow = workflow(
  'social-application-submitted',
  async ({ payload, step }) => {
    const digest = await step.digest('listing-digest', async () => ({
      type: 'regular' as const,
      amount: 5,
      unit: 'minutes' as const,
      digestKey: payload.listingPublicId
    }))
    const activityCount = Math.max(1, digest.events?.length ?? 0)

    await step.inApp('application-submitted-in-app', async () => ({
      subject:
        activityCount === 1
          ? `New application for ${payload.listingTitle}`
          : `${activityCount} new applications for ${payload.listingTitle}`,
      body:
        activityCount === 1
          ? `@${payload.applicantUsername} applied to join ${payload.listingTitle}.`
          : 'Review the new applications.',
      data: { ...payload, activityCount }
    }))

    await step.email('application-submitted-email', async () => {
      const rendered = await renderSocialNotificationEmail({
        ...emailInput(payload.kind, payload),
        activityCount
      })
      return { subject: rendered.subject, body: rendered.html, from: socialEmailFrom }
    })
  },
  { payloadSchema: socialApplicationSubmittedPayloadSchema, tags: ['social'] }
)

export const socialApplicationDecidedWorkflow = workflow(
  'social-application-decided',
  async ({ payload, step }) => {
    await step.inApp('application-decided-in-app', async () => ({
      subject: `Application ${payload.decision.toLowerCase()}`,
      body: `Your application for ${payload.listingTitle} was ${payload.decision.toLowerCase()}.`,
      data: payload
    }))

    await step.email('application-decided-email', async () => {
      const rendered = await renderSocialNotificationEmail(emailInput(payload.kind, payload))
      return { subject: rendered.subject, body: rendered.html, from: socialEmailFrom }
    })
  },
  { payloadSchema: socialApplicationDecidedPayloadSchema, tags: ['social'] }
)

export const socialInvitationReceivedWorkflow = workflow(
  'social-invitation-received',
  async ({ payload, step }) => {
    await step.inApp('invitation-received-in-app', async () => ({
      subject: `Invitation to ${payload.listingTitle}`,
      body: `@${payload.hostUsername} invited you to join.`,
      data: payload
    }))

    await step.email('invitation-received-email', async () => {
      const rendered = await renderSocialNotificationEmail(emailInput(payload.kind, payload))
      return { subject: rendered.subject, body: rendered.html, from: socialEmailFrom }
    })
  },
  { payloadSchema: socialInvitationReceivedPayloadSchema, tags: ['social'] }
)

export const socialInvitationDecidedWorkflow = workflow(
  'social-invitation-decided',
  async ({ payload, step }) => {
    await step.inApp('invitation-decided-in-app', async () => ({
      subject: `@${payload.recipientUsername} ${payload.decision.toLowerCase()} your invitation`,
      body: `@${payload.recipientUsername} ${payload.decision.toLowerCase()} the invitation to ${payload.listingTitle}.`,
      data: payload
    }))

    await step.email('invitation-decided-email', async () => {
      const rendered = await renderSocialNotificationEmail(emailInput(payload.kind, payload))
      return { subject: rendered.subject, body: rendered.html, from: socialEmailFrom }
    })
  },
  { payloadSchema: socialInvitationDecidedPayloadSchema, tags: ['social'] }
)

export const notificationWorkflows = [
  socialApplicationSubmittedWorkflow,
  socialApplicationDecidedWorkflow,
  socialInvitationReceivedWorkflow,
  socialInvitationDecidedWorkflow
]
