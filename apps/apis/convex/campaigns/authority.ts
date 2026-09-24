import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { ENTITLEMENT_LIMITS } from '@artificer-toolkit/shared/account/entitlements'
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

export async function requireCampaignAuthority(
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
  if (!route || route.subjectKind !== 'CAMPAIGN') throw new Error('Campaign not found.')
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
    if (!scope || scope[internalScope] !== true || scope.campaignId !== route.subjectId)
      throw new Error('Campaign not found.')
    if (scope.kind === 'PUBLICATION') {
      const authority = scope.authority
      if (
        !publication ||
        deletion.status !== 'DELETING' ||
        deletion.stage !== 'DRAIN_ROOM' ||
        authority.phase !== 'DRAINING' ||
        deletion.liveAuthorityId !== authority._id ||
        deletion.liveAuthority?.epoch !== authority.epoch ||
        deletion.liveAuthority.sessionId !== authority.sessionId
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
  if (!campaign || !membership || (membership.status !== 'ACTIVE' && !publication))
    throw new Error('Campaign not found.')
  if (
    campaign.publicId !== route.publicId ||
    (!publication && (membership.role === 'OWNER') !== (campaign.ownerUserId === userId))
  )
    throw new Error('Stored Campaign authority mismatch.')
  return { campaign, membership }
}

export async function readActiveCampaignMembers(ctx: QueryCtx, campaign: Doc<'campaigns'>) {
  // Existing tier policy permits at most twelve players plus one owner, including after downgrade.
  const maxPlayers = Math.max(
    ...Object.values(ENTITLEMENT_LIMITS).map((tier) => tier.playerSeatsPerCampaign)
  )
  const members = await ctx.db
    .query('campaignMemberships')
    .withIndex('by_campaignId_status', (q) =>
      q.eq('campaignId', campaign.id).eq('status', 'ACTIVE')
    )
    .take(maxPlayers + 2)
  if (members.length > maxPlayers + 1) throw new Error('Campaign player capacity exceeded.')
  const owners = members.filter((member) => member.role === 'OWNER')
  if (
    owners.length !== 1 ||
    owners[0]!.userId !== campaign.ownerUserId ||
    new Set(members.map((member) => member.userId)).size !== members.length
  )
    throw new Error('Stored Campaign membership authority mismatch.')
  return members.sort(
    (left, right) =>
      (left.role === right.role ? 0 : left.role === 'OWNER' ? -1 : 1) ||
      left.joinedAt.localeCompare(right.joinedAt) ||
      left.userId.localeCompare(right.userId)
  )
}
