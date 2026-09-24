import {
  campaignSessionDtoSchema,
  type CampaignSessionDto
} from '@artificer-toolkit/schema/api/campaignSessions'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'
import type { QueryCtx } from '../_generated/server'

export async function requireSession(ctx: QueryCtx, campaignId: string, sessionId: string) {
  const session = await ctx.db
    .query('campaignSessions')
    .withIndex('by_campaignId_id', (q) =>
      q.eq('campaignId', campaignId).eq('id', sessionId.toLowerCase())
    )
    .unique()
  if (!session) throw new Error('Session not found.')
  return session
}

export function presentSession(session: CampaignSessionDto, maturity: 'STANDARD' | 'MATURE') {
  return campaignSessionDtoSchema.parse({
    id: session.id,
    campaignId: session.campaignId,
    sessionNumber: session.sessionNumber,
    title: session.title === null ? null : presentCampaignPlainText(session.title, maturity),
    scheduledStartAt: session.scheduledStartAt,
    scheduledEndAt: session.scheduledEndAt,
    timeZone: session.timeZone,
    status: session.status,
    finishedAt: session.finishedAt,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  })
}
