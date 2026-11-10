import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { createRollRecord } from '@artificer-toolkit/rules-runtime/character/rollRecord'
import {
  carriedTestDice,
  type resolveCharacterSheetRoll
} from '@artificer-toolkit/rules-runtime/character/sheetRoll'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterWriteContext } from './store.js'

/**
 * One roll a Character makes from a Sheet row, for Convex and the live room alike (QUALITY-12.1).
 * The roll takes the dice the Character's effects add to it (Guidance, Bless), the floor its d20
 * keeps (Glibness) and the dice held for after the d20 (D168); the effects the roll uses up end in
 * the caller's transaction (D156). Each host supplies its own randomness.
 */
export async function rollCharacterSheetRoll(
  ctx: EncounterWriteContext,
  input: {
    character: { id: string; label: string }
    system: Parameters<typeof createRollRecord>[0]['system']
    resolved: ReturnType<typeof resolveCharacterSheetRoll>
    activeEffects: readonly ActiveRuleEffectRecord[]
    /** The Character's grant fold and the registry that labels its sources. */
    rules: Parameters<typeof carriedTestDice>[2]
    nextInt: (maxExclusive: number) => number
  }
) {
  const { addedDice, spent, minimumRoll, afterRollOffers } = carriedTestDice(
    input.resolved,
    input.activeEffects,
    input.rules
  )
  const store = createActiveRuleEffectStore(ctx)
  for (const effect of spent)
    await store.deleteCas({
      id: effect.id,
      owner: effect.owner,
      expectedVersion: effect.version,
      removal: 'ENDED'
    })
  return createRollRecord({
    characterId: input.character.id,
    label: input.character.label,
    system: input.system,
    resolved: input.resolved,
    addedDice,
    minimumRoll: minimumRoll ?? undefined,
    afterRollOffers,
    nextInt: input.nextInt
  })
}
