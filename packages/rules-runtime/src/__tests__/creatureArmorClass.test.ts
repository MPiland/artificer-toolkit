import {
  compileResolvedEquipment,
  resolveEquipmentAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { EquipmentSlotCode } from '@artificer-toolkit/shared/core'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { describe, expect, it } from 'vitest'

import { resolveDnd5eCreatureArmorClass } from '../systems/dnd5e/armorClass.js'
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
  if (!result.ok) throw new Error(result.reason)
  return result.armorClass
}

const goblin = { dexterityScore: 14, naturalArmorBonus: 0 }

describe('resolveDnd5eCreatureArmorClass', () => {
  it('adds the natural armor bonus to 10 plus Dexterity', () => {
    expect(
      armorClassOf({
        dexterityScore: 15,
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
        dexterityScore: 18,
        naturalArmorBonus: 0,
        equipment: [entry('Scale Mail', 'WORN')]
      })
    ).toBe(16)
    expect(
      armorClassOf({
        dexterityScore: 18,
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

  it('returns a failure for a modifier whose restriction is not the while-equipped form', () => {
    const shield = entry('Shield +1', 'OFF_HAND')
    const [modifier] = shield.compiled.modifiers ?? []
    if (!modifier) throw new Error('Expected the magic shield to carry a modifier.')
    const result = resolveDnd5eCreatureArmorClass({
      ...goblin,
      equipment: [
        {
          ...shield,
          compiled: { ...shield.compiled, modifiers: [{ ...modifier, restrictions: undefined }] }
        }
      ]
    })
    expect(result).toEqual({
      ok: false,
      equipmentId: shield.compiled.id,
      reason: expect.stringMatching(/while-equipped/)
    })
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

  function character(equipment: readonly EquipmentAuthored[]) {
    return evaluateSrdCharacter({
      abilities: { DEXTERITY: goblin.dexterityScore },
      classes: [{ label: 'Fighter', level: 1 }],
      items: equipment.map(({ label }) => ({ label, equipped: true })),
      extraEquipment: equipment.filter(({ label }) => label.startsWith('Unrated'))
    }).output.derivedStats.armorClass.effective
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
      armorClass: character(equipment)
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
    expect(() => character([document])).toThrow(refusal.ok ? 'expected a refusal' : refusal.reason)
  })
})
