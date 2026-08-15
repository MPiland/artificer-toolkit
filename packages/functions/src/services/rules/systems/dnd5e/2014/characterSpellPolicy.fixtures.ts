import { compileSpellGrant } from '@artificer-toolkit/shared/compilers'
import {
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLASS_CATEGORY,
  GRANT_KIND,
  SCALING,
  SCALING_SOURCE,
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

export function createSpellGrantPolicyFixture(): {
  snapshot: CharacterBuildSnapshot
  registry: CharacterAssemblyRegistry
} {
  const classGrant = compileSpellGrant({
    grantKind: GRANT_KIND.SPELL_GRANT,
    id: 'wizard-spellbook',
    order: 1,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    spellIds: ['shield'],
    attributes: ['KNOWN']
  })
  const arcticGrant = compileSpellGrant({
    grantKind: GRANT_KIND.SPELL_GRANT,
    id: 'arctic-spells',
    order: 1,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.PER_LEVEL,
    progression: {
      scalingSource: SCALING_SOURCE.CLASS_LEVEL,
      classId: 'wizard',
      levels: [
        {
          id: 'arctic-spells-3',
          level: 3,
          order: 1,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['fog-cloud']
        },
        {
          id: 'arctic-spells-7',
          level: 7,
          order: 2,
          authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
          spellIds: ['ice-storm']
        }
      ]
    },
    attributes: ['PREPARED'],
    restrictions: {
      groups: [
        {
          contexts: [
            {
              conditions: [
                {
                  predicateCode: 'SUBCLASS_SPECIALIZATION',
                  specializationIds: ['arctic']
                }
              ]
            }
          ]
        }
      ]
    }
  } as never)
  const coastGrant = compileSpellGrant({
    grantKind: GRANT_KIND.SPELL_GRANT,
    id: 'coast-spells',
    order: 2,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    spellIds: ['mirror-image'],
    attributes: ['PREPARED'],
    restrictions: {
      groups: [
        {
          contexts: [
            {
              conditions: [
                {
                  predicateCode: 'SUBCLASS_SPECIALIZATION',
                  specializationIds: ['coast']
                }
              ]
            }
          ]
        }
      ]
    }
  } as never)
  const racialGrant = compileSpellGrant({
    grantKind: GRANT_KIND.SPELL_GRANT,
    id: 'elf-magic',
    order: 1,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    spellIds: ['dancing-lights'],
    attributes: ['KNOWN', 'CAST_AT_WILL']
  })
  const chosenSubraceGrant = compileSpellGrant({
    grantKind: GRANT_KIND.SPELL_GRANT,
    id: 'high-elf-cantrip',
    order: 1,
    selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
    selectionDuplicatePolicy: 'UNIQUE',
    count: 1,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    spellIds: ['fire-bolt', 'mage-hand'],
    attributes: ['KNOWN', 'CAST_AT_WILL'],
    castingAbility: 'INTELLIGENCE'
  })

  return {
    snapshot: {
      characterId: 'spell-policy-character',
      systemId: 'dnd5e2014',
      totalLevel: 5,
      classes: [
        {
          classId: 'wizard',
          level: 5,
          subclassId: 'school-of-evocation',
          specializationId: 'arctic'
        }
      ],
      raceId: 'elf',
      subraceId: 'high-elf',
      abilities: {},
      hitpoints: [],
      features: [],
      equipmentItems: [],
      chosenGrantSelections: [
        {
          id: 'high-elf-cantrip-choice',
          grantId: 'high-elf-cantrip',
          source: { kind: 'SUBRACE', subraceId: 'high-elf' },
          timing: { kind: 'CHARACTER_LEVEL', level: 1 },
          targetIds: ['fire-bolt', 'fire-bolt']
        }
      ]
    },
    registry: {
      classes: {
        wizard: {
          id: 'wizard',
          category: CLASS_CATEGORY.BASE,
          features: [{ id: 'wizard-spells', order: 1, spells: [classGrant] }]
        } as never,
        'school-of-evocation': {
          id: 'school-of-evocation',
          category: CLASS_CATEGORY.SUBCLASS,
          parentClassId: 'wizard',
          features: [
            {
              id: 'school-spells',
              order: 1,
              availableAtLevel: 2,
              spells: [arcticGrant, coastGrant]
            }
          ]
        } as never
      },
      races: {
        elf: {
          id: 'elf',
          category: 'BASE',
          features: [{ id: 'elf-magic-feature', order: 1, spells: [racialGrant] }]
        } as never,
        'high-elf': {
          id: 'high-elf',
          category: 'SUBRACE',
          parentRaceId: 'elf',
          features: [
            { id: 'elf-magic-feature', order: 1, spells: [racialGrant] },
            { id: 'high-elf-cantrip-feature', order: 2, spells: [chosenSubraceGrant] }
          ]
        } as never
      },
      features: {},
      feats: {},
      equipment: {},
      spells: {}
    }
  }
}
