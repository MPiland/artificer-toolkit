import { describe, expect, it } from 'vitest'

import { renderSocialNotificationEmail, type SocialNotificationEmailInput } from '../index.js'

const appUrl = 'https://app.example.test'
const listingPublicId = '00000000-0000-4000-8000-000000000001'
const sourcePublicId = '00000000-0000-4000-8000-000000000002'
const occurredAt = '2026-08-11T16:00:00.000Z'
const campaignPublicId = '00000000-0000-4000-8000-000000000003'
const announcementPublicId = '00000000-0000-4000-8000-000000000004'

const inputs: readonly SocialNotificationEmailInput[] = [
  {
    appUrl,
    workflowKey: 'social-application-submitted',
    data: {
      kind: 'SOCIAL_APPLICATION_SUBMITTED',
      applicantUsername: 'apprentice',
      listingPublicId,
      listingTitle: 'Lanterns of Greyhaven',
      occurredAt,
      sourcePublicId
    }
  },
  {
    appUrl,
    workflowKey: 'social-application-decided',
    data: {
      kind: 'SOCIAL_APPLICATION_DECIDED',
      decision: 'ACCEPTED',
      listingPublicId,
      listingTitle: 'Lanterns of Greyhaven',
      occurredAt,
      sourcePublicId
    }
  },
  {
    appUrl,
    workflowKey: 'social-invitation-received',
    data: {
      kind: 'SOCIAL_INVITATION_RECEIVED',
      expiresAt: '2026-08-12T16:00:00.000Z',
      hostUsername: 'host',
      listingPublicId,
      listingTitle: 'Lanterns of Greyhaven',
      occurredAt,
      sourcePublicId
    }
  },
  {
    appUrl,
    workflowKey: 'social-invitation-decided',
    data: {
      kind: 'SOCIAL_INVITATION_DECIDED',
      decision: 'DECLINED',
      listingPublicId,
      listingTitle: 'Lanterns of Greyhaven',
      occurredAt,
      recipientUsername: 'apprentice',
      sourcePublicId
    }
  },
  {
    appUrl,
    workflowKey: 'campaign-announcement',
    data: {
      kind: 'CAMPAIGN_ANNOUNCEMENT',
      announcementPublicId,
      campaignPublicId,
      occurredAt,
      scope: 'TABLE',
      sourcePublicId: announcementPublicId,
      summary: 'A new Campaign announcement is available.'
    }
  }
]

describe('renderSocialNotificationEmail', () => {
  it.each(inputs)('renders a branded %s email', async (input) => {
    const email = await renderSocialNotificationEmail(input)

    expect(email.html).toContain('<html')
    expect(email.html).toContain('Artificer Toolkit')
    expect(email.html).not.toContain('Forge clarity')
    expect(email.subject).not.toContain('{{')
    expect(email.html).not.toContain('emailHtml')
    expect(email.html).not.toContain('emailSubject')
    expect(email.html).toContain('Manage notification preferences')
    expect(email.html).toContain(`${appUrl}/settings/preferences`)
  })

  it.each([
    [inputs[0], `/social/hosting/${listingPublicId}/edit?section=applications`],
    [inputs[1], `/social?view=applications&applicationPublicId=${sourcePublicId}`],
    [inputs[2], `/social?view=invitations&invitePublicId=${sourcePublicId}`],
    [
      inputs[3],
      `/social/hosting/${listingPublicId}/edit?section=invitations&invitePublicId=${sourcePublicId}`
    ],
    [
      inputs[4],
      `/campaigns/${campaignPublicId}?tab=announcements&announcementPublicId=${announcementPublicId}`
    ]
  ])('uses the authoritative %s deep link', async (input, path) => {
    const email = await renderSocialNotificationEmail(input!)

    expect(email.html.replaceAll('&amp;', '&')).toContain(`${appUrl}${path}`)
  })

  it('renders a digest count without exposing its representative applicant', async () => {
    const email = await renderSocialNotificationEmail({ ...inputs[0]!, activityCount: 3 })

    expect(email.subject).toBe('3 new applications for Lanterns of Greyhaven')
    expect(email.html).toContain('You have 3 new applications for Lanterns of Greyhaven.')
    expect(email.html).not.toContain('@apprentice')
  })

  it('rejects notification data for a different workflow', async () => {
    await expect(
      renderSocialNotificationEmail({
        ...inputs[0]!,
        workflowKey: 'social-invitation-decided'
      })
    ).rejects.toThrow('does not match workflow')
  })
})
