import { compileEquipment } from '@artificer-toolkit/shared/compilers'
import type { FeatAuthored, FeatureAuthored } from '@artificer-toolkit/shared/authored'
import { SUBJECT } from '@artificer-toolkit/shared/core'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import {
  type CharacterGrantFoldSource,
  type CharacterGrantFoldInput
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { EquipmentAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import type { ResolvedEquipment } from '@artificer-toolkit/shared/subjects/compilers'

export const characterId = 'character-1'
export const systemId = 'dnd5e2014'
export const userId = 'user-1'

export const feature: FeatureAuthored = {
  id: 'feature-parent',
  label: 'Feature source',
  description: '',
  order: 1
}
export const option: FeatureAuthored = {
  id: 'option-parent',
  label: 'Option source',
  description: '',
  order: 1,
  options: [{ id: 'selected-option', label: 'Option', description: '', order: 1 }]
}
export const feat: FeatureAuthored = {
  id: 'feat-parent',
  label: 'Feat source',
  description: '',
  order: 1
}
export const featureSource = {
  kind: 'AUTHORED' as const,
  sourceKind: 'FEATURE' as const,
  definitionId: feature.id,
  sourceInstanceId: 'feature-branch'
}
export const optionSource = {
  kind: 'AUTHORED' as const,
  sourceKind: 'OPTION' as const,
  definitionId: 'selected-option',
  sourceInstanceId: 'option-branch'
}
export const featSource = {
  kind: 'AUTHORED' as const,
  sourceKind: 'FEAT' as const,
  definitionId: 'feat-origin',
  sourceInstanceId: 'feat-origin'
}
export const nestedFeature: FeatureAuthored<'EQUIPMENT'> = {
  id: 'nested-feature',
  label: 'Nested feature',
  description: '',
  order: 1,
  charges: {
    id: 'nested-feature-charge',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    resetKind: 'LONG_REST',
    amount: 1
  }
}
export const rootItemAuthored: EquipmentAuthored = {
  kind: 'EQUIPMENT',
  id: 'root-item',
  label: 'Torch',
  description: '',
  userId,
  systemId,
  category: 'ADVENTURING_GEAR',
  properties: [],
  rarityId: 'COMMON',
  charges: {
    id: 'root-item-charge',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    resetKind: 'SHORT_REST',
    amount: 2
  },
  features: [],
  requiresAttunement: false
}
export const nestedItemAuthored: EquipmentAuthored = {
  kind: 'EQUIPMENT',
  id: 'nested-item',
  label: 'Nested wand',
  description: '',
  userId,
  systemId,
  category: 'ADVENTURING_GEAR',
  properties: [],
  rarityId: 'COMMON',
  features: [nestedFeature],
  requiresAttunement: false
}
export const rootItem = compileEquipment(rootItemAuthored)
export const nestedItem = compileEquipment(nestedItemAuthored)
export const spell: SpellAuthored = {
  kind: SUBJECT.SPELL,
  id: 'magic-missile',
  level: 1,
  classIds: [],
  label: 'Magic Missile',
  description: '',
  castingTime: { unit: 'ROUND', amount: 1 },
  magicSchoolId: 'evocation',
  attributes: [],
  components: [],
  userId,
  systemId
}
export const authoredSourcePoolId = (
  chargeId: string,
  source: typeof featureSource | typeof optionSource | typeof featSource
) =>
  createCharacterResourceOwnerKey(
    toCharacterResourceOwnerKey({ kind: 'AUTHORED_SOURCE', chargeId, source })
  )
export const abilities = {
  STRENGTH: 10,
  DEXTERITY: 10,
  CONSTITUTION: 10,
  INTELLIGENCE: 10,
  WISDOM: 10,
  CHARISMA: 10
}
export const rootItemResolved: ResolvedEquipment = {
  kind: SUBJECT.EQUIPMENT,
  id: 'root-item',
  label: 'Torch',
  description: '',
  userId,
  systemId,
  category: 'ADVENTURING_GEAR',
  properties: [],
  requiresAttunement: false,
  rarityId: 'COMMON',
  charges: {
    id: 'root-item-charge',
    resetKind: 'SHORT_REST',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    amount: 2
  }
}
export const nestedItemResolved: ResolvedEquipment = {
  ...rootItemResolved,
  id: 'nested-item',
  label: 'Nested wand',
  features: [nestedFeature]
}
export const featAuthored: FeatAuthored = {
  id: 'feat-origin',
  label: 'Feat origin',
  description: '',
  userId,
  systemId
}

export const SNAPSHOT: CharacterBuildSnapshot = {
  characterId,
  systemId,
  totalLevel: 3,
  classes: [{ classId: 'fighter', level: 3 }],
  abilities,
  hitpoints: [],
  features: [
    {
      acquisitionId: 'acq-feature',
      featureId: feature.id,
      source: { kind: 'CLASS', classId: 'fighter', classLevel: 2 },
      timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 2 }
    },
    {
      acquisitionId: 'acq-option',
      featureId: option.id,
      source: { kind: 'OPTION', acquiredParentId: option.id, optionId: 'selected-option' },
      timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 2 },
      selections: [
        { selectionKey: 'selected-option', values: [{ kind: 'ID', id: 'selected-option' }] }
      ]
    },
    {
      acquisitionId: 'acq-feat',
      featureId: feat.id,
      source: { kind: 'FEAT', featId: 'feat-origin' },
      timing: { kind: 'CLASS_LEVEL', classId: 'fighter', classLevel: 2 }
    }
  ],
  equipmentItems: [
    {
      instanceId: 'root-1',
      contentRef: { definitionId: rootItem.id, binding: { kind: 'ACTIVE' }, systemId },
      attuned: false,
      compiledItem: rootItem
    },
    {
      instanceId: 'root-2',
      contentRef: { definitionId: rootItem.id, binding: { kind: 'ACTIVE' }, systemId },
      attuned: false,
      compiledItem: rootItem
    },
    {
      instanceId: 'nested-1',
      contentRef: { definitionId: nestedItem.id, binding: { kind: 'ACTIVE' }, systemId },
      attuned: false,
      compiledItem: nestedItem
    },
    {
      instanceId: 'nested-2',
      contentRef: { definitionId: nestedItem.id, binding: { kind: 'ACTIVE' }, systemId },
      attuned: false,
      compiledItem: nestedItem
    }
  ]
}

