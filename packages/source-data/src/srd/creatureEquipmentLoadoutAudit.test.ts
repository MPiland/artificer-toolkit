import type { CreatureEquipmentLoadoutEntryDto } from '@artificer-toolkit/schema/subjects/creature'
import { describe, expect, it } from 'vitest'
import { auditCreatureEquipmentLoadouts } from './audit.js'
import { srdBaselineContent } from './index.js'

const { creatures, equipment } = srdBaselineContent.subjects
const goblin = creatures.find((creature) => creature.label === 'Goblin')
if (!goblin?.equipmentLoadout) throw new Error('The SRD Goblin has no loadout.')
const goblinLoadout = goblin.equipmentLoadout
const equipmentIdOf = (label: string) => {
  const record = equipment.find((candidate) => candidate.label === label)
  if (!record) throw new Error(`SRD Equipment ${label} is missing.`)
  return record.id
}
const entryOf = (label: string) => {
  const entry = goblinLoadout.find(
    (candidate) => equipment.find((record) => record.id === candidate.equipmentId)?.label === label
  )
  if (!entry) throw new Error(`The Goblin loadout has no ${label}.`)
  return entry
}

function auditGoblin(
  edit: (entry: CreatureEquipmentLoadoutEntryDto) => CreatureEquipmentLoadoutEntryDto,
  extra: CreatureEquipmentLoadoutEntryDto[] = []
) {
  return auditCreatureEquipmentLoadouts(
    [{ ...goblin, equipmentLoadout: [...goblinLoadout.map(edit), ...extra] }],
    equipment
  ).map(({ domain, id, issue, paths }) => ({ domain, id, issue, paths }))
}

const failing = (issue: string, paths: string[]) => [
  { domain: 'creature-equipment', id: goblin.id, issue, paths }
]

describe('SRD Creature equipment loadout audit', () => {
  it('passes every SRD Creature loadout, the Goblin included', () => {
    expect(auditCreatureEquipmentLoadouts(creatures, equipment)).toEqual([])
    expect(auditGoblin((entry) => entry)).toEqual([])
  })

  it('names a loadout entry that binds missing Equipment', () => {
    const scimitar = entryOf('Scimitar')
    expect(
      auditGoblin((entry) =>
        entry.id === scimitar.id ? { ...entry, equipmentId: crypto.randomUUID() } : entry
      )
    ).toEqual(failing('loadout binds missing Equipment', [scimitar.id]))
  })

  it('names a two-handed weapon whose main hand blocks a held off-hand item', () => {
    const scimitar = entryOf('Scimitar')
    const shortbow = entryOf('Shortbow')
    expect(
      auditGoblin((entry) =>
        entry.id === scimitar.id
          ? { ...entry, useState: 'CARRIED' }
          : entry.id === shortbow.id
            ? { ...entry, useState: 'MAIN_HAND' }
            : entry
      )
    ).toEqual(
      failing('loadout hand conflict: A two-handed main-hand item blocks the off hand.', [
        entryOf('Shield').id
      ])
    )
  })

  it('names worn armor held in a hand and a held weapon that is worn', () => {
    const shield = entryOf('Shield')
    const leather = entryOf('Leather Armor')
    const scimitar = entryOf('Scimitar')
    expect(
      auditGoblin((entry) =>
        entry.id === shield.id
          ? { ...entry, useState: 'CARRIED' }
          : entry.id === leather.id
            ? { ...entry, useState: 'OFF_HAND' }
            : entry.id === scimitar.id
              ? { ...entry, useState: 'WORN' }
              : entry
      )
    ).toEqual(
      failing('loadout holds an item that is not a weapon or shield, or wears one that is', [
        scimitar.id,
        leather.id
      ])
    )
  })

  it('names worn armor that binds an action Feature', () => {
    const scimitar = entryOf('Scimitar')
    const leather = entryOf('Leather Armor')
    expect(
      auditGoblin((entry) =>
        entry.id === scimitar.id
          ? { ...entry, actionFeatureIds: [] }
          : entry.id === leather.id
            ? { ...entry, actionFeatureIds: scimitar.actionFeatureIds }
            : entry
      )
    ).toEqual(failing('loadout armor binds an action Feature', [leather.id]))
  })

  it('names a Creature wearing more than one armor', () => {
    const leather = entryOf('Leather Armor')
    const secondArmor = {
      ...leather,
      id: crypto.randomUUID(),
      equipmentId: equipmentIdOf('Hide Armor')
    }
    expect(auditGoblin((entry) => entry, [secondArmor])).toEqual(
      failing('loadout wears more than one armor', [leather.id, secondArmor.id])
    )
  })
})
