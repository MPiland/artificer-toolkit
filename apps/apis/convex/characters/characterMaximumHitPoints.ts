import {
  listHitPointMaximumReductions,
  reduceHitPointMaximum
} from '@artificer-toolkit/rules-runtime/character/hitPointMaximumReductions'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { listActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'

/**
 * The maximum hit points the Sheet shows, read from a Character row: the stored maximum (before
 * active-effect reductions) less the Character's active hit point maximum reductions.
 */
export async function readCharacterMaximumHitPoints(
  ctx: QueryCtx,
  row: Pick<Doc<'characters'>, 'id' | 'maximumHitPoints'>
) {
  return reduceHitPointMaximum(
    row.maximumHitPoints,
    listHitPointMaximumReductions(
      await listActiveRuleEffects(ctx, { kind: 'CHARACTER', characterId: row.id })
    )
  )
}
