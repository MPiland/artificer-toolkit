import {
  listHitPointMaximumReductions,
  reduceHitPointMaximum
} from '@artificer-toolkit/rules-runtime/character/hitPointMaximumReductions'
import { listActiveRuleEffects } from './effectStore.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

/**
 * The maximum hit points the Sheet shows, read from a Character row: the stored maximum (before
 * active-effect reductions) less the Character's active hit point maximum reductions.
 */
export async function readCharacterMaximumHitPoints(
  ctx: EncounterReadContext,
  row: Pick<EncounterDocument<'characters'>, 'id' | 'maximumHitPoints'>
) {
  return reduceHitPointMaximum(
    row.maximumHitPoints,
    listHitPointMaximumReductions(
      await listActiveRuleEffects(ctx, { kind: 'CHARACTER', characterId: row.id })
    )
  )
}
