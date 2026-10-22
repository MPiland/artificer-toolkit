import { describe, expect, it } from 'vitest'
import type {
  NodeRuntimeCollectionAuthoringDto,
  NodeRuntimeArrayGroupNodeDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  resolveArrayAuthoringMeta,
  resolveInputAuthoringMeta
} from '@artificer-toolkit/shared/maps'
import {
  buildAuthoringNavigationTree,
  findAuthoringValidationTarget,
  type AuthoringNavigationTarget
} from '../layout/authoringNavigation'
import {
  getCollectionRowLabel,
  getCollectionRowMetadata
} from '../rendering/collectionPresentation'

const inputAuthoring = resolveInputAuthoringMeta(undefined)

const model = {
  mapId: 'validation-routing',
  clearPaths: [],
  steps: [
    {
      id: 'basics',
      label: 'Basics',
      order: 1,
      sections: [
        {
          id: 'basics-section',
          label: 'Basics',
          order: 1,
          nodes: [
            {
              id: 'name',
              path: ['name'],
              label: 'Name',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
            }
          ]
        }
      ]
    },
    {
      id: 'details',
      label: 'Details',
      order: 2,
      sections: [
        {
          id: 'details-section',
          label: 'Details',
          order: 1,
          nodes: [
            {
              id: 'notes',
              path: ['notes'],
              label: 'Notes',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: false,
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: inputAuthoring
            }
          ]
        }
      ]
    }
  ],
  scopes: []
} satisfies NodeRuntimeResolveResponseDto

describe('authoring server-validation navigation', () => {
  it('marks the owning target as errored and resolves the field path to it', () => {
    const navigation = buildAuthoringNavigationTree({
      mapId: model.mapId,
      model,
      validationIssues: [
        {
          code: 'invalid_type',
          message: 'Expected a string.',
          path: ['notes']
        }
      ],
      values: { name: 'Arcane Ward', notes: 7 }
    })
    const target = findAuthoringValidationTarget(['notes'], navigation.navigationTargets)

    expect(target).toEqual(expect.objectContaining({ stepId: 'details' }))
    expect(navigation.stepStatuses[target?.id ?? '']).toBe('error')
    expect(navigation.progressSummary.errorCount).toBe(1)
  })

  it('chooses the deepest repairable target for nested issues', () => {
    const targets: AuthoringNavigationTarget[] = [
      {
        collectionFieldName: 'features',
        id: 'features-overview',
        kind: 'overview',
        label: 'Overview',
        mapId: 'feature',
        ownedFieldPaths: ['features']
      },
      {
        fieldPathPrefix: 'features[0]',
        id: 'feature-options',
        kind: 'step',
        label: 'Options',
        mapId: 'feature',
        ownedFieldPaths: ['features[0]', 'features[0].options'],
        stepId: 'options'
      },
      {
        fieldPathPrefix: 'features[0].options[0].outcomes[0]',
        id: 'outcomes',
        kind: 'step',
        label: 'Outcomes',
        mapId: 'effect-outcome',
        ownedFieldPaths: [
          'features[0].options[0].outcomes[0]',
          'features[0].options[0].outcomes[0].damage'
        ],
        stepId: 'outcomes'
      }
    ]

    expect(
      findAuthoringValidationTarget(
        ['features', 0, 'options', 0, 'outcomes', 0, 'damage', 'dice', 'count'],
        targets
      )?.id
    ).toBe('outcomes')
    expect(findAuthoringValidationTarget(['features'], targets)?.id).toBe('features-overview')
    expect(findAuthoringValidationTarget(['description'], targets)).toBeUndefined()
  })
})

function createArrayNode(
  childMapId: string,
  label = 'Rows',
  rowSummary?: NodeRuntimeCollectionAuthoringDto['rowSummary'],
  itemLabel?: string
): NodeRuntimeArrayGroupNodeDto {
  const authoring = resolveArrayAuthoringMeta(label, 'inline', undefined, undefined)

  return {
    id: `${childMapId}-rows`,
    path: ['rows'],
    label,
    kind: 'GROUP',
    groupKind: 'ARRAY',
    childMapId,
    presentation: 'inline',
    visible: true,
    required: false,
    hiddenBehavior: 'KEEP',
    clearPaths: [],
    authoring: {
      ...authoring,
      collection: {
        ...authoring.collection,
        ...(itemLabel ? { itemLabel } : {}),
        ...(rowSummary ? { rowSummary } : {})
      }
    }
  }
}

