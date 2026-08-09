import { FEATURE_ATTRIBUTE_OPTIONS, FEATURE_SECTION_OPTIONS } from '#core'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap } from '#utils'
import type { FeatureAuthored, FeatureOptionChoice, FeatureRollDefinitionAuthored } from '#authored'
import type { DiceExpression } from '#core'
import {
  EFFECT_NODE_MAP,
  CHARGE_NODE_MAP,
  FACET_NODE_MAP,
  FEATURE_GRANTS_NODE_MAP,
  DETAIL_NODE_MAP
} from '#maps'
import { OPTION_NODE_MAP } from './option.js'

const optionChoice = buildNodeMap<FeatureOptionChoice>()
const rollDefinition = buildNodeMap<FeatureRollDefinitionAuthored>()
const diceExpression = buildNodeMap<DiceExpression>()

const DICE_EXPRESSION_NODE_MAP = diceExpression.define('featureRollExpression', ({ map, nodes }) => {
  const { number } = nodes
  map.set('count', number(['count'], 'Dice')).set('die', number(['die'], 'Die')).set('modifier', number(['modifier'], 'Modifier'))
})

const FEATURE_ROLL_DEFINITION_NODE_MAP = rollDefinition.define('featureRollDefinition', ({ map, nodes }) => {
  const { text, number, selectSingle, groupObject } = nodes
  map
    .set('label', text(['label'], 'Label'))
    .set('kind', selectSingle(['kind'], 'Kind', { kind: 'INLINE_OPTIONS', options: [
      { code: 'ATTACK', label: 'Attack' }, { code: 'DAMAGE', label: 'Damage' }, { code: 'HEALING', label: 'Healing' },
      { code: 'ABILITY_CHECK', label: 'Ability Check' }, { code: 'SAVING_THROW', label: 'Saving Throw' }
    ] }))
    .set('expression', groupObject(['expression'], 'Dice', () => DICE_EXPRESSION_NODE_MAP, { presentation: 'inline' }))
    .set('rollMode', selectSingle(['rollMode'], 'Roll Mode', { kind: 'INLINE_OPTIONS', options: [
      { code: 'NORMAL', label: 'Normal' }, { code: 'ADVANTAGE', label: 'Advantage' }, { code: 'DISADVANTAGE', label: 'Disadvantage' }
    ] }))
    .set('chargeCost', number(['chargeCost'], 'Charge Cost'))
    .set('order', number(['order'], 'Order'))
})

const FEATURE_OPTION_CHOICE_NODE_MAP = optionChoice.define(
  'featureOptionChoice',
  ({ map, nodes }) => {
    const { number } = nodes

    map
      .set('level', number(['level'], 'Level'))
      .set('count', number(['count'], 'Count'))
      .set('replaceCount', number(['replaceCount'], 'Replace Count'))
  }
)

const feature = buildNodeMap<FeatureAuthored>()

const FEATURE_STEPS = {
  basics: {
    id: 'basics',
    label: 'Basics',
    description: 'Define this feature and how often it can be used.',
    order: 10
  },
  effects: {
    id: 'effects',
    label: 'Effects',
    description: 'Configure the outcomes this feature produces.',
    order: 20
  },
  grants: {
    id: 'grants',
    label: 'Grants',
    description: 'Add the benefits this feature provides.',
    order: 30
  },
  options: {
    id: 'options',
    label: 'Options',
    description: 'Define selectable variants of this feature.',
    order: 40
  }
} as const

const FEATURE_BASICS_SECTIONS = {
  basics: { id: 'basics', label: 'Feature Basics', order: 10, step: FEATURE_STEPS.basics }
} as const

const FEATURE_SECTIONS = {
  basics: FEATURE_BASICS_SECTIONS.basics,
  effects: { id: 'effects', label: 'Effects', order: 10, step: FEATURE_STEPS.effects },
  usage: { id: 'usage', label: 'Usage', order: 20, step: FEATURE_STEPS.basics },
  restrictions: {
    id: 'restrictions',
    label: 'Restrictions',
    order: 30,
    step: FEATURE_STEPS.basics
  },
  grants: { id: 'grants', label: 'Grants', order: 10, step: FEATURE_STEPS.grants },
  options: { id: 'options', label: 'Options', order: 10, step: FEATURE_STEPS.options }
} as const

