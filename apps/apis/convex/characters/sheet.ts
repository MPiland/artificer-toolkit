import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v } from 'convex/values'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import {
  characterSheetReadInputSchema,
  characterSheetResponseDtoSchema,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from './sheetPreparation'

/** Personal Sheet reads recompute current authorized sources; no stored projection is served. */
export const get = query({
  args: zodToConvexFields(characterSheetReadInputSchema.shape),
  returns: v.union(v.null(), zodToConvex(characterSheetResponseDtoSchema)),
  handler: async (ctx, args): Promise<CharacterSheetResponseDto | null> => {
    const { userId } = await requireIdentity(ctx)
    const { id: lookupId } = characterSheetReadInputSchema.parse(args)
    const loaded = await loadCharacterSheet(ctx, userId, lookupId)
    return loaded
      ? characterSheetResponseDtoSchema.parse(
          projectCharacterSheetForViewer(loaded.sheet, loaded.campaignContext)
        )
      : null
  }
})
