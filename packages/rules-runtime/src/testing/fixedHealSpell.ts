import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { cureWounds } from '@artificer-toolkit/source-data/srd/spells/cure-wounds.js'

/**
 * Makes the spell's heal an exact amount. The dnd5e Effect-action compiler cannot yet execute a heal
 * that scales per cast level, and a fixed heal carries no scaling rows, which an import refuses to drop.
 */
export function fixHeal(spell: SpellAuthored, amount: number, effectIndex = 0) {
  const path = spell.effects?.[effectIndex]?.paths?.[0]
  const outcome = path && 'resultBlock' in path ? path.resultBlock.outcomes[0] : undefined
  if (outcome?.effectKind !== 'HEAL') throw new Error('Expected a healing outcome.')
  Object.assign(outcome, { valueKind: 'FIXED', scalingKind: 'NONE', amount })
  for (const key of ['diceConfig', 'levels', 'scalingSource', 'bonuses'])
    delete (outcome as Record<string, unknown>)[key]
}

/** Lets an ACTION Effect target one creature at any distance, so it needs no Scene geometry. */
export function targetAnyCreatureAtAnyRange(spell: SpellAuthored) {
  for (const effect of spell.effects ?? []) {
    if (effect.invocation.kind !== 'ACTION') continue
    effect.invocation.range = { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' }
    effect.invocation.targeting = { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
  }
}

/** Cure Wounds with an exact one-point heal: a non-damage spell the compiler can execute. */
export function fixedHealSpell(): SpellAuthored {
  const spell: SpellAuthored = structuredClone(cureWounds)
  targetAnyCreatureAtAnyRange(spell)
  fixHeal(spell, 1)
  return spell
}
