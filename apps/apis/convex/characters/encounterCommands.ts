import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  characterEncounterCommandInputSchema,
  characterEncounterCommandResultSchema,
  type CharacterEncounterCommandResult
} from '@artificer-toolkit/schema/api/characterEncounter'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { executeCharacterSheetCommand } from './sheetCommands'

export const execute = internalMutation({
  args: zodToConvex(characterEncounterCommandInputSchema),
  returns: zodToConvex(characterEncounterCommandResultSchema),
  handler: async (ctx, args): Promise<CharacterEncounterCommandResult> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterEncounterCommandInputSchema.parse(args)
    const character = await executeCharacterSheetCommand(
      ctx,
      userId,
      { id: input.characterId, command: input.command },
      input.campaignId
    )
    if (character.historyEntry === undefined)
      throw new Error('Character Sheet command receipt is unavailable.')
    return characterEncounterCommandResultSchema.parse({
      historyEventId: character.historyEntry.eventId,
      streamVersion: character.streamVersion,
      currentHitPoints: character.sheet.overview.currentHitPoints,
      maxHitPoints: character.sheet.overview.maxHitPoints,
      tempHitPoints: character.sheet.overview.tempHitPoints,
      conditions: character.sheet.overview.conditions
    })
  }
})
