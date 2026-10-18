import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'
import { prepareSrdImport } from './import.js'
import { srdSpells } from './spells/index.js'

const { classes, equipment } = srdBaselineContent.subjects
const equipmentLabel = new Map(equipment.map((item) => [item.id, item.label]))

/** The class's own (not multiclass) equipment proficiencies, as sorted item labels. */
function equipmentProficiencies(classLabel: string, selectionKind: 'GRANTED' | 'CHOSEN') {
  const characterClass = classes.find((entry) => entry.label === classLabel)
  if (!characterClass) throw new Error(`SRD class "${classLabel}" is missing.`)
  return (characterClass.proficiencies ?? [])
    .flatMap((grant) =>
      grant.proficiencyKind === 'EQUIPMENT' &&
      grant.selectionKind === selectionKind &&
      'equipmentIds' in grant
        ? grant.equipmentIds.map((id) => equipmentLabel.get(id))
        : []
    )
    .sort()
}

describe('SRD equipment', () => {
  it('carries magic bonuses only as authored modifiers', () => {
    expect(equipment.filter((item) => 'maxBonus' in item)).toEqual([])
    const longswordPlusOne = equipment.find((item) => item.label === 'Longsword +1')
    expect(longswordPlusOne?.modifiers?.length).toBeGreaterThan(0)
  })

  it('rejects the retired maximum-bonus field at import', () => {
    const club = structuredClone(equipment.find((item) => item.label === 'Club')!)
    const bundle = {
      ...srdBaselineContent,
      subjects: {
        backgrounds: [],
        classes: [],
        creatures: [],
        equipment: [Object.assign(club, { maxBonus: 1 })],
        feats: [],
        races: [],
        spells: [],
        vehicles: []
      }
    }
    expect(() => prepareSrdImport(bundle)).toThrow('would change canonical source')
  })
})

describe('SRD 5.1 class weapon and tool proficiencies', () => {
  it('Bard: hand crossbows, longswords, rapiers, shortswords; three instruments of choice', () => {
    expect(equipmentProficiencies('Bard', 'GRANTED')).toEqual([
      'Hand Crossbow',
      'Longsword',
      'Rapier',
      'Shortsword'
    ])
    const bard = classes.find((entry) => entry.label === 'Bard')!
    const instruments = bard.proficiencies?.find(
      (grant) => grant.proficiencyKind === 'EQUIPMENT' && grant.selectionKind === 'CHOSEN'
    )
    expect(instruments).toMatchObject({ count: 3 })
    expect(equipmentProficiencies('Bard', 'CHOSEN')).toHaveLength(10)
  })

  it('Druid: ten named weapons and the herbalism kit', () => {
    expect(equipmentProficiencies('Druid', 'GRANTED')).toEqual([
      'Club',
      'Dagger',
      'Dart',
      'Herbalism Kit',
      'Javelin',
      'Mace',
      'Quarterstaff',
      'Scimitar',
      'Sickle',
      'Sling',
      'Spear'
    ])
  })

  it("Monk: shortswords and one artisan's tool or instrument of choice", () => {
    expect(equipmentProficiencies('Monk', 'GRANTED')).toEqual(['Shortsword'])
    const choices = equipmentProficiencies('Monk', 'CHOSEN')
    expect(choices).toContain("Smith's Tools")
    expect(choices).toContain('Lute')
    expect(choices).toHaveLength(27)
  })

  it.each(['Sorcerer', 'Wizard'])(
    '%s: daggers, darts, slings, quarterstaffs, light crossbows',
    (label) => {
      expect(equipmentProficiencies(label, 'GRANTED')).toEqual([
        'Dagger',
        'Dart',
        'Light Crossbow',
        'Quarterstaff',
        'Sling'
      ])
      // Not every simple weapon: the SRD lists these five.
      const characterClass = classes.find((entry) => entry.label === label)!
      expect(
        characterClass.proficiencies?.some(
          (grant) => grant.proficiencyKind === 'EQUIPMENT_PROPERTY'
        )
      ).toBe(false)
    }
  )
})

describe('SRD Bard Magical Secrets (SPELLS-31.T3a, D156)', () => {
  const spellLabel = new Map(srdSpells.map((spell) => [spell.id, spell.label]))
  const secrets = (classes.find((entry) => entry.label === 'Bard')?.features ?? [])
    .filter((feature) => feature.label === 'Magical Secrets')
    .map((feature) => {
      const [grant] = feature.grants?.spells ?? []
      if (grant?.selectionKind !== 'CHOSEN' || !('spellIds' in grant))
        throw new Error('Magical Secrets must be a chosen spell grant.')
      return {
        level: feature.availableAtLevel,
        count: grant.count,
        attributes: grant.attributes,
        spells: new Set(grant.spellIds.map((id) => spellLabel.get(id)))
      }
    })

  it('lets a Bard learn two spells from any class at 10th, 14th and 18th level', () => {
    expect(secrets.map(({ level, count, attributes }) => ({ level, count, attributes }))).toEqual([
      { level: 10, count: 2, attributes: ['KNOWN'] },
      { level: 14, count: 2, attributes: ['KNOWN'] },
      { level: 18, count: 2, attributes: ['KNOWN'] }
    ])
  })

  it('offers cantrips and spells of a level the Bard can cast, from other classes too', () => {
    const [tenth, fourteenth, eighteenth] = secrets.map(({ spells }) => spells)
    // Fire Bolt and Raise Dead are not Bard spells; Teleport is 7th level and Wish 9th.
    expect(['Fire Bolt', 'Raise Dead'].every((label) => tenth?.has(label))).toBe(true)
    expect(tenth?.has('Teleport')).toBe(false)
    expect(fourteenth?.has('Teleport')).toBe(true)
    expect(fourteenth?.has('Wish')).toBe(false)
    expect(eighteenth?.has('Wish')).toBe(true)
  })
})
