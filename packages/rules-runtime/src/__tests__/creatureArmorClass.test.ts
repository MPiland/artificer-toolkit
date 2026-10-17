import {
  compileResolvedEquipment,
  resolveEquipmentAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentSlotCode } from '@artificer-toolkit/shared/core'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { describe, expect, it } from 'vitest'

import { resolveDnd5eCreatureArmorClass } from '../systems/dnd5e/armorClass.js'

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
