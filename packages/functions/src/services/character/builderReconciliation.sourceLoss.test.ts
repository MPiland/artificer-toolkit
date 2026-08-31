import { describe, expect, it } from 'vitest'
import { CharacterStartingEquipmentSource } from '@artificer-toolkit/shared/subjects/authored'

import { createEmptyCharacterAuthored } from './builderService.js'
import {
  characterReferencesAuthoredRoot,
  reconcileCharacterAuthoredSourceLoss
} from './builderReconciliation.js'

const ids = {
  character: '00000000-0000-4000-8000-000000000001',
  user: '00000000-0000-4000-8000-000000000002',
  system: '00000000-0000-4000-8000-000000000003',
  spell: '00000000-0000-4000-8000-000000000004',
  race: '00000000-0000-4000-8000-000000000005',
  class: '00000000-0000-4000-8000-000000000006',
  equipment: '00000000-0000-4000-8000-000000000007',
  item: '00000000-0000-4000-8000-000000000008',
  childItem: '00000000-0000-4000-8000-000000000009',
  creature: '00000000-0000-4000-8000-000000000010',
  creatureInstance: '00000000-0000-4000-8000-000000000011',
  vehicle: '00000000-0000-4000-8000-000000000012',
  vehicleInstance: '00000000-0000-4000-8000-000000000013',
  background: '00000000-0000-4000-8000-000000000016',
  feat: '00000000-0000-4000-8000-000000000017',
  subclass: '00000000-0000-4000-8000-000000000018',
  subrace: '00000000-0000-4000-8000-000000000019',
  secondaryClass: '00000000-0000-4000-8000-000000000022'
}

function character() {
  const value = createEmptyCharacterAuthored({
    id: ids.character,
    userId: ids.user,
    primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000014',
    systemId: ids.system
  })
  value.status = 'ACTIVE'
  value.intent.race.raceId = ids.race
  value.intent.classes = [{ classId: ids.class, classLevel: 1 }]
  value.intent.hitpoints.levels = [{ classId: ids.class, level: 1, classLevel: 1, value: 8 }]
  value.intent.spellSelections = [
    {
      id: '00000000-0000-4000-8000-000000000015',
      source: { kind: 'CLASS', classId: ids.class },
      timing: { kind: 'CLASS_LEVEL', classId: ids.class, classLevel: 1 },
      spells: [ids.spell]
    }
  ]
  value.state.classes = [
    { classId: ids.class, spells: { learned: [ids.spell], prepared: [ids.spell] } }
  ]
  value.state.equipment.inventory = [
    {
      id: ids.item,
      equipmentId: ids.equipment,
      quantity: 1
    },
    {
      id: ids.childItem,
      equipmentId: '00000000-0000-4000-8000-000000000014',
      containerId: ids.item,
      quantity: 1
    }
  ]
  value.state.equipment.equipped = [ids.item]
  value.state.equipment.attuned = [ids.item]
  value.state.creatures = [
    {
      id: ids.creatureInstance,
      creatureId: ids.creature,
      relationshipKind: 'COMPANION',
      originKind: 'WORLD'
    }
  ]
  value.state.vehicles = [{ id: ids.vehicleInstance, vehicleId: ids.vehicle }]
  return value
}

