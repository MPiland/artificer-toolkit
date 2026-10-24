import { describe, expect, it } from 'vitest'

import type { CreatureAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { getValueAtPath } from '@artificer-toolkit/shared/utils'
import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { dwarf } from '@artificer-toolkit/source-data/srd/races/dwarf.js'
import { elf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { gnome } from '@artificer-toolkit/source-data/srd/races/gnome.js'
import { halfElf } from '@artificer-toolkit/source-data/srd/races/half-elf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from './nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'
import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'

/**
 * SPELLS-33.T4j and SPELLS-32.T4j (D156, D179): Magic Resistance, Gnome Cunning, Fey Ancestry,
 * Duergar and Dwarven Resilience and the angelic and hellish weapons are saving-throw advantages,
 * magical-source restrictions, condition immunities and attack traits, the options a Builder author
 * has on a creature or race feature, so each passes its node map exactly as authored with no closed
 * rule. Turn Resistance is a description with no mechanic.
 */

const reader = createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists)

function normalize(mapId: 'creature' | 'race', record: CreatureAuthored | RaceAuthored) {
  return normalizeNodeRuntimeValues(reader, {
    mapId,
    systemId: srdSystemRecord.id,
    values: structuredClone(record) as unknown as Record<string, unknown>
  })
}

function srdCreature(label: string): CreatureAuthored {
  const creature = srdCreatures.find((entry) => entry.label === label)
  if (!creature) throw new Error(`SRD Creature "${label}" is missing.`)
  return creature
}

describe('creature save qualifiers through the creature node map', () => {
  it.each([
    ['Archmage', 'Magic Resistance'],
    ['Deep Gnome (Svirfneblin)', 'Gnome Cunning'],
    ['Duergar', 'Duergar Resilience'],
    ['Drider', 'Fey Ancestry'],
    ['Drow', 'Fey Ancestry'],
    ['Deva', 'Angelic Weapons'],
    ['Planetar', 'Angelic Weapons'],
    ['Solar', 'Angelic Weapons'],
    ['Erinyes', 'Hellish Weapons'],
    ['Lich', 'Turn Resistance']
  ])('keeps the %s %s exactly as authored, with no closed rule', async (label, featureLabel) => {
    const creature = srdCreature(label)
    const feature = creature.features?.find((entry) => entry.label === featureLabel)
    expect(feature).toBeDefined()
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    const result = await normalize('creature', creature)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(creature.features)
  })
})

describe('race save qualifiers through the race node map', () => {
  it.each([
    ['Elf', elf, 'Fey Ancestry'],
    ['Half-Elf', halfElf, 'Fey Ancestry'],
    ['Gnome', gnome, 'Gnome Cunning'],
    ['Dwarf', dwarf, 'Dwarven Resilience']
  ])('keeps the %s %s exactly as authored, with no closed rule', async (_, race, featureLabel) => {
    const feature = race.features?.find((entry) => entry.label === featureLabel)
    expect(feature?.grants?.modifiers?.length).toBeGreaterThan(0)
    expect(JSON.stringify(feature)).not.toContain('CLOSED_RULE')
    const result = await normalize('race', race)
    expect(result.clearedPaths).toEqual([])
    expect(getValueAtPath(result.values, ['features'])).toEqual(race.features)
  })
})
