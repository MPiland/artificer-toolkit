import {
  compileResolvedEquipment,
  resolveEquipmentAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { EquipmentSlotCode } from '@artificer-toolkit/shared/core'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { describe, expect, it } from 'vitest'

import { resolveDnd5eCreatureArmorClass } from '../systems/dnd5e/characterVitals.js'
import { evaluateSrdCharacter } from '../testing/dnd5eSrdCharacter.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const equipmentById = new Map(srdEquipment.map((document) => [document.id, document]))

function srd(label: string) {
  const document = srdEquipment.find((candidate) => candidate.label === label)
  if (!document) throw new Error(`SRD Equipment "${label}" is missing.`)
  return document
}

function entry(label: string, useState: EquipmentSlotCode, id = `${label}:${useState}`) {
  return {
    id,
    useState,
    compiled: compileResolvedEquipment(
      resolveEquipmentAuthored(srd(label), (parentId) => equipmentById.get(parentId))
    )
  }
}

function armorClassOf(input: Parameters<typeof resolveDnd5eCreatureArmorClass>[0]): number {
  const result = resolveDnd5eCreatureArmorClass(input)
  if (result === null) throw new Error('Expected a Dexterity score.')
  if (!result.ok) throw new Error(result.reason)
  return result.armorClass
}

/** A Fighter's Armor Class with `equipment` equipped and `carried` unequipped; Equipment beyond the
 * SRD is registered. */
function characterArmorClass(
  abilities: { DEXTERITY: number },
  equipment: readonly EquipmentAuthored[],
  carried: readonly EquipmentAuthored[] = []
): number {
  const owned = [...equipment, ...carried]
  return evaluateSrdCharacter({
    abilities,
    classes: [{ label: 'Fighter', level: 1 }],
    items: owned.map(({ label }, index) => ({ label, equipped: index < equipment.length })),
    extraEquipment: owned.filter((document) => !srdEquipment.includes(document))
  }).output.derivedStats.armorClass.effective
}

const goblin = { abilityScores: { DEXTERITY: 14 }, naturalArmorBonus: 0 }

describe('resolveDnd5eCreatureArmorClass', () => {
  it('adds the natural armor bonus to 10 plus Dexterity', () => {
    expect(
      armorClassOf({
        abilityScores: { DEXTERITY: 15 },
        naturalArmorBonus: 1,
        equipment: []
      })
    ).toBe(13)
  })

  it('combines worn light armor and a held shield', () => {
    expect(
      armorClassOf({
        ...goblin,
        equipment: [entry('Leather Armor', 'WORN'), entry('Shield', 'OFF_HAND')]
      })
    ).toBe(15)
  })

  it('counts a magic shield variant its own bonus', () => {
    expect(
      armorClassOf({
        ...goblin,
        equipment: [entry('Leather Armor', 'WORN'), entry('Shield +1', 'OFF_HAND')]
      })
    ).toBe(16)
  })

  it('counts a shield only while it is in a hand', () => {
    for (const slot of ['CARRIED', 'WORN'] as const) {
      expect(
        armorClassOf({
          ...goblin,
          equipment: [entry('Leather Armor', 'WORN'), entry('Shield', slot)]
        })
      ).toBe(13)
    }
  })

  it('counts one shield when two are held', () => {
    expect(
      armorClassOf({
        ...goblin,
        equipment: [
          entry('Leather Armor', 'WORN'),
          entry('Shield', 'MAIN_HAND'),
          entry('Shield', 'OFF_HAND')
        ]
      })
    ).toBe(15)
  })

  // QUALITY-1.T1: a Creature took the main hand's shield; D107 counts the one that adds the most.
  it('counts the held shield that adds the most, as a Character does', () => {
    expect(
      armorClassOf({
        ...goblin,
        equipment: [
          entry('Leather Armor', 'WORN'),
          entry('Shield', 'MAIN_HAND'),
          entry('Shield +1', 'OFF_HAND')
        ]
      })
    ).toBe(16)
  })

  it('caps Dexterity for medium armor and ignores it for heavy armor', () => {
    expect(
      armorClassOf({
        abilityScores: { DEXTERITY: 18 },
        naturalArmorBonus: 0,
        equipment: [entry('Scale Mail', 'WORN')]
      })
    ).toBe(16)
    expect(
      armorClassOf({
        abilityScores: { DEXTERITY: 18 },
        naturalArmorBonus: 0,
        equipment: [entry('Chain Mail', 'WORN')]
      })
    ).toBe(16)
  })

  it('counts armor only when it is worn', () => {
    expect(
      armorClassOf({
        ...goblin,
        equipment: [entry('Leather Armor', 'CARRIED')]
      })
    ).toBe(12)
  })

  // ATTACK-6.T4a: a Creature folds Equipment as a Character does, so an unrestricted modifier on a
  // held item applies instead of refusing the Creature's Armor Class.
  it('applies a held magic shield modifier that carries no restriction', () => {
    const shield = entry('Shield +1', 'OFF_HAND')
    const [modifier] = shield.compiled.modifiers ?? []
    if (!modifier) throw new Error('Expected the magic shield to carry a modifier.')
    expect(
      armorClassOf({
        ...goblin,
        equipment: [
          {
            ...shield,
            compiled: { ...shield.compiled, modifiers: [{ ...modifier, restrictions: undefined }] }
          }
        ]
      })
    ).toBe(15)
  })

  it('has no Armor Class without a Dexterity score', () => {
    expect(
      resolveDnd5eCreatureArmorClass({ abilityScores: {}, naturalArmorBonus: 0, equipment: [] })
    ).toBeNull()
  })

  it('returns a failure for worn armor or a held shield without an armor class', () => {
    for (const [label, slot] of [
      ['Leather Armor', 'WORN'],
      ['Shield', 'OFF_HAND']
    ] as const) {
      const item = entry(label, slot)
      const { armorClass: _omitted, ...compiled } = item.compiled
      expect(
        resolveDnd5eCreatureArmorClass({
          ...goblin,
          equipment: [{ ...item, compiled }]
        })
      ).toMatchObject({ ok: false, equipmentId: item.compiled.id })
    }
  })
})

/**
 * ATTACK-6.3: a Creature folds its loadout through the Character grant fold and Armor Class path,
 * so a magic item's bonus and its source-state restriction decide alike for both.
 */
describe('a Character and a Creature with the same magic item (ATTACK-6.3)', () => {
  const abilityScores = { DEXTERITY: 16 }

  function creature(
    items: readonly { document: EquipmentAuthored; useState: EquipmentSlotCode }[]
  ) {
    return armorClassOf({
      abilityScores,
      naturalArmorBonus: 0,
      equipment: items.map(({ document, useState }, index) => ({
        id: `${document.id}:${index}`,
        useState,
        compiled: compileResolvedEquipment(
          resolveEquipmentAuthored(document, (parentId) => equipmentById.get(parentId))
        )
      }))
    })
  }

  /** An SRD magic item whose modifiers apply only while the holder wears armor. */
  function onlyWhileWearingArmor(label: string): EquipmentAuthored {
    const document = srd(label)
    if (!('modifiers' in document) || !document.modifiers?.length)
      throw new Error(`SRD Equipment "${label}" carries no modifier.`)
    return {
      ...document,
      id: testUuid(0x5e0),
      label: `Armor-bound ${label}`,
      modifiers: document.modifiers.map((modifier, index) => ({
        ...modifier,
        restrictions: {
          id: testUuid(0x5e1 + index * 4),
          groups: [
            {
              id: testUuid(0x5e2 + index * 4),
              order: 0,
              contexts: [
                {
                  id: testUuid(0x5e3 + index * 4),
                  order: 0,
                  subject: 'CHARACTER',
                  conditions: [
                    {
                      id: testUuid(0x5e4 + index * 4),
                      order: 0,
                      kind: 'PREDICATE',
                      constraint: 'INCLUDE',
                      predicateCode: 'EQUIPMENT_EQUIPPED',
                      authoringModeKind: 'ALL',
                      category: 'ARMOR'
                    }
                  ]
                }
              ]
            }
          ]
        }
      }))
    } as EquipmentAuthored
  }

  it('gives both the same Armor Class for magic armor and a magic shield', () => {
    const armor = srd('Breastplate +2')
    const shield = srd('Shield +1')
    expect(creature([{ document: armor, useState: 'WORN' }])).toBe(18)
    expect(characterArmorClass(abilityScores, [armor])).toBe(18)
    expect(
      creature([
        { document: armor, useState: 'WORN' },
        { document: shield, useState: 'OFF_HAND' }
      ])
    ).toBe(21)
    expect(characterArmorClass(abilityScores, [armor, shield])).toBe(21)
  })

  // D152 as amended for ATTACK-6.T4a: an item's "while equipped" restriction names the source, so
  // it decides alike for either holder.
  it('applies a while-equipped magic bonus to both and refuses it for both while carried', () => {
    const shield = srd('Shield +1')
    expect(creature([{ document: shield, useState: 'OFF_HAND' }])).toBe(16)
    expect(characterArmorClass(abilityScores, [shield])).toBe(16)
    expect(creature([{ document: shield, useState: 'CARRIED' }])).toBe(13)
    expect(characterArmorClass(abilityScores, [], [shield])).toBe(13)
  })

  // D152: a restriction on the holder ("while you wear armor") in a Character context gates on the
  // holder's kind, so it never holds for a Creature.
  it('refuses a Character-context holder restriction on a Creature', () => {
    const shield = onlyWhileWearingArmor('Shield +1')
    const leather = srd('Leather Armor')
    expect(creature([{ document: shield, useState: 'OFF_HAND' }])).toBe(15)
    expect(characterArmorClass(abilityScores, [shield])).toBe(15)
    expect(
      creature([
        { document: leather, useState: 'WORN' },
        { document: shield, useState: 'OFF_HAND' }
      ])
    ).toBe(16)
    expect(characterArmorClass(abilityScores, [leather, shield])).toBe(17)
  })
})

/**
 * D143: one Armor Class path for Characters and Creatures. Equipment stored before Armor Class was
 * required may lack it; both refuse it alike instead of a Character guessing 10 or 2.
 */
describe('a Character and a Creature holding the same equipment (D143)', () => {
  /** An SRD record as stored before D143, without its Armor Class, under its own id. */
  function unrated(label: string, id: string): EquipmentAuthored {
    const authored = srd(label)
    if (authored.category !== 'ARMOR' && authored.category !== 'SHIELD')
      throw new Error(`SRD Equipment "${label}" is not armor or a shield.`)
    const { armorClass: _omitted, ...document } = authored
    return { ...document, id, label: `Unrated ${label}` } as EquipmentAuthored
  }

  const cases = [
    { label: 'Leather Armor', useState: 'WORN' },
    { label: 'Shield', useState: 'OFF_HAND' }
  ] as const

  function creature(equipment: readonly EquipmentAuthored[], useStates: EquipmentSlotCode[]) {
    return resolveDnd5eCreatureArmorClass({
      ...goblin,
      equipment: equipment.map((document, index) => ({
        id: `${document.id}:${index}`,
        useState: useStates[index]!,
        compiled: compileResolvedEquipment(
          resolveEquipmentAuthored(document, (parentId) => equipmentById.get(parentId))
        )
      }))
    })
  }

  it('gives both the same Armor Class for authored armor and a shield', () => {
    const equipment = cases.map(({ label }) => srd(label))
    expect(
      creature(
        equipment,
        cases.map(({ useState }) => useState)
      )
    ).toEqual({
      ok: true,
      armorClass: characterArmorClass(goblin.abilityScores, equipment)
    })
  })

  it.each(cases)('refuses both for $label without an Armor Class', ({ label, useState }) => {
    const document = unrated(label, testUuid(label === 'Shield' ? 0x5d1 : 0x5d2))
    const refusal = creature([document], [useState])
    expect(refusal).toEqual({
      ok: false,
      equipmentId: document.id,
      reason: `Equipment "${document.id}" is armor or a shield without an armor class.`
    })
    expect(() => characterArmorClass(goblin.abilityScores, [document])).toThrow(
      refusal?.ok === false ? refusal.reason : 'expected a refusal'
    )
  })
})
