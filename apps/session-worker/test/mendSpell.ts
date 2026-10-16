import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { cureWounds } from '@artificer-toolkit/source-data/srd/spells/cure-wounds.js'

import { testUuid } from '../src/testing/liveCaptureFixture.js'

/** Cure Wounds with no Scene geometry, so it upcasts at every slot the caster has. */
export const unlimitedCureWounds: SpellAuthored = (() => {
  const spell = structuredClone(cureWounds)
  for (const effect of spell.effects ?? []) {
    if (effect.invocation.kind !== 'ACTION') continue
    effect.invocation.range = { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' }
    effect.invocation.targeting = { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
  }
  return spell
})()

/** Cure Wounds with no Scene geometry, healing a fixed 2. */
export const mend: SpellAuthored = (() => {
  const spell = structuredClone(unlimitedCureWounds)
  const path = spell.effects?.[0]?.paths?.[0]
  const outcome = path && 'resultBlock' in path ? path.resultBlock.outcomes?.[0] : undefined
  if (outcome?.effectKind !== 'HEAL') throw new Error('Cure Wounds heals.')
  Object.assign(outcome, { valueKind: 'FIXED', scalingKind: 'NONE', amount: 2 })
  for (const key of ['diceConfig', 'levels', 'scalingSource', 'bonuses'])
    delete (outcome as Record<string, unknown>)[key]
  return { ...spell, id: testUuid(0x7c5), label: 'Mend', level: 1 }
})()

/** Cure Wounds with no Scene geometry, healing a fixed amount equal to the level it is cast at, so no dice are rolled. */
export const levelledMend: SpellAuthored = (() => {
  const spell = structuredClone(unlimitedCureWounds)
  const path = spell.effects?.[0]?.paths?.[0]
  const outcome = path && 'resultBlock' in path ? path.resultBlock.outcomes?.[0] : undefined
  if (outcome?.effectKind !== 'HEAL' || outcome.scalingKind !== 'PER_LEVEL')
    throw new Error('Cure Wounds heals per level.')
  Object.assign(outcome, { valueKind: 'FIXED' })
  for (const step of outcome.levels) {
    Object.assign(step, { amount: step.level })
    delete (step as Record<string, unknown>).diceConfig
  }
  return { ...spell, id: testUuid(0x7c6), label: 'Levelled Mend' }
})()
