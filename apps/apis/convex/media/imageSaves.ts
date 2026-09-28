import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  avatarBindingSchema,
  mediaImageSaveSettlementSchema,
  type AvatarBindingDto
} from '@artificer-toolkit/schema/api/mediaAssets'
import { internalMutation } from '../lib/mutations'
import { readImageSlot } from '../content/imageSlots'
import { bindAvatar, settleImageUpload } from './assets'
import { bindArtwork, ownedDraft } from './authoredAssets'
import { bindPortrait, ownedCharacter } from './characterPortraitAssets'

/**
 * Settles an image upload claimed for one slot, then binds it under that slot's current authority.
 * A slot changed during processing rejects the settlement, so its current image stays.
 */
export const finish = internalMutation({
  args: zodToConvexFields(mediaImageSaveSettlementSchema.shape),
  returns: zodToConvex(avatarBindingSchema),
  handler: async (ctx, args): Promise<AvatarBindingDto> => {
    const { authenticated, asset, binding } = await settleImageUpload(
      ctx,
      mediaImageSaveSettlementSchema.parse(args)
    )
    if (binding.type === 'ACCOUNT_AVATAR') {
      if ((authenticated.profile.avatarRevision ?? 0) !== binding.expectedRevision)
        throw new Error('Avatar changed during processing. Try again.')
      return bindAvatar(ctx, authenticated.profile, asset, binding.crop)
    }
    if (binding.type === 'CHARACTER_PORTRAIT') {
      const { character } = await ownedCharacter(ctx, binding)
      if ((character.portraitRevision ?? 0) !== binding.expectedRevision)
        throw new Error('Portrait changed during processing. Try again.')
      return bindPortrait(ctx, character, asset, binding.crop)
    }
    const { draft } = await ownedDraft(ctx, binding)
    const slot = await readImageSlot(ctx, binding.subjectId, 'DRAFT')
    if (
      draft._id !== binding.draftId ||
      !slot ||
      slot.revision !== binding.expectedRevision ||
      slot.subjectKind !== binding.subjectKind
    )
      throw new Error('Artwork changed during processing.')
    return bindArtwork(ctx, draft, slot, asset, binding.crop)
  }
})
