import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  characterEncounterInitiativeInputSchema,
  characterEncounterInitiativeResultSchema,
  type CharacterEncounterInitiativeInput,
  type CharacterEncounterInitiativeResult
} from '@artificer-toolkit/schema/api/characterEncounterInitiative'
import { toCharacterInitiativeActorFacts } from '@artificer-toolkit/rules-runtime/character/characterInitiativeFacts'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { loadCharacterSheetFacts } from './sheetFacts'

const resultValidator: Validator<CharacterEncounterInitiativeResult, 'required', string> =
  zodToConvex<z.core.$ZodType<CharacterEncounterInitiativeResult>>(
    characterEncounterInitiativeResultSchema
  )

export const read = internalQuery({
  args: zodToConvex(characterEncounterInitiativeInputSchema),
  returns: resultValidator,
  handler: async (ctx, args): Promise<CharacterEncounterInitiativeResult> => {
    const { userId } = await requireIdentity(ctx)
    return loadCharacterEncounterInitiative(ctx, userId, args)
  }
})

/** Native aggregate callers supply authority derived from the current Campaign, never client input. */
export async function loadCharacterEncounterInitiative(
  ctx: QueryCtx,
  userId: string,
  args: CharacterEncounterInitiativeInput
): Promise<CharacterEncounterInitiativeResult> {
  const input = characterEncounterInitiativeInputSchema.parse(args)
  const loaded = await loadCharacterSheetFacts(ctx, userId, input.characterId, input.campaignId)
  if (!loaded || loaded.active.id !== input.characterId)
    throw new Error('Character initiative source is unavailable.')
  if (loaded.character.systemId !== input.systemId)
    throw new Error('Character initiative source is stale.')
  const { snapshot, registry, output } = loaded.ruleEvaluation
  if (snapshot.characterId !== input.characterId || snapshot.systemId !== input.systemId)
    throw new Error('Character initiative source identity does not match the actor.')
  return characterEncounterInitiativeResultSchema.parse({
    streamVersion: loaded.active.streamVersion,
    initiativeActorFacts: toCharacterInitiativeActorFacts({
      snapshot,
      registry,
      rulePolicyOutput: output
    }),
    rulePolicyOutput: output
  })
}
