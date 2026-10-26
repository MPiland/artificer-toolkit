import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { EquipmentSlotCode } from '@artificer-toolkit/shared/core'
import {
  compileResolvedEquipment,
  resolveEquipmentAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { greatclub } from '@artificer-toolkit/source-data/srd/equipment/greatclub.js'
import { greatclubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/greatclub-plus-1.js'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { SRD_ABILITIES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { featureActionMechanic } from '../encounterFeatureActionCapabilityDiscovery.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { resolveDnd5eCreatureWeaponBonuses } from '../systems/dnd5e/creatureFeatureGrantFold.js'
import { resolveCreatureDamageExpression } from '../systems/dnd5e/effectActionCompiler.js'
import { damageExpression, evaluateSrdCharacter, itemAction } from '../testing/dnd5eSrdCharacter.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'

const equipmentById = new Map(srdEquipment.map((document) => [document.id, document]))

function entry(label: string, useState: EquipmentSlotCode) {
  const document = srdEquipment.find((candidate) => candidate.label === label)
  if (!document) throw new Error(`SRD Equipment "${label}" is missing.`)
  return {
    id: `${label}:${useState}`,
    useState,
    compiled: compileResolvedEquipment(
      resolveEquipmentAuthored(document, (parentId) => equipmentById.get(parentId))
    )
  }
}

/** A STR 16 Fighter's one-handed attack with `label`: its attack bonus and damage bonus. */
function characterAttack(label: string) {
  const { decision } = itemAction(
    evaluateSrdCharacter({
      abilities: { STRENGTH: 16 },
      classes: [{ label: 'Fighter', level: 1 }],
      items: [{ label }]
    }),
    label,
    { attackKind: 'MELEE', grip: 'ONE_HANDED' }
  )
  const [, damageBonus] = damageExpression(decision).split(' + ')
  return { attack: decision.mechanic.attackBonus, damage: Number(damageBonus) }
}

/** A STR 16 Creature's one-handed melee attack with its loadout's `label` weapon in `useState`. */
function creatureBonuses(label: string, useState: EquipmentSlotCode) {
  const weapon = entry(label, useState)
  return resolveDnd5eCreatureWeaponBonuses({
    abilityScores: { STRENGTH: 16 },
    equipment: [weapon],
    loadoutEntryId: weapon.id,
    attackKind: 'MELEE',
    grip: 'ONE_HANDED',
    activation: null
  })
}

describe('a Creature’s bound weapon bonuses match a Character’s (ATTACK-6.3)', () => {
  it('a held Longsword +1 adds what it adds to a Character’s attack: +1 to hit and damage', () => {
    const magic = characterAttack('Longsword +1')
    const mundane = characterAttack('Longsword')
    const characterBonus = {
      attack: magic.attack! - mundane.attack!,
      damage: magic.damage - mundane.damage
    }

    expect(characterBonus).toEqual({ attack: 1, damage: 1 })
    expect(creatureBonuses('Longsword +1', 'MAIN_HAND')).toEqual(characterBonus)
  })

  it('a mundane weapon adds nothing: the stat block keeps its ability and proficiency', () => {
    expect(creatureBonuses('Longsword', 'MAIN_HAND')).toEqual({ attack: 0, damage: 0 })
  })

  it('a carried magic weapon is unequipped, so its bonus does not apply', () => {
    expect(creatureBonuses('Longsword +1', 'CARRIED')).toEqual({ attack: 0, damage: 0 })
  })
})

describe('the Ogre’s printed Greatclub attack with its loadout weapon (ATTACK-6.3)', () => {
  const seededOgre = creatureAuthoredDtoSchema.parse(
    prepareSrdImport().subjects.find(
      (subject) => subject.subjectKind === 'CREATURE' && subject.document.label === 'Ogre'
    )?.document
  )

  /** The Ogre holding `weaponId` in place of its Greatclub. */
  function ogreHolding(weaponId: string): CreatureAuthored {
    return {
      ...seededOgre,
      equipmentLoadout: seededOgre.equipmentLoadout?.map((loadoutEntry) =>
        loadoutEntry.equipmentId === greatclub.id
          ? { ...loadoutEntry, equipmentId: weaponId }
          : loadoutEntry
      )
    }
  }

  /** The Greatclub action's attack mechanic and its hit damage dice, as discovery binds them. */
  function greatclubAttack(creature: CreatureAuthored) {
    const actor = srdCreatureActor({ id: testUuid(0xe60), creature })
    const { available } = discoverEncounterFeatureActions({
      spells: new Map(),
      actor,
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
    })
    const capability = available.find(
      (candidate) => candidate.ownerFeatureId === creatureFeature(creature, 'Greatclub').id
    )
    if (!capability?.equipmentBinding) throw new Error('The Greatclub action binds no weapon.')
    const outcomes = featureActionMechanic(capability).outcomes as Record<string, unknown>[]
    const damage = outcomes.find((outcome) => outcome.kind === 'DAMAGE')
    if (!damage) throw new Error('The Greatclub action deals no damage.')
    return {
      attackBonus: capability.attackMechanic?.attackBonus,
      damageBonus: capability.attackMechanic?.damageBonus,
      damage: resolveCreatureDamageExpression({
        outcome: damage,
        sourceDerivedFacts: { statBlock: { abilityScores: creature.abilityScores } },
        sourceHitPoints: null
      })
    }
  }

  it('keeps the print with its mundane Greatclub: +6 to hit, 2d8 + 4', () => {
    expect(greatclubAttack(seededOgre)).toEqual({
      attackBonus: 6,
      damageBonus: 0,
      damage: '2d8+4'
    })
  })

  it('adds the Greatclub +1’s bonus to the print: +7 to hit, 2d8 + 5', () => {
    expect(greatclubAttack(ogreHolding(greatclubPlus1.id))).toEqual({
      attackBonus: 7,
      damageBonus: 1,
      damage: '2d8+5'
    })
  })
})
