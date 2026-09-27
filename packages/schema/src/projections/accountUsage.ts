import { z, lazySchema } from '../zod.js'

export const accountUsageResourceSchema = lazySchema(() =>
  z.enum([
    'personalCharacters',
    'homebrewRoots',
    'activeHostedCampaigns',
    'publicListings',
    'savedEncounters'
  ])
)
export const accountUsageSchema = lazySchema(() =>
  z.strictObject({
    personalCharacters: z.number().check(z.int()).check(z.nonnegative()),
    homebrewRoots: z.number().check(z.int()).check(z.nonnegative()),
    activeHostedCampaigns: z.number().check(z.int()).check(z.nonnegative()),
    publicListings: z.number().check(z.int()).check(z.nonnegative()),
    savedEncounters: z.number().check(z.int()).check(z.nonnegative())
  })
)
export const zeroAccountUsage = {
  personalCharacters: 0,
  homebrewRoots: 0,
  activeHostedCampaigns: 0,
  publicListings: 0,
  savedEncounters: 0
} as const
export type AccountUsageResource = z.infer<typeof accountUsageResourceSchema>
