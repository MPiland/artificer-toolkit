import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  liveSessionActivationInputSchema,
  liveSessionAuthorityDtoSchema
} from '@artificer-toolkit/schema/api/liveSessionState'
import { internalMutation } from '../lib/mutations'
import { commitCampaignLiveAuthorityActivation, presentCampaignLiveAuthority } from './authority'

const authorityResponseValue = zodToConvex(liveSessionAuthorityDtoSchema)

export const activate = internalMutation({
  args: zodToConvex(liveSessionActivationInputSchema),
  returns: authorityResponseValue,
  handler: async (ctx, args) =>
    presentCampaignLiveAuthority(
      await commitCampaignLiveAuthorityActivation(ctx, liveSessionActivationInputSchema.parse(args))
    )
})
