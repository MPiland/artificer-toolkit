import { Migrations } from '@convex-dev/migrations'
import {
  accountUsageSchema,
  zeroAccountUsage
} from '@artificer-toolkit/schema/projections/accountUsage'
import { components, internal } from './_generated/api'
import schema from './schema'
import { syncAccountUsage } from './lib/accountUsage'
import { internalMutation } from './lib/mutations'

const migrations = new Migrations(components.migrations, { schema, internalMutation })

export const homebrewRoots = migrations.define({
  table: 'authoredRoots',
  batchSize: 4,
  customRange: (query) => query.withIndex('by_ownerUserId', (q) => q.gt('ownerUserId', undefined)),
  migrateOne: (ctx, root) => syncAccountUsage(ctx, 'homebrewRoots', root.id)
})

export const homebrewDrafts = migrations.define({
  table: 'authoredDrafts',
  // Draft payloads can approach the document limit; migrate one encoded document per batch.
  batchSize: 1,
  migrateOne: (ctx, draft) => syncAccountUsage(ctx, 'homebrewRoots', draft.subjectId)
})

export const characters = migrations.define({
  table: 'characters',
  batchSize: 1,
  migrateOne: (ctx, character) => syncAccountUsage(ctx, 'personalCharacters', character.id)
})

export const characterDrafts = migrations.define({
  table: 'characterDrafts',
  batchSize: 1,
  migrateOne: (ctx, draft) => syncAccountUsage(ctx, 'personalCharacters', draft.characterId)
})

export const campaigns = migrations.define({
  table: 'campaigns',
  batchSize: 8,
  migrateOne: (ctx, campaign) => syncAccountUsage(ctx, 'activeHostedCampaigns', campaign.id)
})

export const listings = migrations.define({
  table: 'socialListings',
  batchSize: 8,
  migrateOne: (ctx, listing) => syncAccountUsage(ctx, 'publicListings', listing.id)
})

export const blueprints = migrations.define({
  table: 'encounterBlueprints',
  batchSize: 1,
  migrateOne: (ctx, blueprint) => syncAccountUsage(ctx, 'savedEncounters', blueprint.id)
})

const sources = [
  internal.accountUsageBackfill.homebrewRoots,
  internal.accountUsageBackfill.homebrewDrafts,
  internal.accountUsageBackfill.characters,
  internal.accountUsageBackfill.characterDrafts,
  internal.accountUsageBackfill.campaigns,
  internal.accountUsageBackfill.listings,
  internal.accountUsageBackfill.blueprints
]

export const profiles = migrations.define({
  table: 'userProfiles',
  batchSize: 8,
  migrateOne: async (ctx, profile) => {
    const status = await migrations.getStatus(ctx, { migrations: sources })
    if (
      status.length !== sources.length ||
      status.some((step) => !step.isDone || step.state !== 'success')
    )
      throw new Error('Account usage source backfills must finish before enabling totals.')
    await ctx.db.patch(profile._id, {
      entitlementUsage: accountUsageSchema.parse(profile.entitlementUsage ?? zeroAccountUsage),
      entitlementUsageReady: true
    })
  }
})

// The component resumes incomplete work and stops the series if any source migration fails.
export const run = migrations.runner([...sources, internal.accountUsageBackfill.profiles])
