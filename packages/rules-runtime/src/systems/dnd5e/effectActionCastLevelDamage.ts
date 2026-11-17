import type { CompiledEffectOutcome } from '@artificer-toolkit/shared/compilers'

import { selectScalingRow } from '../../scalingRowSelection.js'
import {
  Dnd5eEffectActionCompilerError,
  UUID,
  type EntryDiceDamageOutcome
} from './effectActionContracts.js'
import { damageMultiplier } from './effectActionOutcomeNodes.js'

/**
 * The dice damage rows one authored damage a held effect deals later compiles to: one typed roll, or
 * one row per cast level it scales to. Null for any other outcomes, which a later roll cannot settle
 * without the cast's facts (a bonus, half of the hit points).
 */
export function castLevelDamageRows(outcomes: readonly CompiledEffectOutcome[]) {
  const rows = outcomes.flatMap((outcome) =>
    outcome.effectKind === 'DAMAGE' &&
    outcome.valueKind === 'DICE' &&
    !outcome.bonuses?.length &&
    !('halfHitPointsDice' in outcome && outcome.halfHitPointsDice !== undefined) &&
    outcome.damageTypeId !== undefined &&
    UUID.test(outcome.damageTypeId)
      ? [outcome]
      : []
  )
  const [first] = rows
  if (!first || rows.length !== outcomes.length) return null
  if (first.scalingKind === 'NONE') return rows.length === 1 ? rows : null
  // One authored outcome compiles one row per level it scales to.
  const levelRows = rows.flatMap((row) =>
    row.scalingKind === 'PER_LEVEL' && row.scalingSource === 'SPELL_CAST_LEVEL' ? [row] : []
  )
  return levelRows.length === rows.length &&
    new Set(levelRows.map(({ level }) => level)).size === rows.length
    ? levelRows
    : null
}

/**
 * The damage at the row the cast level reaches: the cast level is the descriptor's own, so the row is
 * frozen into the held effect's graph. A scaled row the cast level does not reach is refused.
 */
export function castLevelDiceDamage(
  rows: NonNullable<ReturnType<typeof castLevelDamageRows>>,
  spellCastLevel: number | undefined
): EntryDiceDamageOutcome {
  const levelRows = rows.flatMap((row) =>
    row.scalingKind === 'PER_LEVEL' && row.scalingSource === 'SPELL_CAST_LEVEL'
      ? [{ level: row.level, order: row.order, row }]
      : []
  )
  const row =
    rows.length === 1 && rows[0]?.scalingKind === 'NONE'
      ? rows[0]
      : spellCastLevel === undefined
        ? null
        : (selectScalingRow(levelRows, spellCastLevel)?.row ?? null)
  const damageTypeId = row?.damageTypeId
  if (!row || damageTypeId === undefined)
    throw new Dnd5eEffectActionCompilerError('D&D held damage has no row at the cast level.')
  return {
    kind: 'ENTRY_DICE_DAMAGE',
    diceConfig: row.dice,
    damageTypeId,
    entryId: row.id,
    multiplier: damageMultiplier(row)
  }
}
