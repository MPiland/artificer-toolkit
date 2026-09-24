import {
  characterSheetEquipmentOptionsInputSchema,
  characterSheetEquipmentOptionsResponseDtoSchema,
  type CharacterSheetEquipmentOptionsResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { query } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheet } from './sheetPreparation'

/** Full current Equipment choices load only when an inventory editor opens. */
export const list = query({
  args: zodToConvexFields(characterSheetEquipmentOptionsInputSchema.shape),
  returns: zodToConvex(characterSheetEquipmentOptionsResponseDtoSchema),
  handler: async (ctx, args): Promise<CharacterSheetEquipmentOptionsResponseDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterSheetEquipmentOptionsInputSchema.parse(args)
    const current = await loadCharacterSheet(
      ctx,
      userId,
      input.id,
      input.campaignId,
      undefined,
      'resolution'
    )
    if (!current) throw new Error('Character Equipment options are unavailable.')
    return current.sheet.reference.equipmentOptions
  }
})
