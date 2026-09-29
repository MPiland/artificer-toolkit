import {
  listHitPointMaximumReductions,
  reduceHitPointMaximum
} from '@artificer-toolkit/rules-runtime/character/hitPointMaximumReductions'
import { listActiveRuleEffects } from './effectStore.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

/**
 * The maximum hit points the Sheet shows, read from a Character's play record: the stored maximum (before
 * active-effect reductions) less the Character's active hit point maximum reductions.
 */
export async function readCharacterMaximumHitPoints(
  ctx: EncounterReadContext,
  play: Pick<EncounterDocument<'characterPlayStates'>, 'characterId' | 'maximumHitPoints'>
) {
  return reduceHitPointMaximum(
    play.maximumHitPoints,
    listHitPointMaximumReductions(
      await listActiveRuleEffects(ctx, { kind: 'CHARACTER', characterId: play.characterId })
    )
  )
}
