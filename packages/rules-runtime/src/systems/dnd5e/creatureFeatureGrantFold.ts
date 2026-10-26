import type {
  CharacterGrantFoldInput,
  CharacterGrantFoldOutput
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import { compileModifierGrant } from '@artificer-toolkit/shared/compilers'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { CreatureArmorClassEquipment } from '../../armorClassCapability.js'
import { normalizeCharacterGrantRestrictions } from '../../character/characterGrantFoldRestrictionFacts.js'
import {
  buildCharacterGrantFoldModifierFacts,
  buildGrantFoldEquipmentFacts
} from '../../character/characterGrantFoldSourceFacts.js'
import { evaluateDnd5e2014CharacterGrantFold } from './characterGrantFold.js'

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
  })
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