export const FEATURE_BASICS_NODE_MAP = feature.define('featureBasics', ({ map, nodes }) => {
  const { text, richText, number } = nodes

  map
    .set('label', text(['label'], 'Name', { section: FEATURE_BASICS_SECTIONS.basics, order: 10 }))
    .set(
      'description',
      richText(['description'], 'Description', {
        section: FEATURE_BASICS_SECTIONS.basics,
        order: 20
      })
    )
    .set(
      'order',
      number(['order'], 'Order', { section: FEATURE_BASICS_SECTIONS.basics, order: 30 })
    )
})

export const FEATURE_NODE_MAP = feature.define('feature', ({ map, nodes, cond }) => {
  const { text, richText, selectMulti, selectSingle, groupArray, groupObject, number } = nodes
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Name', { section: FEATURE_SECTIONS.basics, order: 10 }))
    .set(
      'description',
      richText(['description'], 'Description', { section: FEATURE_SECTIONS.basics, order: 20 })
    )
    .set(
      'availableAtLevel',
      number(['availableAtLevel'], 'Available At Level', {
        section: FEATURE_SECTIONS.basics,
        order: 30
      })
    )
    .set(
      'section',
      selectSingle(
        ['section'],
        'Section',
        {
          kind: 'INLINE_OPTIONS',
          options: FEATURE_SECTION_OPTIONS
        },
        { section: FEATURE_SECTIONS.basics, order: 35 }
      )
    )
    .set(
      'attributes',
      selectMulti(
        ['attributes'],
        'Attributes',
        {
          kind: 'INLINE_OPTIONS',
          options: FEATURE_ATTRIBUTE_OPTIONS
        },
        { section: FEATURE_SECTIONS.basics, order: 40 }
      )
    )
    .set(
      'details',
      groupArray(['details'], 'Details', () => DETAIL_NODE_MAP, {
        presentation: 'inline',
        section: FEATURE_SECTIONS.basics,
        order: 50
      })
    )
    .set('order', number(['order'], 'Order', { section: FEATURE_SECTIONS.basics, order: 60 }))
    .set(
      'effects',
      groupArray(['effects'], 'Effects', () => EFFECT_NODE_MAP, {
        presentation: 'branch',
        section: FEATURE_SECTIONS.effects,
        order: 10
      })
    )
    .set(
      'rollDefinitions',
      groupArray(['rollDefinitions'], 'Rolls', () => FEATURE_ROLL_DEFINITION_NODE_MAP, {
        presentation: 'inline', section: FEATURE_SECTIONS.usage, order: 10
      })
    )
    .set(
      'charges',
      groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, {
        presentation: 'inline',
        section: FEATURE_SECTIONS.usage,
        order: 20,
        showIf: local.field(['attributes']).contains(['LIMITED_USE'])
      })
    )
    .set(
      'restrictions',
      groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP, {
        presentation: 'inline',
        section: FEATURE_SECTIONS.restrictions,
        order: 30,
        authoring: {
          actions: [
            {
              type: 'collection.add',
              label: 'Add',
              presentation: AUTHORING_ACTION_PRESENTATIONS.button
            }
          ]
        }
      })
    )
    .set(
      'grants',
      groupObject(['grants'], 'Grants', () => FEATURE_GRANTS_NODE_MAP, {
        presentation: 'branch',
        section: FEATURE_SECTIONS.grants,
        order: 10
      })
    )
    .set(
      'optionChoices',
      groupArray(['optionChoices'], 'Option Choices', () => FEATURE_OPTION_CHOICE_NODE_MAP, {
        presentation: 'branch',
        section: FEATURE_SECTIONS.options,
        order: 10
      })
    )
    .set(
      'options',
      groupArray(['options'], 'Options', () => OPTION_NODE_MAP, {
        presentation: 'branch',
        section: FEATURE_SECTIONS.options,
        order: 20
      })
    )
})
