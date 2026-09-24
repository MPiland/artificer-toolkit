import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  socialEligibilityDtoSchema,
  updateSocialContentPreferenceInputSchema,
  type SocialEligibilityDto
} from '@artificer-toolkit/schema/api/socialHub'
import {
  socialStoredProfileSchema,
  type SocialStoredProfile
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { isAtLeast18 } from '@artificer-toolkit/shared/account/ageAttestation'
import { query, type QueryCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'

export async function readProfile(ctx: QueryCtx, userId: string) {
  const record = await ctx.db
    .query('socialProfiles')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .unique()
  if (!record) return null
  const { _id, _creationTime, ...stored } = record
  return { rowId: _id, profile: socialStoredProfileSchema.parse(stored) }
}

function newProfile(userId: string, now: string): SocialStoredProfile {
  return {
    id: crypto.randomUUID(),
    userId,
    adultAttestedAt: null,
    contentPreference: 'STANDARD',
    status: 'ACTIVE',
    version: 0,
    createdAt: now,
    updatedAt: now
  }
}

function eligibility(profile: SocialStoredProfile | null): SocialEligibilityDto {
  return socialEligibilityDtoSchema.parse({
    eligible: profile?.status === 'ACTIVE',
    profilePublicId: profile?.id ?? null,
    adultAttestedAt: profile?.adultAttestedAt ?? null,
    contentPreference: profile?.contentPreference ?? 'STANDARD',
    status: profile?.status ?? null
  })
}

export const getEligibility = query({
  args: {},
  returns: zodToConvex(socialEligibilityDtoSchema),
  handler: async (ctx): Promise<SocialEligibilityDto> => {
    const { userId } = await requireIdentity(ctx)
    return eligibility((await readProfile(ctx, userId))?.profile ?? null)
  }
})

export const initialize = mutation({
  args: {},
  returns: zodToConvex(socialEligibilityDtoSchema),
  handler: async (ctx): Promise<SocialEligibilityDto> => {
    const { userId } = await requireIdentity(ctx)
    const existing = await readProfile(ctx, userId)
    if (existing) return eligibility(existing.profile)
    const profile = socialStoredProfileSchema.parse(newProfile(userId, new Date().toISOString()))
    await ctx.db.insert('socialProfiles', profile)
    return eligibility(profile)
  }
})

export const updatePreference = mutation({
  args: { input: zodToConvex(updateSocialContentPreferenceInputSchema) },
  returns: zodToConvex(socialEligibilityDtoSchema),
  handler: async (ctx, args): Promise<SocialEligibilityDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = updateSocialContentPreferenceInputSchema.parse(args.input)
    const existing = await readProfile(ctx, userId)
    const now = new Date()
    let adultAttestedAt = existing?.profile.adultAttestedAt ?? null
    if (input.contentPreference === 'MATURE' && adultAttestedAt === null) {
      if (!input.birthDate || !isAtLeast18(input.birthDate, now))
        throw new Error(
          'Mature content requires confirming that you are at least 18 using your birth date.'
        )
      adultAttestedAt = now.toISOString()
    }
    const profile = socialStoredProfileSchema.parse({
      ...(existing?.profile ?? newProfile(userId, now.toISOString())),
      contentPreference: input.contentPreference,
      adultAttestedAt,
      version: existing ? existing.profile.version + 1 : 0,
      updatedAt: now.toISOString()
    })
    if (existing) await ctx.db.replace(existing.rowId, profile)
    else await ctx.db.insert('socialProfiles', profile)
    return eligibility(profile)
  }
})
