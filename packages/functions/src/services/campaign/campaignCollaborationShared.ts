import { randomUUID } from 'node:crypto'
import { createCampaignRepository, type DBLike } from '@artificer-toolkit/db'
import { CampaignNotFoundError } from './campaignService.js'
import { broadcastCampaignInvalidation } from './realtimeService.js'

export function now(): string {
  return new Date().toISOString()
}

export async function lockCampaign(db: DBLike, campaignId: string): Promise<void> {
  if (!(await createCampaignRepository(db).lockCampaign(campaignId))) {
    throw new CampaignNotFoundError()
  }
}

export async function broadcast(
  db: DBLike,
  campaignId: string,
  scope: 'TABLE' | 'PARTY' | 'DIRECT' | 'OWNER',
  entity: 'CHAT' | 'NOTE' | 'SESSION',
  entityId: string,
  event: 'CREATED' | 'UPDATED' | 'DELETED',
  cursor: string,
  conversationId?: string
): Promise<void> {
  await broadcastCampaignInvalidation(db, campaignId, {
    scope,
    entity,
    entityId,
    event,
    eventId: randomUUID(),
    cursor,
    ...(scope === 'DIRECT' && conversationId ? { conversationId } : {})
  })
}
