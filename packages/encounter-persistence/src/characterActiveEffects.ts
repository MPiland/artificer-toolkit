import { CharacterSheetCommandError } from '@artificer-toolkit/rules-runtime/character/sheetCommandError'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterWriteContext } from './store.js'

/**
 * D99: the Campaign owner ends one of a Character's active effects by hand; the Character's own
 * player ends only a grant that lets its holder end it (`holderEnd`, D113). In an Encounter a grant
 * whose end costs an activation is ended by the Encounter's own command, which spends it, not here.
 * A grant held by a Concentration ends with it, so only the maintained state's own end removes that one.
 */
export async function endCharacterActiveEffect(
  ctx: EncounterWriteContext,
  input: {
    characterId: string
    effectId: string
    isCampaignOwner: boolean
    /** An Assisted Run enforces the holder-end's action economy, so a costed end goes through its Encounter command. */
    economyEnforced: boolean
  }
): Promise<void> {
  const store = createActiveRuleEffectStore(ctx)
  const owner = { kind: 'CHARACTER', characterId: input.characterId } as const
  const effect = await store.findById(owner, input.effectId)
  if (!effect) throw new CharacterSheetCommandError('Active effect is unavailable.')
  if (!input.isCampaignOwner) {
    const { holderEnd } = effect.definition.recurrence
    if (!holderEnd)
      throw new CharacterSheetCommandError('Only the Campaign owner can end an active effect.')
    if (input.economyEnforced && holderEnd.activation !== 'FREE')
      throw new CharacterSheetCommandError('End this effect from the Encounter actions.')
  }
  if (effect.maintainedEffectStateId !== null)
    throw new CharacterSheetCommandError('End the Concentration that holds this effect instead.')
  await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
}
