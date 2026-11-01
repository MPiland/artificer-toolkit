import type { ModifierGrantAuthored } from '#authored'
import { MAX_ROLLED_DIE_COUNT, ROLLED_DIE_FACES } from '#core'
import { DURATION_NODE_MAP } from '../../shared/maps/duration.js'
import { buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'

export type ModifierGrantUnion = AllUnionFields<ModifierGrantAuthored>
export type ModifierPayload = NonNullable<ModifierGrantUnion['payload']>
type ChargeLimitLevel = NonNullable<
  Extract<ModifierPayload, { levels: unknown[] }>['levels']
>[number]
type RolledDieFacesScaling = NonNullable<AllUnionFields<ModifierPayload>['facesScaling']>
type AttackDecoys = Extract<ModifierPayload, { thresholds: unknown[] }>
type AttackDecoyArmorClass = NonNullable<AttackDecoys['armorClass']>
type AttackDecoyThreshold = NonNullable<AttackDecoys['thresholds']>[number]
type DamageDieCastLevelScaling = NonNullable<
  AllUnionFields<ModifierPayload>['countPerCastLevelAbove']
>

const chargeLimitLevel = buildNodeMap<ChargeLimitLevel>()

export const MODIFIER_CHARGE_LIMIT_LEVEL_NODE_MAP = chargeLimitLevel.define(
  'modifierChargeLimitLevel',
  ({ map, nodes }) => {
    const { text, number } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set('level', number(['level'], 'Level'))
      .set('amount', number(['amount'], 'Amount'))
  }
)

const attackDecoyArmorClass = buildNodeMap<AttackDecoyArmorClass>()

export const MODIFIER_ATTACK_DECOY_ARMOR_CLASS_NODE_MAP = attackDecoyArmorClass.define(
  'modifierAttackDecoyArmorClass',
  ({ map, nodes, data }) => {
    const { number, selectMulti } = nodes

    map.set('amount', number(['amount'], 'Amount')).set(
      'abilities',
      selectMulti(['abilities'], 'Abilities', {
        kind: 'DATA',
        relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
      })
    )
  }
)

const attackDecoyThreshold = buildNodeMap<AttackDecoyThreshold>()

export const MODIFIER_ATTACK_DECOY_THRESHOLD_NODE_MAP = attackDecoyThreshold.define(
  'modifierAttackDecoyThreshold',
  ({ map, nodes }) => {
    const { text, number } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'remaining',
        number(['remaining'], 'Decoys Remaining', { constraints: { minimum: 1, maximum: 20 } })
      )
      .set(
        'minimumRoll',
        number(['minimumRoll'], 'Minimum d20 Roll', { constraints: { minimum: 1, maximum: 21 } })
      )
  }
)

const rolledDieFacesScalingLevel = buildNodeMap<RolledDieFacesScaling['levels'][number]>()

const ROLLED_DIE_FACES_SCALING_LEVEL_NODE_MAP = rolledDieFacesScalingLevel.define(
  'rolledDieFacesScalingLevel',
  ({ map, nodes }) => {
    const { number } = nodes

    map
      .set(
        'level',
        number(['level'], 'From Class Level', { constraints: { minimum: 1, maximum: 20 } })
      )
      .set(
        'faces',
        number(['faces'], 'Die Faces', {
          constraints: { minimum: ROLLED_DIE_FACES[0], maximum: Math.max(...ROLLED_DIE_FACES) }
        })
      )
  }
)

const rolledDieFacesScaling = buildNodeMap<RolledDieFacesScaling>()

export const ROLLED_DIE_FACES_SCALING_NODE_MAP = rolledDieFacesScaling.define(
  'rolledDieFacesScaling',
  ({ map, nodes, data }) => {
    const { selectSingle, groupArray } = nodes

    map
      .set(
        'classId',
        selectSingle(['classId'], 'Granter Class', {
          kind: 'DATA',
          relationship: data.table('classes', { selectColumns: ['id', 'label'] })
        })
      )
      .set(
        'levels',
        groupArray(['levels'], 'Larger Die From', () => ROLLED_DIE_FACES_SCALING_LEVEL_NODE_MAP, {
          presentation: 'table'
        })
      )
  }
)

const damageDieCastLevelScaling = buildNodeMap<DamageDieCastLevelScaling>()

export const DAMAGE_DIE_CAST_LEVEL_SCALING_NODE_MAP = damageDieCastLevelScaling.define(
  'damageDieCastLevelScaling',
  ({ map, nodes }) => {
    const { number } = nodes

    map
      .set(
        'level',
        number(['level'], 'Above Spell Level', { constraints: { minimum: 1, maximum: 9 } })
      )
      .set(
        'count',
        number(['count'], 'Dice Per Level', {
          constraints: { minimum: 1, maximum: MAX_ROLLED_DIE_COUNT }
        })
      )
  }
)

const incomingGateSuccessImmunity =
  buildNodeMap<NonNullable<AllUnionFields<ModifierPayload>['successImmunity']>>()

export const INCOMING_GATE_SUCCESS_IMMUNITY_NODE_MAP = incomingGateSuccessImmunity.define(
  'incomingGateSuccessImmunity',
  ({ map, nodes }) => {
    map.set(
      'duration',
      nodes.groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true
      })
    )
  }
)

const damageInterceptionSave = buildNodeMap<NonNullable<AllUnionFields<ModifierPayload>['save']>>()

const DAMAGE_INTERCEPTION_SAVE_DC_NODE_MAP = buildNodeMap<
  NonNullable<AllUnionFields<ModifierPayload>['save']>['dc']
>().define('damageInterceptionSaveDc', ({ map, nodes }) => {
  map
    .set('base', nodes.number(['base'], 'Base DC', { constraints: { minimum: 0, maximum: 100 } }))
    .set('plusDamageTaken', nodes.toggle(['plusDamageTaken'], 'Add The Damage Taken'))
    .set(
      'plusPerChargeUsed',
      nodes.number(['plusPerChargeUsed'], 'Add Per Charge Already Used', {
        constraints: { minimum: 0, maximum: 100 }
      })
    )
})

export const DAMAGE_INTERCEPTION_SAVE_NODE_MAP = damageInterceptionSave.define(
  'damageInterceptionSave',
  ({ map, nodes, data }) => {
    map
      .set(
        'ability',
        nodes.selectSingle(['ability'], 'Save Ability', {
          kind: 'DATA',
          relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set(
        'dc',
        nodes.groupObject(['dc'], 'Save DC', () => DAMAGE_INTERCEPTION_SAVE_DC_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
      .set(
        'spendsUseOnFailure',
        nodes.toggle(['spendsUseOnFailure'], 'A Failed Save Still Spends A Use')
      )
  }
)

export const DAMAGE_INTERCEPTION_EXCLUDES_NODE_MAP = buildNodeMap<
  NonNullable<AllUnionFields<ModifierPayload>['excludes']>
>().define('damageInterceptionExcludes', ({ map, nodes, data }) => {
  const { table } = data
  map
    .set(
      'damageTypeIds',
      nodes.selectMulti(['damageTypeIds'], 'Damage Types Not Intercepted', {
        kind: 'DATA',
        relationship: table('damage_types', { selectColumns: ['id', 'label', 'description'] })
      })
    )
    .set('critical', nodes.toggle(['critical'], 'Critical Hits Not Intercepted'))
})
