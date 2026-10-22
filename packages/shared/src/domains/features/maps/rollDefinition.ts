import type { FeatureRollDefinitionAuthored } from '#authored'
import type { DiceExpression } from '#core'
import { buildNodeMap } from '#utils'

const diceExpression = buildNodeMap<DiceExpression>()

const DICE_EXPRESSION_NODE_MAP = diceExpression.define(
  'featureRollExpression',
  ({ map, nodes }) => {
    const { number } = nodes
    map
      .set('count', number(['count'], 'Dice'))
      .set('die', number(['die'], 'Die'))
      .set('modifier', number(['modifier'], 'Modifier'))
  }
)

const rollDefinition = buildNodeMap<FeatureRollDefinitionAuthored>()

export const FEATURE_ROLL_DEFINITION_NODE_MAP = rollDefinition.define(
  'featureRollDefinition',
  ({ map, nodes, data }) => {
    const { text, number, selectSingle, groupObject } = nodes
    const { table } = data
    map
      .set('label', text(['label'], 'Label'))
      .set(
        'kind',
        selectSingle(['kind'], 'Kind', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ATTACK', label: 'Attack' },
            { code: 'DAMAGE', label: 'Damage' },
            { code: 'HEALING', label: 'Healing' },
            { code: 'ABILITY_CHECK', label: 'Ability Check' },
            { code: 'SAVING_THROW', label: 'Saving Throw' }
          ]
        })
      )
      .set(
        'expression',
        groupObject(['expression'], 'Dice', () => DICE_EXPRESSION_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'rollMode',
        selectSingle(['rollMode'], 'Roll Mode', {
          kind: 'DATA',
          relationship: table('roll_modes', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set('chargeCost', number(['chargeCost'], 'Charge Cost'))
      .set('order', number(['order'], 'Order'))
  }
)
