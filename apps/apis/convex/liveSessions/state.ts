import { zodToConvex } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import {
  liveSessionActivationInputSchema,
  liveSessionAuthorityDtoSchema,
  liveSessionPublishInputSchema,
  liveSessionPublishResponseSchema,
  type LiveSessionPublishResponse
} from '@artificer-toolkit/schema/api/liveSessionState'
import { internalMutation } from '../lib/mutations'
import {
  advanceCampaignLiveAuthorityPersisted,
  commitCampaignLiveAuthorityActivation,
  presentCampaignLiveAuthority
} from './authority'
import { requireCampaignLiveAuthority } from './authorityGuard'
import { publishResolvedGeometryCommand } from '../scenes/geometryFastCommands'
import { publishResolvedUndoCommand } from '../scenes/undo'
import { livePublicationCampaignScope, requireCampaignAuthority } from '../campaigns/authority'

const authorityResponseValue = zodToConvex(liveSessionAuthorityDtoSchema)

export const activate = internalMutation({
  args: zodToConvex(liveSessionActivationInputSchema),
  returns: authorityResponseValue,
  handler: async (ctx, args) =>
    presentCampaignLiveAuthority(
      await commitCampaignLiveAuthorityActivation(ctx, liveSessionActivationInputSchema.parse(args))
    )
})

export const publish = internalMutation({
  args: v.any(),
  returns: zodToConvex(liveSessionPublishResponseSchema),
  handler: async (ctx, args): Promise<LiveSessionPublishResponse> => {
    const input = liveSessionPublishInputSchema.parse(args)
    const authority = await requireCampaignLiveAuthority(ctx, input)
    if (authority.phase === 'ACTIVATING') throw new Error('Live Session authority is not active.')
    const authorityScope = livePublicationCampaignScope(authority)
    const { membership } = await requireCampaignAuthority(
      ctx,
      input.campaignId,
      input.actorUserId,
      authorityScope
    )
    // ADR 0029 keeps command-time role evidence only across a later access change (transfer or
    // rejoin); a command inside the member's current access, or before this epoch, uses the stored role.
    const accessChangedAfterCommand =
      Date.parse(input.occurredAt) >= Date.parse(authority.createdAt) &&
      Date.parse(input.occurredAt) < Date.parse(membership.accessStartedAt)
    if (!accessChangedAfterCommand && membership.role !== input.actorRole)
      throw new Error('Live Session publication actor role mismatch.')

    const publication = {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      campaignId: input.campaignId,
      authorityScope,
      presentation: input.command.presentation,
      expectedResult: input.expectedSceneResult
    }
    const sceneResult =
      input.command.command.type === 'UNDO_LAST_SCENE_MOVE'
        ? await publishResolvedUndoCommand(ctx, {
            ...publication,
            command: input.command.command
          })
        : await publishResolvedGeometryCommand(ctx, {
            ...publication,
            command: input.command.command
          })
    const advanced = await advanceCampaignLiveAuthorityPersisted(ctx, input)
    return liveSessionPublishResponseSchema.parse({
      scope: 'SCENE',
      authority: presentCampaignLiveAuthority(advanced),
      sceneResult
    })
  }
})
