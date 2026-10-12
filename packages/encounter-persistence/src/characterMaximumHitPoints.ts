import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import { listActiveRuleEffects } from './effectStore.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

/**
 * The maximum hit points the Sheet shows, read from a Character's play record: the stored maximum (before
 * active effects) with the Character's active maximum grants and reductions applied.
 */
export async function readCharacterMaximumHitPoints(
  ctx: EncounterReadContext,
  play: Pick<EncounterDocument<'characterPlayStates'>, 'characterId' | 'maximumHitPoints'>
) {
  return effectiveHitPointMaximum(
    play.maximumHitPoints,
    await listActiveRuleEffects(ctx, { kind: 'CHARACTER', characterId: play.characterId })
  )
}
