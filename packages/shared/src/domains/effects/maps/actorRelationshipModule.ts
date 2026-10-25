import type { ActorRelationshipModuleAuthored } from '#authored'
import { LENGTH_UNIT_OPTIONS } from '#core'
import { buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'
import { CHECK_CHOICE_NODE_MAP, ESCAPE_DC_NODE_MAP } from './check.js'
import { EFFECT_ID_NODE_MAP } from '../../shared/maps/index.js'
import { ACTIVATION_NODE_MAP } from './invocation.js'

const actorRelationshipModule = buildNodeMap<AllUnionFields<ActorRelationshipModuleAuthored>>()

export const ACTOR_RELATIONSHIP_MODULE_NODE_MAP = actorRelationshipModule.define(
  'actorRelationshipModule',
  ({ map, nodes, cond, logic: { or }, data }) => {
    const { text, number, selectSingle, selectMulti, groupObject, groupArray } = nodes
    const local = cond.local()
    const { table } = data
    const releaseCost = local.field(['kind']).eq('SOURCE_RELEASE_MOVEMENT_COST')
    const isActionEffectModule = or([
      local.field(['kind']).eq('SOURCE_ACTION_TARGET_RESTRICTION'),
      local.field(['kind']).eq('SOURCE_ATTACK_ROLL_INFLUENCE')
    ])
    const isCapabilityModule = or([
      local.field(['kind']).eq('TARGET_CAPABILITY_SUPPRESSION'),
      local.field(['kind']).eq('CONDITIONAL_TARGET_STATE')
    ])

    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order'))
      .set(
        'kind',
        selectSingle(['kind'], 'Module', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'TARGET_SIZE_MAXIMUM', label: 'Target Size Maximum' },
            { code: 'SOURCE_ACTION_TARGET_RESTRICTION', label: 'Source Action Restriction' },
            { code: 'SOURCE_ATTACK_ROLL_INFLUENCE', label: 'Source Attack Influence' },
            { code: 'SOURCE_FOLLOWS_TARGET', label: 'Source Follows Target' },
            { code: 'SOURCE_OCCUPIES_HAND', label: 'Source Occupies Hand' },
            { code: 'SOURCE_INDEPENDENT_HOLD', label: 'Source Independent Hold' },
            { code: 'TARGET_DRAGGED', label: 'Target Dragged' },
            { code: 'SOURCE_RELEASE_MOVEMENT_COST', label: 'Release Movement Cost' },
            { code: 'ESCAPE_CHECK', label: 'Escape Check' },
            { code: 'TARGET_CAPABILITY_SUPPRESSION', label: 'Capability Suppression' },
            { code: 'CONDITIONAL_TARGET_STATE', label: 'Conditional Target State' }
          ]
        })
      )
      .set(
        'sizeCode',
        selectSingle(
          ['sizeCode'],
          'Maximum Size',
          {
            kind: 'DATA',
            relationship: table('sizes', { selectColumns: ['id', 'label', 'description'] })
          },
          { showIf: local.field(['kind']).eq('TARGET_SIZE_MAXIMUM') }
        )
      )
      .set(
        'actionEffectIds',
        groupArray(['actionEffectIds'], 'Action Effects', () => EFFECT_ID_NODE_MAP, {
          presentation: 'inline',
          showIf: isActionEffectModule
        })
      )
      .set(
        'influence',
        selectSingle(
          ['influence'],
          'Influence',
          {
            kind: 'DATA',
            relationship: table('roll_influences', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { showIf: local.field(['kind']).eq('SOURCE_ATTACK_ROLL_INFLUENCE') }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Movement Cost', { constraints: { minimum: 0 }, showIf: releaseCost })
      )
      .set(
        'unit',
        selectSingle(
          ['unit'],
          'Unit',
          { kind: 'INLINE_OPTIONS', options: LENGTH_UNIT_OPTIONS },
          { showIf: releaseCost }
        )
      )
      .set(
        'activation',
        groupObject(['activation'], 'Activation', () => ACTIVATION_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['kind']).eq('ESCAPE_CHECK')
        })
      )
      .set(
        'checks',
        groupObject(['checks'], 'Escape Checks', () => CHECK_CHOICE_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['kind']).eq('ESCAPE_CHECK')
        })
      )
      .set(
        'dc',
        groupObject(['dc'], 'Escape DC', () => ESCAPE_DC_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['kind']).eq('ESCAPE_CHECK')
        })
      )
      .set(
        'actorKinds',
        selectMulti(
          ['actorKinds'],
          'Eligible Actors',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'TARGET', label: 'Target' },
              { code: 'CREATURE_WITHIN_REACH', label: 'Creature Within Reach' }
            ]
          },
          { showIf: local.field(['kind']).eq('ESCAPE_CHECK') }
        )
      )
      .set(
        'capabilityDefinitionIds',
        selectMulti(
          ['capabilityDefinitionIds'],
          'Capabilities',
          {
            kind: 'DATA',
            relationship: table('reusable_definitions', { selectColumns: ['id', 'label'] })
          },
          { showIf: isCapabilityModule }
        )
      )
      .set(
        'conditionIds',
        selectMulti(
          ['conditionIds'],
          'Conditions',
          {
            kind: 'DATA',
            relationship: table('condition_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { showIf: local.field(['kind']).eq('CONDITIONAL_TARGET_STATE') }
        )
      )
      .set(
        'whenResolvedAttackD20Mode',
        selectSingle(
          ['whenResolvedAttackD20Mode'],
          'When Attack Mode Is',
          {
            kind: 'DATA',
            relationship: table('roll_modes', { selectColumns: ['id', 'label', 'description'] })
          },
          { showIf: local.field(['kind']).eq('CONDITIONAL_TARGET_STATE') }
        )
      )
  }
)