export function grantFoldFacts(): CharacterGrantFoldInput {
  const source = (
    mechanicSource: CharacterGrantFoldSource['mechanicSource'],
    sourceId: string
  ): CharacterGrantFoldSource => ({
    sourceId,
    mechanicSource,
    sourceState: null,
    restrictions: [],
    proficiencies: [],
    senses: [],
    modifiers: [],
    feats: [],
    spells: []
  })
  return {
    contractVersion: 1,
    base: {
      systemId,
      totalLevel: 3,
      raceId: null,
      subraceId: null,
      abilities,
      heritageIds: [],
      featureIds: [feature.id, option.id, feat.id],
      optionIds: ['selected-option'],
      featIds: ['feat-origin'],
      classes: [{ classId: 'fighter', level: 3, spellcasting: true }],
      equipment: [
        {
          equipmentId: rootItem.id,
          category: 'ADVENTURING_GEAR',
          properties: [],
          equipped: false,
          attuned: false
        },
        {
          equipmentId: nestedItem.id,
          category: 'ADVENTURING_GEAR',
          properties: [],
          equipped: false,
          attuned: false
        }
      ]
    },
    upstreamSpellIds: [spell.id],
    classes: [
      {
        classId: 'fighter',
        level: 3,
        base: {
          category: 'BASE',
          source: source(
            {
              kind: 'AUTHORED',
              sourceKind: 'CLASS',
              definitionId: 'fighter',
              sourceInstanceId: 'fighter:3'
            },
            'source-fighter'
          ),
          multiclassProficiencies: []
        },
        subclass: null
      }
    ],
    background: null,
    features: [
      {
        sourceKind: 'CLASS',
        sourceClassLevel: 2,
        timingLevel: 2,
        definition: source(
          {
            kind: 'AUTHORED',
            sourceKind: 'FEATURE',
            definitionId: feature.id,
            sourceInstanceId: 'feature-branch'
          },
          'feature-branch'
        ),
        selectedOptions: [],
        featDefinition: null
      },
      {
        sourceKind: 'OPTION',
        sourceClassLevel: 2,
        timingLevel: 2,
        definition: null,
        selectedOptions: [
          source(
            {
              kind: 'AUTHORED',
              sourceKind: 'OPTION',
              definitionId: 'selected-option',
              sourceInstanceId: 'option-branch'
            },
            'option-branch'
          )
        ],
        featDefinition: null
      },
      {
        sourceKind: 'FEAT',
        sourceClassLevel: 2,
        timingLevel: 2,
        definition: source(
          {
            kind: 'AUTHORED',
            sourceKind: 'FEATURE',
            definitionId: feat.id,
            sourceInstanceId: 'feat-definition-branch'
          },
          'feat-definition-branch'
        ),
        selectedOptions: [],
        featDefinition: source(
          {
            kind: 'AUTHORED',
            sourceKind: 'FEAT',
            definitionId: 'feat-origin',
            sourceInstanceId: 'feat-origin'
          },
          'feat-origin'
        )
      }
    ],
    equipmentItems: [
      {
        instanceId: 'root-1',
        equipmentId: rootItem.id,
        requiresAttunement: false,
        equipped: false,
        attuned: false,
        restrictions: [],
        rootSourceId: 'root-source-1',
        rootModifiers: [],
        chargeId: 'root-item-charge',
        features: []
      },
      {
        instanceId: 'root-2',
        equipmentId: rootItem.id,
        requiresAttunement: false,
        equipped: false,
        attuned: false,
        restrictions: [],
        rootSourceId: 'root-source-2',
        rootModifiers: [],
        chargeId: 'root-item-charge',
        features: []
      },
      {
        instanceId: 'nested-1',
        equipmentId: nestedItem.id,
        requiresAttunement: false,
        equipped: false,
        attuned: false,
        restrictions: [],
        rootSourceId: 'nested-source-1',
        rootModifiers: [],
        chargeId: null,
        features: [
          {
            source: source(
              {
                kind: 'AUTHORED',
                sourceKind: 'FEATURE',
                definitionId: nestedFeature.id,
                sourceInstanceId: 'nested-source-1'
              },
              'nested-source-1'
            ),
            sourceChargeUse: { featureId: nestedFeature.id, limitKind: 'FIXED_AMOUNT', cost: 1 }
          }
        ]
      },
      {
        instanceId: 'nested-2',
        equipmentId: nestedItem.id,
        requiresAttunement: false,
        equipped: false,
        attuned: false,
        restrictions: [],
        rootSourceId: 'nested-source-2',
        rootModifiers: [],
        chargeId: null,
        features: []
      }
    ]
  }
}
