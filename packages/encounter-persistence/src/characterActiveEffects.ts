import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterWriteContext } from './store.js'

/**
 * D99: the Campaign owner ends one of a Character's active effects by hand. A grant held by a
 * Concentration ends with it, so only the maintained state's own end removes that one.
 */
export async function endCharacterActiveEffect(
  ctx: EncounterWriteContext,
  input: { characterId: string; effectId: string }
): Promise<void> {
  const store = createActiveRuleEffectStore(ctx)
  const owner = { kind: 'CHARACTER', characterId: input.characterId } as const
  const effect = await store.findById(owner, input.effectId)
  if (!effect) throw new CharacterSheetCommandError('Active effect is unavailable.')
  if (effect.maintainedEffectStateId !== null)
    throw new CharacterSheetCommandError('End the Concentration that holds this effect instead.')
  await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
}