describe('authoring group row labels', () => {
  it.each([
    {
      node: createArrayNode('modifierGrant', 'Modifiers', 'modifier'),
      row: {
        valueDomainCode: 'ATTACK_ROLL',
        modifierKind: 'BONUS',
        payload: { amount: 1 }
      },
      expected: '+1 Attack Rolls'
    },
    {
      node: createArrayNode('modifierGrant', 'Modifiers', 'modifier'),
      row: {
        valueDomainCode: 'DAMAGE',
        modifierKind: 'ROLL_INFLUENCE',
        payload: { amount: 1000, influence: 'ADVANTAGE' }
      },
      expected: '+1,000 Damage Rolls Advantage'
    },
    {
      node: createArrayNode('modifierGrant', 'Modifiers', 'modifier'),
      row: {
        valueDomainCode: 'SPEED',
        modifierKind: 'BONUS',
        payload: { amount: 30, unit: 'FEET' }
      },
      expected: '+30 feet Speed'
    },
    {
      node: createArrayNode('modifierGrant', 'Modifiers', 'modifier'),
      row: {
        valueDomainCode: 'SENSE_RANGE',
        modifierKind: 'BONUS',
        payload: { amount: 10, unit: 'YARDS' }
      },
      expected: '+10 yards Sense Range'
    },
    {
      node: createArrayNode('effect', 'Effects', 'effect'),
      row: { invocation: { triggerCode: 'SAVING_THROW' } },
      expected: 'Saving Throw'
    },
    {
      node: createArrayNode('effectPath', 'Paths', 'effect-path'),
      row: { pathCode: 'ON_SAVE_FAIL' },
      expected: 'On Save Failure'
    },
    {
      node: createArrayNode('manifestBehaviorPath', 'Behavior Paths', 'effect-path'),
      row: { pathCode: 'ON_USE' },
      expected: 'On Use'
    },
    {
      node: createArrayNode('outcome', 'Outcomes', 'outcome'),
      row: { effectKind: 'DAMAGE' },
      expected: 'Damage'
    },
    {
      node: createArrayNode('nonManifestOutcome', 'Outcomes', 'outcome'),
      row: { effectKind: 'HEAL' },
      expected: 'Healing'
    },
    {
      node: createArrayNode('facetGroup', 'Groups', undefined, 'option'),
      row: {},
      expected: 'Option 1'
    },
    {
      node: createArrayNode('facetContext', 'Contexts', 'facet-context'),
      row: { subject: 'CHARACTER' },
      expected: 'Character condition'
    },
    {
      node: createArrayNode('speed', 'Speeds', 'speed'),
      row: { speedId: 'WALKING', amount: 30, unit: 'FEET' },
      expected: 'Walking - 30 Feet'
    }
  ])('builds $expected from authored mechanics', ({ node, row, expected }) => {
    expect(getCollectionRowLabel(node, row, 0)).toBe(expected)
  })

  it('prefers an explicit authored label and falls back to the singular collection label', () => {
    const node = createArrayNode('feature', 'Features')

    expect(getCollectionRowLabel(node, { label: 'Breath Weapon' }, 0)).toBe('Breath Weapon')
    expect(getCollectionRowLabel(node, { label: 'Extra Attack', availableAtLevel: 5 }, 0)).toBe(
      'Level 5 · Extra Attack'
    )
    expect(getCollectionRowLabel(node, {}, 1)).toBe('Feature 2')
  })

  it('summarizes proficiency rows instead of numbering them', () => {
    const node = createArrayNode('proficiencyGrant', 'Proficiencies')

    expect(
      getCollectionRowLabel(
        node,
        {
          proficiencyKind: 'EQUIPMENT_PROPERTY',
          category: 'ARMOR',
          properties: ['LIGHT', 'MEDIUM'],
          selectionKind: 'GRANTED'
        },
        0
      )
    ).toBe('Light / Medium armor proficiency')
    expect(
      getCollectionRowLabel(
        node,
        { proficiencyKind: 'SKILL', selectionKind: 'CHOSEN', count: 3 },
        1
      )
    ).toBe('Choose 3 skills')
  })

  it('summarizes a class spell progression row', () => {
    const node = createArrayNode('classSpellLimits', 'Spell Limits')

    expect(
      getCollectionRowLabel(
        node,
        {
          classLevel: 5,
          learnedSpellsLimit: 5,
          slots: [
            { spellLevel: 1, slotCount: 4 },
            { spellLevel: 2, slotCount: 2 }
          ]
        },
        0
      )
    ).toBe('Level 5 · 4/2 slots · 5 known')
  })
})

describe('authoring modifier row metadata', () => {
  it('shows a speed or sense range amount with its unit', () => {
    expect(
      getCollectionRowMetadata(createArrayNode('modifierGrant', 'Modifiers', 'modifier'), {
        valueDomainCode: 'SPEED',
        modifierKind: 'BONUS',
        scope: 'GLOBAL',
        payload: { amount: 30, unit: 'FEET' }
      })
    ).toContain('+30 feet')
  })
})
