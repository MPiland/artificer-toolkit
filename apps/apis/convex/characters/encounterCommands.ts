import {
  characterEncounterCommandInputSchema,
  characterEncounterCommandResultSchema,
  type CharacterEncounterCommandInput,
  type CharacterEncounterCommandResult
} from '@artificer-toolkit/schema/api/characterEncounter'
import type { MutationCtx } from '../_generated/server'
import { executeCharacterSheetCommand } from './sheetCommands'

/** Runs a Sheet command on an Encounter Character in the Encounter command's transaction. */
export async function executeEncounterCharacterCommand(
  ctx: MutationCtx,
  userId: string,
  args: CharacterEncounterCommandInput
): Promise<CharacterEncounterCommandResult> {
  const input = characterEncounterCommandInputSchema.parse(args)
  const character = await executeCharacterSheetCommand(
    ctx,
    userId,
    { id: input.characterId, command: input.command },
    input.campaignId
  )
  return characterEncounterCommandResultSchema.parse({
    streamVersion: character.streamVersion,
    currentHitPoints: character.sheet.overview.currentHitPoints,
    maxHitPoints: character.sheet.overview.maxHitPoints,
    tempHitPoints: character.sheet.overview.tempHitPoints,
    // The Encounter projection stores conditions as JSON, which has no absent-but-present fields.
    conditions: JSON.parse(JSON.stringify(character.sheet.overview.conditions))
  })
}
