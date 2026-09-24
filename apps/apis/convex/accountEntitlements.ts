import { v } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { entitlementTierDtoSchema } from '@artificer-toolkit/schema/api/accountEntitlements'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  entitlementProjectionDtoSchema,
  type EntitlementProjectionDto
} from '@artificer-toolkit/schema/api/campaignCore'
import { accountUsageSchema } from '@artificer-toolkit/schema/projections/accountUsage'
import {
  ENTITLEMENT_LIMITS,
  ENTITLEMENT_PRICING
} from '@artificer-toolkit/shared/account/entitlements'
import { query } from './_generated/server'
import { internalMutation } from './lib/mutations'
import { getAuthenticatedProfile } from './lib/identity'

export const get = query({
  args: {},
  returns: zodToConvex(entitlementProjectionDtoSchema),
  handler: async (ctx): Promise<EntitlementProjectionDto> => {
    const authenticated = await getAuthenticatedProfile(ctx)
    if (!authenticated) throw new Error('Unauthenticated')
    const { profile } = authenticated
    if (profile.entitlementUsageReady !== true)
      throw new Error('Account usage backfill is incomplete.')
    const usage = accountUsageSchema.parse(profile.entitlementUsage)
    const entitlement = await ctx.db
      .query('accountEntitlements')
      .withIndex('by_userId', (q) => q.eq('userId', profile.userId))
      .unique()
    const tier = entitlement?.tier ?? 'FREE'
    return entitlementProjectionDtoSchema.parse({
      tier,
      limits: ENTITLEMENT_LIMITS[tier],
      pricing: ENTITLEMENT_PRICING[tier],
      usage: { ...usage, storageBytes: profile.mediaBytes ?? 0 }
    })
  }
})

// Deployment operator only; Billing owns customer-facing tier changes in Phase 09.
export const setTier = internalMutation({
  args: { userId: v.string(), tier: zodToConvex(entitlementTierDtoSchema) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = postgresUuidSchema.parse(args.userId).toLowerCase()
    const tier = entitlementTierDtoSchema.parse(args.tier)
    const [profile, entitlement] = await Promise.all([
      ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique(),
      ctx.db
        .query('accountEntitlements')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
    ])
    if (!profile) throw new Error('Account not found.')
    if (!entitlement) await ctx.db.insert('accountEntitlements', { userId, tier })
    else if (entitlement.tier !== tier) await ctx.db.patch(entitlement._id, { tier })
    return null
  }
})
