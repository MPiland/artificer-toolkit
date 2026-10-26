import type {
  CharacterGrantFoldInput,
  CharacterGrantFoldOutput
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { AttackKind } from '@artificer-toolkit/schema/shared/enums'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import { compileModifierGrant } from '@artificer-toolkit/shared/compilers'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { CreatureArmorClassEquipment } from '../../armorClassCapability.js'
import { normalizeCharacterGrantRestrictions } from '../../character/characterGrantFoldRestrictionFacts.js'
import {
  buildCharacterGrantFoldModifierFacts,
  buildGrantFoldEquipmentFacts,
  compiledEquipmentParentIds
} from '../../character/characterGrantFoldSourceFacts.js'
import { dnd5eAttackModifierDomain } from './attackKind.js'
import { dnd5eAttackBonusTotal } from './characterActionMechanics.js'
import { evaluateDnd5e2014CharacterGrantFold } from './characterGrantFold.js'
import {
  type CharacterResolvedModifierGroup,
  dnd5eActionModifierGroups,
  evaluateDnd5eCharacterModifiers
} from './characterModifiers.js'
import { DND5E_SYSTEM_ID } from './identity.js'
import type { Dnd5eAttackingItem, Dnd5eModifierTarget } from './modifierApplicability.js'

/**
 * Folds a Creature's grant sources with the grant fold Characters use and the Creature as holder,
 * so restrictions, holder kind and size gates decide exactly as they do for a Character.
 */
function foldDnd5eCreatureGrants(
  input: Pick<
    CharacterGrantFoldInput['base'],
    'systemId' | 'size' | 'abilities' | 'featureIds' | 'equipment'
  > &
    Pick<CharacterGrantFoldInput, 'features' | 'equipmentItems'>
): CharacterGrantFoldOutput {
  return evaluateDnd5e2014CharacterGrantFold(
    {
      contractVersion: 1,
      base: {
        systemId: input.systemId,
        totalLevel: 0,
        raceId: null,
        subraceId: null,
        size: input.size,
        abilities: input.abilities,
        heritageIds: [],
        featureIds: input.featureIds,
        optionIds: [],
        featIds: [],
        classes: [],
        equipment: input.equipment
      },
      upstreamSpellIds: [],
      classes: [],
      background: null,
      features: input.features,
      activeEffects: [],
      equipmentItems: input.equipmentItems
    },
    'CREATURE'
  )
}

/** A Creature's feature modifier grants: each feature is one `FEATURE` source. */
export function foldDnd5eCreatureFeatureGrants(
  creature: Pick<CreatureAuthored, 'id' | 'systemId' | 'size' | 'abilityScores' | 'features'>
): CharacterGrantFoldOutput['modifiers'] {
  return foldDnd5eCreatureGrants({
    systemId: creature.systemId,
    size: creature.size,
    abilities: creature.abilityScores,
    featureIds: creature.features.map((feature) => feature.id),
    features: creature.features.map((feature) => {
      const mechanicSource = {
        kind: 'AUTHORED',
        sourceKind: 'FEATURE',
        definitionId: feature.id,
        sourceInstanceId: `${creature.id}:${feature.id}`
      } as const
      return {
        sourceKind: 'FEATURE',
        sourceClassLevel: null,
        timingLevel: null,
        definition: {
          sourceId: createCharacterMechanicSourceKey(mechanicSource),
          mechanicSource,
          sourceState: null,
          restrictions: normalizeCharacterGrantRestrictions(feature.restrictions),
          proficiencies: [],
          senses: [],
          modifiers: buildCharacterGrantFoldModifierFacts(
            feature.grants?.modifiers?.map(compileModifierGrant)
          ),
          feats: [],
          spells: []
        },
        selectedOptions: [],
        featDefinition: null
      }
    }),
    equipment: [],
    equipmentItems: []
  }).modifiers
}

/**
 * A Creature's effective loadout folded as Character Equipment is (ATTACK-6.3): a worn or held
 * entry is equipped, a carried one is not, and a Creature is attuned to every item it carries (its
 * stat block's magic items work), so item restrictions and modifier restrictions decide as they do
 * for a Character.
 */
export function foldDnd5eCreatureEquipment(input: {
  systemId: string
  abilityScores: Readonly<Record<string, number>>
  equipment: readonly CreatureArmorClassEquipment[]
}): CharacterGrantFoldOutput {
  return foldDnd5eCreatureGrants({
    systemId: input.systemId,
    size: null,
    abilities: { ...input.abilityScores },
    featureIds: [],
    features: [],
    ...buildGrantFoldEquipmentFacts({
      items: input.equipment.map((entry) => ({
        instanceId: entry.id,
        equipmentId: entry.compiled.id,
        compiledItem: entry.compiled,
        equipped: entry.useState !== 'CARRIED',
        attuned: true
      })),
      snapshot: { systemId: input.systemId }
    })
  })
}

/**
 * A Creature's folded loadout and its modifier groups valued from the Creature's ability scores,
 * which its Armor Class and its weapon attacks read as a Character's do (ATTACK-6.3).
 */
export function evaluateDnd5eCreatureEquipment(input: {
  abilityScores: Readonly<Record<string, number>>
  equipment: readonly CreatureArmorClassEquipment[]
}): { grantFold: CharacterGrantFoldOutput; modifierGroups: CharacterResolvedModifierGroup[] } {
  const grantFold = foldDnd5eCreatureEquipment({ systemId: DND5E_SYSTEM_ID, ...input })
  const modifierGroups = evaluateDnd5eCharacterModifiers(
    {
      totalLevel: 0,
      grantFoldFacts: { base: { classes: [] } },
      derivedBaseFacts: {
        abilities: Object.entries(input.abilityScores).map(([abilityId, baseScore]) => ({
          abilityId,
          baseScore
        })),
        spellcasting: null
      }
    },
    grantFold
  )
  return { grantFold, modifierGroups }
}

/**
 * What a Creature's attack with a loadout weapon adds to its authored roll and damage (ATTACK-6.3):
 * the bonuses and penalties its folded loadout applies to that weapon, evaluated as a Character's
 * attack with the same item is. The stat block keeps authoring ability and proficiency.
 */
export function resolveDnd5eCreatureWeaponBonuses(input: {
  abilityScores: Readonly<Record<string, number>>
  equipment: readonly CreatureArmorClassEquipment[]
  loadoutEntryId: string
  attackKind: AttackKind
  grip: Dnd5eAttackingItem['grip']
  activation: string | null
}): { attack: number; damage: number } {
  const weapon = input.equipment.find((entry) => entry.id === input.loadoutEntryId)
  if (!weapon) throw new Error('Creature attack is missing its bound loadout weapon.')
  const { grantFold, modifierGroups } = evaluateDnd5eCreatureEquipment(input)
  const groups = dnd5eActionModifierGroups(grantFold, modifierGroups)
  const target: Dnd5eModifierTarget = {
    sourceIds: [
      createCharacterMechanicSourceKey({
        kind: 'EQUIPMENT_INSTANCE',
        equipmentId: weapon.compiled.id,
        itemInstanceId: weapon.id
      })
    ],
    item: {
      equipmentIds: [weapon.compiled.id, ...compiledEquipmentParentIds(weapon.compiled)],
      category: weapon.compiled.category ?? null,
      properties: weapon.compiled.properties ?? [],
      grip: input.grip,
      otherWeaponEquipped: input.equipment.some(
        (entry) =>
          entry.id !== weapon.id &&
          entry.useState !== 'CARRIED' &&
          entry.compiled.category === 'WEAPON'
      )
    },
    attackAbility: null,
    activation: input.activation,
    spellId: null
  }
  const attackDomain = dnd5eAttackModifierDomain(input.attackKind)
  return {
    attack: dnd5eAttackBonusTotal(groups, attackDomain, 'ATTACK_ROLL', target),
    damage: dnd5eAttackBonusTotal(groups, attackDomain, 'DAMAGE', target)
  }
}
