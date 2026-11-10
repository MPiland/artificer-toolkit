import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { solar } from '@artificer-toolkit/source-data/srd/creatures/solar.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from '../tests/srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T8b (D217): the Solar's Healing Touch is written from the options a Builder author has on
 * a creature feature: a charge-limited action that heals (HEAL), ends the effects of named conditions
 * (END_EFFECTS) and leaves the curses and diseases it frees the target from to the GM
 * (MANUAL_ADJUDICATION). The feature must pass the creature node map exactly as authored, and no
 * closed rule remains in it.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)
const HEALING_TOUCH = 'Healing Touch (4/Day)'

function normalize(creature: CreatureAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId: 'creature',
    systemId: srdSystemRecord.id,
    values: structuredClone(creature) as unknown as Record<string, unknown>
  })
}

function healingTouch(creature: CreatureAuthored) {
  const found = creature.features?.find((candidate) => candidate.label === HEALING_TOUCH)
  if (!found) throw new Error('The creature must author Healing Touch.')
  return found
}

const outcomesOf = (creature: CreatureAuthored) =>
  (healingTouch(creature).effects ?? []).flatMap((effect) =>
    effect.paths.flatMap((path) =>
      path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []
    )
  )

describe('Solar Healing Touch from core options (D217)', () => {
  it('heals, ends the named conditions and leaves curse and disease to the GM, with no closed rule', async () => {
    expect(outcomesOf(solar).map(({ effectKind }) => effectKind)).toEqual([
      'HEAL',
      'END_EFFECTS',
      'MANUAL_ADJUDICATION'
    ])
    expect(JSON.stringify(healingTouch(solar))).not.toContain('CLOSED_RULE')
    expect(healingTouch(solar).charges).toMatchObject({ amount: 4 })
    const ends = outcomesOf(solar).find(({ effectKind }) => effectKind === 'END_EFFECTS')
    const conditionCodes = srdSystemRecord.conditionTypes
      .filter(({ id }) =>
        ends?.effectKind === 'END_EFFECTS'
          ? ends.selectors.some(
              (selector) => selector.kind === 'CONDITION' && selector.conditionIds.includes(id)
            )
          : false
      )
      .map(({ code }) => code)
      .sort()
    expect(conditionCodes).toEqual(['BLINDED', 'DEAFENED', 'POISONED'])
    expect(ends).toMatchObject({ scope: 'ALL' })

    const result = await normalize(solar)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(solar.features)
  })

  it('passes the creature node map unchanged for a variant that ends other conditions', async () => {
    const variant = structuredClone(solar)
    const ends = outcomesOf(variant).find(({ effectKind }) => effectKind === 'END_EFFECTS')
    if (ends?.effectKind !== 'END_EFFECTS') throw new Error('Healing Touch must end effects.')
    ends.selectors = [
      {
        kind: 'CONDITION',
        conditionIds: srdSystemRecord.conditionTypes
          .filter(({ code }) => code === 'CHARMED' || code === 'FRIGHTENED')
          .map(({ id }) => id)
      }
    ]
    const result = await normalize(variant)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(variant.features)
  })
})
