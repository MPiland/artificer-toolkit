import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { readActiveCampaignMembers as readStoredActiveCampaignMembers } from '@artificer-toolkit/encounter-persistence/campaignMemberships'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readVisibleAuthoredRouteId } from '../content/routeIds'

const internalScope = Symbol('campaign-internal-authority')
export type CampaignInternalScope = {
  [internalScope]: true
  campaignId: string
} & (
  | { kind: 'PUBLICATION'; authority: Doc<'campaignLiveAuthorities'> }
  | { kind: 'DELETION'; job: Doc<'campaignDeletionJobs'> }
)

/** Only the trusted live publication entry point constructs this scope after checking its epoch. */
export function livePublicationCampaignScope(
  authority: Doc<'campaignLiveAuthorities'>
): CampaignInternalScope {
  return { [internalScope]: true, kind: 'PUBLICATION', campaignId: authority.campaignId, authority }
}

/** The deletion worker checks the root and released authority before reconciling assignments. */
export function deletionCampaignScope(job: Doc<'campaignDeletionJobs'>): CampaignInternalScope {
  return { [internalScope]: true, kind: 'DELETION', campaignId: job.campaignId, job }
}

/**
 * The Campaign and the caller's membership, or null when the caller cannot see the Campaign (no
 * route, deleting, or not an active member). Integrity failures still throw.
 */
export async function readCampaignAuthority(
  ctx: QueryCtx,
  id: string,
  userId: string,
  scope?: CampaignInternalScope
) {
  const uuid = postgresUuidSchema.safeParse(id)
  const route = await readVisibleAuthoredRouteId(
    ctx,
    uuid.success ? { subjectId: uuid.data } : { publicId: id }
  )
  if (!route || route.subjectKind !== 'CAMPAIGN') return null
  const publication =
    scope?.[internalScope] === true &&
    scope.kind === 'PUBLICATION' &&
    scope.campaignId === route.subjectId &&
    scope.authority.campaignId === route.subjectId
  const deletion = await ctx.db
    .query('campaignDeletionJobs')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', route.subjectId))
    .unique()
  if (deletion) {
    if (!scope || scope[internalScope] !== true || scope.campaignId !== route.subjectId) return null
    if (scope.kind === 'PUBLICATION') {
      const authority = scope.authority
      if (
        !publication ||
        deletion.status !== 'DELETING' ||
        deletion.stage !== 'DRAIN_ROOM' ||
        authority.phase !== 'DRAINING' ||
        deletion.liveAuthorityId !== authority._id ||
        deletion.liveAuthority?.epoch !== authority.epoch
      )
        throw new Error('Campaign deletion publication authority is stale.')
    } else if (
      deletion.status !== 'DELETING' ||
      deletion.stage !== 'CHARACTERS' ||
      deletion._id !== scope.job._id ||
      deletion.revision !== scope.job.revision
    ) {
      throw new Error('Campaign deletion reconciliation authority is stale.')
    }
  }
  const [campaign, membership] = await Promise.all([
    ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', route.subjectId))
      .unique(),
    ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', route.subjectId).eq('userId', userId)
      )
      .unique()
  ])
  if (!campaign || !membership || (membership.status !== 'ACTIVE' && !publication)) return null
  if (
    campaign.publicId !== route.publicId ||
    (!publication && (membership.role === 'OWNER') !== (campaign.ownerUserId === userId))
  )
    throw new Error('Stored Campaign authority mismatch.')
  return { campaign, membership }
}

export async function requireCampaignAuthority(
  ctx: QueryCtx,
  id: string,
  userId: string,
  scope?: CampaignInternalScope
) {
  const authority = await readCampaignAuthority(ctx, id, userId, scope)
  if (!authority) rejectDomain('CAMPAIGN_NOT_FOUND')
  return authority
}

export async function readActiveCampaignMembers(ctx: QueryCtx, campaign: Doc<'campaigns'>) {
  return readStoredActiveCampaignMembers(ctx.db.query('campaignMemberships'), campaign)
}
