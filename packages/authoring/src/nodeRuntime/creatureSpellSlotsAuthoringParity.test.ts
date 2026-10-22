import { describe, expect, it } from 'vitest'

import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { cultFanatic } from '@artificer-toolkit/source-data/srd/creatures/cult-fanatic.js'
import { druid } from '@artificer-toolkit/source-data/srd/creatures/druid.js'
import { guardianNaga } from '@artificer-toolkit/source-data/srd/creatures/guardian-naga.js'
import { gynosphinx } from '@artificer-toolkit/source-data/srd/creatures/gynosphinx.js'
import { lich } from '@artificer-toolkit/source-data/srd/creatures/lich.js'
import { mage } from '@artificer-toolkit/source-data/srd/creatures/mage.js'
import { mummyLord } from '@artificer-toolkit/source-data/srd/creatures/mummy-lord.js'
import { priest } from '@artificer-toolkit/source-data/srd/creatures/priest.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eVocabularyCapabilityAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/vocabulary'

/**
 * SPELLS-33 T3b: a slotted caster authors its Spellcasting as a cantrip grant plus one PREPARED
 * SPELL_GRANT per spell level, with the slots as one long-rest table on the feature (the options a Builder
 * author has on a creature feature). The feature keeps the stat-block text, so the GM still reads the
 * save DC, attack bonus, spell list and slots; each grant is checked against that text.
 */

const reader = createSrdNodeRuntimeReader(dnd5eVocabularyCapabilityAdapter.lists)

const casters: ReadonlyArray<readonly [string, CreatureAuthored]> = [
  ['Cult Fanatic', cultFanatic],
  ['Druid', druid],
  ['Guardian Naga', guardianNaga],
  ['Gynosphinx', gynosphinx],
  ['Lich', lich],
  ['Mage', mage],
  ['Mummy Lord', mummyLord],
  ['Priest', priest]
]

function spellcasting(creature: CreatureAuthored) {
  const feature = creature.features?.find(({ label }) => label === 'Spellcasting')
  if (!feature) throw new Error('The caster must author Spellcasting.')
  return feature
}

function spellGrants(creature: CreatureAuthored) {
  return (spellcasting(creature).grants?.spells ?? []).map((grant) => {
    if (
      grant.selectionKind !== 'GRANTED' ||
      grant.scalingKind !== 'NONE' ||
      grant.authoringModeKind !== 'SELECTED'
    )
      throw new Error('A caster grants its listed spells outright and unscaled.')
    return { ...grant, charges: 'charges' in grant ? grant.charges : undefined }
  })
}

/** The "Nth level (K slots)" clauses of the stat-block text, by level. */
function describedSlots(description: string) {
  return [...description.matchAll(/(\d+)(?:st|nd|rd|th) level \((\d+) slots?\)/g)].map(
    ([, level, slots]) => ({ level: Number(level), slots: Number(slots) })
  )
}

describe.each(casters)(
  '%s Spellcasting through the creature node map (SPELLS-33 T3b)',
  (_, creature) => {
    it('keeps the grants exactly as authored, with no closed rule', async () => {
      expect(JSON.stringify(spellcasting(creature))).not.toContain('CLOSED_RULE')
      const result = await normalizeNodeRuntimeValues(reader, {
        mapId: 'creature',
        systemId: srdSystemRecord.id,
        values: structuredClone(creature) as unknown as Record<string, unknown>
      })
      expect(result.clearedPaths).toEqual([])
      expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
    })

    it('casts from one long-rest slot table, sized as the stat block says', () => {
      const { description } = spellcasting(creature)
      const table = spellcasting(creature).grants?.spellSlots
      expect(table?.resetKind).toBe('LONG_REST')
      expect(table?.levels.map(({ level, amount }) => ({ level, slots: amount }))).toEqual(
        describedSlots(description ?? '')
      )
      const slotted = spellGrants(creature).slice(1)
      expect(slotted.length).toBe(table?.levels.length)
      const spellLevelById = new Map(srdSpells.map((spell) => [spell.id, spell.level]))
      for (const [index, grant] of slotted.entries()) {
        expect(grant.attributes).toEqual(['PREPARED'])
        expect(grant.charges).toBeUndefined()
        // A grant records no level of its own: a cast reads the spell's catalog level and spends a
        // slot of that level or higher, so each listed spell must sit at its table row's level.
        expect(grant.spellIds.map((id) => spellLevelById.get(id))).toEqual(
          grant.spellIds.map(() => table?.levels[index].level)
        )
      }
    })

    it('keeps cantrips at will and every grant on one casting ability and unique ids', () => {
      const spells = spellGrants(creature)
      const [cantrips] = spells
      expect(cantrips.attributes).toEqual(['PREPARED', 'CAST_AT_WILL'])
      expect(new Set(spells.map(({ castingAbility }) => castingAbility)).size).toBe(1)
      const table = spellcasting(creature).grants?.spellSlots
      const ids = [
        ...spells.map(({ id }) => id),
        ...(table ? [table.id, ...table.levels.map(({ id }) => id)] : [])
      ]
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('shows the GM the save DC, attack bonus, slots and each granted spell on the feature', () => {
      const { description } = spellcasting(creature)
      expect(description).toMatch(/spell save DC \d+, \+\d+ to hit with spell attacks/)
      expect(description?.toLowerCase()).toContain('cantrips (at will)')
      expect(spellGrants(creature).flatMap(({ spellIds }) => spellIds).length).toBeGreaterThan(0)
      expect(describedSlots(description ?? '').length).toBeGreaterThan(0)
    })
  }
)
