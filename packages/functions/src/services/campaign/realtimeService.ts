import {
  campaignRealtimeEnvelopeDtoSchema,
  getCampaignRealtimeTopic,
  type CampaignRealtimeEnvelopeDto
} from '@artificer-toolkit/schema/api/campaigns'
import {
  createCampaignCollaborationRepository,
  createCampaignRepository,
  type DBLike
} from '@artificer-toolkit/db'
import { createSupabaseClient } from '../../clients/supabaseClient.js'

export async function broadcastCampaignInvalidation(
  db: DBLike,
  campaignId: string,
  envelope: CampaignRealtimeEnvelopeDto
): Promise<boolean> {
  const payload = campaignRealtimeEnvelopeDtoSchema.parse(envelope)
  try {
    const recipients =
      payload.scope === 'DIRECT'
        ? payload.conversationId
          ? await createCampaignCollaborationRepository(db).listConversationMembers(
              payload.conversationId
            )
          : []
        : (await createCampaignRepository(db).listActiveMemberships(campaignId)).filter(
            (membership) =>
              payload.scope === 'TABLE' ||
              (payload.scope === 'PARTY' && membership.role === 'PLAYER') ||
              (payload.scope === 'OWNER' && membership.role === 'OWNER') ||
              (payload.scope === 'USER' && membership.userId === payload.recipientUserId)
          )
    const client = createSupabaseClient()
    const results = await Promise.all(
      recipients.map(async (membership) => {
        const channel = client.channel(
          getCampaignRealtimeTopic({
            campaignId,
            scope: payload.scope,
            userId: membership.userId,
            accessStartedAt: new Date(membership.accessStartedAt).toISOString(),
            conversationId: payload.conversationId
          }),
          { config: { private: true } }
        )
        try {
          return (await channel.send({ type: 'broadcast', event: 'committed', payload })) === 'ok'
        } finally {
          await client.removeChannel(channel).catch(() => undefined)
        }
      })
    )
    return results.every(Boolean)
  } catch {
    return false
  }
}