describe('Character authored source loss', () => {
  it('removes a Spell from intent and committed class state without mutating the source', () => {
    const source = character()
    const next = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'SPELL',
      subjectId: ids.spell
    })

    expect(next.intent.spellSelections).toBeUndefined()
    expect(next.state.classes?.[0]).not.toHaveProperty('spells')
    expect(source.intent.spellSelections?.[0]?.spells).toEqual([ids.spell])
    expect(
      characterReferencesAuthoredRoot(source, { subjectKind: 'SPELL', subjectId: ids.spell })
    ).toBe(true)
  })

  it('makes required Race or Class structure explicitly incomplete', () => {
    const source = character()
    const withoutRace = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'RACE',
      subjectId: ids.race
    })
    const withoutClass = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'CLASS',
      subjectId: ids.class
    })

    expect(withoutRace.intent.race.raceId).toBe('')
    expect(withoutClass.intent.classes).toEqual([])
    expect(withoutClass.intent.hitpoints.levels).toEqual([])
    expect(withoutClass.state.classes).toBeUndefined()
  })

  it('removes unavailable Equipment while preserving nested contents at inventory root', () => {
    const next = reconcileCharacterAuthoredSourceLoss(character(), {
      subjectKind: 'EQUIPMENT',
      subjectId: ids.equipment
    })

    expect(next.state.equipment.inventory).toEqual([expect.objectContaining({ id: ids.childItem })])
    expect(next.state.equipment.inventory[0]).not.toHaveProperty('containerId')
    expect(next.state.equipment.equipped).toEqual([])
    expect(next.state.equipment.attuned).toEqual([])
  })

  it('removes Creature and Vehicle instances by definition without touching unrelated structure', () => {
    const withoutCreature = reconcileCharacterAuthoredSourceLoss(character(), {
      subjectKind: 'CREATURE',
      subjectId: ids.creature
    })
    const withoutVehicle = reconcileCharacterAuthoredSourceLoss(character(), {
      subjectKind: 'VEHICLE',
      subjectId: ids.vehicle
    })

    expect(withoutCreature.state.creatures).toBeUndefined()
    expect(withoutCreature.state.vehicles).toHaveLength(1)
    expect(withoutVehicle.state.vehicles).toBeUndefined()
    expect(withoutVehicle.state.creatures).toHaveLength(1)
  })

  it('clears Background and Feat references through their exact provenance', () => {
    const source = character()
    source.intent.background.backgroundId = ids.background
    source.intent.featureAcquisitions.push({
      id: '00000000-0000-4000-8000-000000000020',
      featureId: '00000000-0000-4000-8000-000000000021',
      source: { kind: 'FEAT', featId: ids.feat },
      timing: { kind: 'IMMEDIATE' }
    })

    const withoutBackground = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'BACKGROUND',
      subjectId: ids.background
    })
    const withoutFeat = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'FEAT',
      subjectId: ids.feat
    })

    expect(withoutBackground.intent.background.backgroundId).toBe('')
    expect(withoutFeat.intent.featureAcquisitions).toEqual([])
  })

  it('removes only the selected Subrace or Subclass when its base remains available', () => {
    const source = character()
    source.intent.race.subraceId = ids.subrace
    source.intent.classes[0] = { ...source.intent.classes[0]!, subclassId: ids.subclass }

    const withoutSubrace = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'RACE',
      subjectId: ids.subrace
    })
    const withoutSubclass = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'CLASS',
      subjectId: ids.subclass
    })

    expect(withoutSubrace.intent.race).toEqual({ raceId: ids.race })
    expect(withoutSubclass.intent.classes).toEqual([{ classId: ids.class, classLevel: 1 }])
  })

  it('preserves primary-class starting equipment when only a secondary class is removed', () => {
    const source = character()
    source.intent.classes.push({ classId: ids.secondaryClass, classLevel: 1 })
    source.intent.hitpoints.levels.push({
      classId: ids.secondaryClass,
      level: 2,
      classLevel: 1,
      value: 6
    })
    source.intent.startingEquipment = {
      class: { source: CharacterStartingEquipmentSource.CLASS, tookGold: false }
    }

    const active = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'CLASS',
      subjectId: ids.secondaryClass
    })
    const draftSource = structuredClone(source)
    draftSource.status = 'DRAFT'
    const draft = reconcileCharacterAuthoredSourceLoss(draftSource, {
      subjectKind: 'CLASS',
      subjectId: ids.secondaryClass
    })

    expect(active.intent.startingEquipment?.class).toEqual(source.intent.startingEquipment.class)
    expect(draft.intent.startingEquipment?.class).toEqual(source.intent.startingEquipment.class)
  })

  it('clears primary-class starting equipment when the primary class is removed', () => {
    const source = character()
    source.intent.classes.push({ classId: ids.secondaryClass, classLevel: 1 })
    source.intent.startingEquipment = {
      class: { source: CharacterStartingEquipmentSource.CLASS, tookGold: false }
    }

    const next = reconcileCharacterAuthoredSourceLoss(source, {
      subjectKind: 'CLASS',
      subjectId: ids.class
    })

    expect(next.intent.startingEquipment).toBeUndefined()
    expect(next.intent.classes).toEqual([{ classId: ids.secondaryClass, classLevel: 1 }])
  })
})
