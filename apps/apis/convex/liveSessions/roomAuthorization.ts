import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  liveSessionRoomAuthorizationInputSchema,
  liveSessionRoomAuthorizationResponseSchema,
  type LiveSessionRoomAuthorizationInput,
  type LiveSessionRoomAuthorizationResponse
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readActiveSceneEncounter } from '@artificer-toolkit/encounter-persistence/sceneBindingReads'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import { readCharacterPlay } from '../characters/stateDocuments'
import { readSceneVisionRevision } from '../scenes/visionFreshness'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { readAuthUsers } from '../lib/authUserReads'

/** The ACTIVE Encounter bound to the presented Scene: its actor control and health display. */
async function readPlayAuthorization(ctx: QueryCtx, campaign: Doc<'campaigns'>) {
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
    .unique()
  const sceneId = presentation?.sceneId ?? null
  const active = sceneId
    ? await readActiveSceneEncounter(
        { db: createConvexEncounterStoreReader(ctx) },
        { campaignId: campaign.id, sceneId }
      )
    : null
  if (!active) return { encounter: null }
  const { run, binding } = active
  const state = readRunState(run)
  const [actors, tokens] = await Promise.all([
    readRunActors({ db: createConvexEncounterStoreReader(ctx) }, state),
    ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_tokenId', (q) => q.eq('encounterId', run.id))
      .collect()
  ])
  return {
    encounter: {
      encounterId: run.id,
      sceneId: binding.sceneId,
      healthDisplayDefault: state.healthDisplayDefault,
      actors: actors.map(({ id, kind, sourceId, controllerUserIds, owner, healthDisplay }) => ({
        id,
        kind,
        sourceId,
        controllerUserIds,
        ...(owner && { owner }),
        healthDisplay
      })),
      tokens: tokens.map(({ tokenId, actorId }) => ({ tokenId, actorId }))
    }
  }
}

/**
 * The room's authorization cache (ADR 0035 Amendment 14), authorized by the Worker secret and the
 * room's `DO_ACTIVE` epoch rather than a member's token. It always reads the revisions, which is
 * small; it returns a section only when its revision differs from what the room already holds.
 */
export const read = internalQuery({
  args: zodToConvexFields(liveSessionRoomAuthorizationInputSchema.shape),
  returns: zodToConvex(liveSessionRoomAuthorizationResponseSchema),
  handler: async (ctx, args): Promise<LiveSessionRoomAuthorizationResponse> => {
    const input = liveSessionRoomAuthorizationInputSchema.parse(args)
    await requireActiveCampaignLiveAuthority(ctx, input)
    return readRoomAuthorization(ctx, input)
  }
})

/** Caller fences the epoch. A checkpoint does not call it; the room's lease renewal does (ADR 0035 Amendment 18). */
export async function readRoomAuthorization(
  ctx: QueryCtx,
  input: LiveSessionRoomAuthorizationInput
): Promise<LiveSessionRoomAuthorizationResponse> {
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_publicId', (q) => q.eq('id', input.campaignId.toLowerCase()))
    .unique()
  if (!campaign) throw new Error('Campaign not found.')
  const [memberships, assignments, campaignRevision, playRevision, systemRevision] =
    await Promise.all([
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_status', (q) =>
          q.eq('campaignId', campaign.id).eq('status', 'ACTIVE')
        )
        .collect(),
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .collect(),
      readSceneVisionRevision(ctx, 'CAMPAIGN', campaign.id),
      readSceneVisionRevision(ctx, 'PLAY', campaign.id),
      readSceneVisionRevision(ctx, 'SYSTEM', campaign.gameSystemId)
    ])
  // An archived Campaign has no live members; a role that disagrees with the owner fails closed.
  const members =
    campaign.status === 'ACTIVE'
      ? memberships
          .filter(
            (membership) =>
              (membership.role === 'OWNER') === (membership.userId === campaign.ownerUserId)
          )
          .map((membership) => ({
            membershipEpoch: membership.accessStartedAt,
            role: membership.role,
            userId: membership.userId
          }))
          .sort((left, right) => left.userId.localeCompare(right.userId))
      : []
  const [profiles, characterRevisions] = await Promise.all([
    Promise.all(
      members.map(async ({ userId }) => {
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', userId))
          .unique()
        if (!profile) throw new Error('User profile is missing.')
        return profile
      })
    ),
    Promise.all(
      assignments
        .map(({ characterId }) => characterId)
        .sort((left, right) => left.localeCompare(right))
        .map(async (characterId) => ({
          characterId,
          revision: await readSceneVisionRevision(ctx, 'CHARACTER', characterId)
        }))
    )
  ])
  const authUsers = new Map(
    (
      await readAuthUsers(
        ctx,
        profiles.map((profile) => profile.authUserId)
      )
    ).map((user) => [String(user._id), user])
  )
  const preferences = profiles.map((profile) => {
    const user = authUsers.get(profile.authUserId)
    if (!user) throw new Error('Member auth user is missing.')
    return {
      userId: profile.userId,
      autoRollDice: profile.autoRollDice,
      gmRollVisibility: profile.gmRollVisibility,
      username: user.displayUsername ?? user.username ?? null
    }
  })
  const revisions = {
    system: systemRevision,
    campaign: campaignRevision,
    play: playRevision,
    characters: characterRevisions,
    preferences: checksumCanonicalJson(preferences)
  }
  const { known } = input
  const knownCharacters = new Map(
    known?.characters.map(({ characterId, revision }) => [characterId, revision])
  )
  const changedCharacters = characterRevisions.filter(
    ({ characterId, revision }) =>
      !knownCharacters.has(characterId) || knownCharacters.get(characterId) !== revision
  )
  const characters = await Promise.all(
    changedCharacters.map(async ({ characterId }) => {
      // Party visibility lives on the small play record; the Character document is never loaded.
      const play = await ctx.db
        .query('characterPlayStates')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .unique()
      if (!play) throw new Error('Assigned Character is missing.')
      return {
        characterId,
        ownerUserId: play.userId,
        partyVisibility: readCharacterPlay(play).partyVisibility
      }
    })
  )
  return liveSessionRoomAuthorizationResponseSchema.parse({
    revisions,
    ...(known && known.campaign === revisions.campaign
      ? {}
      : {
          campaign: {
            ownerUserId: campaign.ownerUserId,
            members,
            assignments: assignments
              .map(({ characterId, userId, controllerUserIds }) => ({
                characterId,
                userId,
                ...(controllerUserIds?.length && { controllerUserIds })
              }))
              .sort((left, right) => left.characterId.localeCompare(right.characterId))
          }
        }),
    characters,
    ...(known && known.preferences === revisions.preferences ? {} : { preferences }),
    ...(known && known.play === revisions.play
      ? {}
      : { play: await readPlayAuthorization(ctx, campaign) })
  })
}
