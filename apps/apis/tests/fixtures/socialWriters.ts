import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import type { z } from 'zod'
import type {
  SocialListingDto,
  socialListingVersionInputSchema
} from '@artificer-toolkit/schema/api/socialHub'
import { register } from '@convex-dev/resend/test'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture as characters } from './characters'
import { api, components, internal } from '../../convex/_generated/api'

export async function fixture() {
  const base = await characters()
  register(base.t)
  for (const [actor, username] of [
    [base.owner, 'AdmissionHost'],
    [base.other, 'AdmissionPlayer']
  ] as const) {
    await actor.caller.mutation(api.account.updateProfile, { username, bio: null })
    await actor.caller.mutation(api.social.profiles.initialize, {})
  }
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'A shitstorm campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const draft = await base.owner.caller.mutation(api.social.listingDrafts.create, {
    input: {
      campaignId: campaign.id,
      summary: 'Find a table',
      audience: 'PUBLIC',
      systemId: srdSystemRecord.id,
      playMode: 'ONLINE',
      capacity: 2,
      schedule: { kind: 'FLEXIBLE', timeZone: 'America/Chicago', summary: 'Agree a date' },
      location: null,
      expectations: {
        contentGuidance: 'A shitstorm of adventure',
        attendancePolicy: 'Tell us',
        allowedContentRules: 'SRD',
        tableConduct: 'Be kind',
        contentBoundaries: 'Discuss together',
        safetyPractices: ['LINES_AND_VEILS'],
        safetyDetails: 'Pause when needed'
      }
    }
  })
  const listing = await base.owner.caller.mutation(
    makeFunctionReference<
      'mutation',
      z.input<typeof socialListingVersionInputSchema>,
      SocialListingDto
    >('social/listings:open'),
    {
      listingPublicId: draft.listingPublicId,
      expectedVersion: draft.version
    }
  )
  async function addActor(username: string) {
    const user = await base.t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: username,
            email: `${username}@example.invalid`,
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
    )
    const session = await base.t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: user._id,
            token: crypto.randomUUID(),
            // Outlives a drained staged account deletion, whose retry watchdogs advance the fake clock.
            expiresAt: Date.now() + 24 * 60 * 60_000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const caller = base.t.withIdentity({ subject: user._id, sessionId: session._id })
    const identity = await caller.query(api.account.identity, {})
    if (!identity) throw new Error('Missing actor identity.')
    await caller.mutation(api.account.updateProfile, { username, bio: null })
    await caller.mutation(api.social.profiles.initialize, {})
    return { caller, userId: identity.userId }
  }
  const snapshot = () =>
    base.t.run(async (ctx) => ({
      campaigns: await ctx.db.query('campaigns').collect(),
      memberships: await ctx.db.query('campaignMemberships').collect(),
      applications: await ctx.db.query('socialApplications').collect(),
      invitations: await ctx.db.query('campaignInvites').collect(),
      listings: await ctx.db.query('socialListings').collect(),
      notifications: await ctx.db.query('notificationDeliveryIntents').collect(),
      feed: await ctx.db.query('notificationFeedItems').collect()
    }))
  return { ...base, campaign, listing, addActor, snapshot }
}
