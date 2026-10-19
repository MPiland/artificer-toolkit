import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import { compileModifierGrant } from '@artificer-toolkit/shared/compilers'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { normalizeCharacterGrantRestrictions } from '../../character/characterGrantFoldRestrictionFacts.js'
import { buildCharacterGrantFoldModifierFacts } from '../../character/characterGrantFoldSourceFacts.js'
import { evaluateDnd5e2014CharacterGrantFold } from './characterGrantFold.js'

/**
 * A Creature's feature modifier grants, accepted by the grant fold Characters use with the
 * Creature as holder: each feature is one `FEATURE` source, so feature restrictions, holder kind and
 * size gates, and modifier restrictions decide exactly as they do for a Character.
 */
export function foldDnd5eCreatureFeatureGrants(
  creature: Pick<CreatureAuthored, 'id' | 'systemId' | 'size' | 'abilityScores' | 'features'>
): CharacterGrantFoldOutput['modifiers'] {
  return evaluateDnd5e2014CharacterGrantFold(
    {
      contractVersion: 1,
      base: {
        systemId: creature.systemId,
        totalLevel: 0,
        raceId: null,
        subraceId: null,
        size: creature.size,
        abilities: creature.abilityScores,
        heritageIds: [],
        featureIds: creature.features.map((feature) => feature.id),
        optionIds: [],
        featIds: [],
        classes: [],
        equipment: []
      },
      upstreamSpellIds: [],
      classes: [],
      background: null,
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
      activeEffects: [],
      equipmentItems: []
    },
    'CREATURE'
  ).modifiers
}
