import type {
  ActivationAuthored,
  EffectInvocationKind,
  EffectInvocationAuthored,
  OptionalOnHitAuthored,
  ReactionHigherLevelCheckAuthored,
  ReactionTriggerBindingAuthored,
  ResourceUseAuthored
} from '#authored'
import { ACTIVATION_OPTIONS, TRIGGER_OPTIONS } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'
import { RANGE_NODE_MAP, SAVING_THROW_NODE_MAP, SHAPE_NODE_MAP } from '../../shared/maps/index.js'
import { CHECK_NODE_MAP } from './check.js'
import { TARGETING_NODE_MAP } from './targeting.js'

const INVOCATION_KIND_OPTIONS: { code: EffectInvocationKind; label: string }[] = [
  { code: 'ACTION', label: 'Action' },
  { code: 'PASSIVE', label: 'Passive' }
]

const activation = buildNodeMap<ActivationAuthored>()
const resourceUse = buildNodeMap<ResourceUseAuthored>()

export const ACTIVATION_NODE_MAP = activation.define(
  'activation',
  ({ map, nodes, cond, logic }) => {
    const { selectSingle, number } = nodes
    const { not } = logic
    const local = cond.local()

    map
      .set(
        'code',
        selectSingle(
          ['code'],
          'Activation',
          {
            kind: 'INLINE_OPTIONS',
            options: ACTIVATION_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Amount', {
          order: 2,
          requiredIf: true,
          showIf: not(local.field(['code']).eq('FREE'))
        })
      )
  }
)

const RESOURCE_USE_NODE_MAP = resourceUse.define('resourceUse', ({ map, nodes }) => {
  const { text, number } = nodes

  map
    .set('chargeId', text(['chargeId'], 'Charge ID', { requiredIf: true }))
    .set('cost', number(['cost'], 'Cost', { constraints: { minimum: 1 }, requiredIf: true }))
})

const OPTIONAL_ON_HIT_KIND_OPTIONS: { code: OptionalOnHitAuthored['kind']; label: string }[] = [
  { code: 'SPELL_SLOT', label: 'A spell slot of a level you choose' },
  { code: 'RESOURCE_POOL', label: 'Charges from a resource pool' }
]

const optionalOnHit = buildNodeMap<OptionalOnHitAuthored>()

const OPTIONAL_ON_HIT_NODE_MAP = optionalOnHit.define('optionalOnHit', ({ map, nodes, cond }) => {
  const { selectSingle, text, number } = nodes
  const isResourcePool = cond.local().field(['kind']).eq('RESOURCE_POOL')

  map
    .set(
      'kind',
      selectSingle(
        ['kind'],
        'Cost',
        { kind: 'INLINE_OPTIONS', options: OPTIONAL_ON_HIT_KIND_OPTIONS },
        { order: 1, requiredIf: true }
      )
    )
    .set(
      'chargeId',
      text(['chargeId'], 'Charge ID', {
        order: 2,
        requiredIf: isResourcePool,
        showIf: isResourcePool,
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'cost',
      number(['cost'], 'Cost', {
        order: 3,
        constraints: { minimum: 1 },
        requiredIf: isResourcePool,
        showIf: isResourcePool,
        hiddenBehavior: 'CLEAR'
      })
    )
})

const REACTION_TRIGGER_KIND_OPTIONS: {
  code: ReactionTriggerBindingAuthored['kind']
  label: string
}[] = [
  { code: 'MOVEMENT', label: 'A creature moves' },
  { code: 'ATTACKED_SELF', label: 'You are hit by an attack' },
  { code: 'SPELL_CAST', label: 'A creature casts a spell' },
  { code: 'DAMAGE_TAKEN', label: 'You take damage' },
  { code: 'TARGETED_SELF', label: 'You are chosen as a target' }
]

const higherLevelCheck = buildNodeMap<ReactionHigherLevelCheckAuthored>()

export const HIGHER_LEVEL_CHECK_NODE_MAP = higherLevelCheck.define(
  'higherLevelCheck',
  ({ map, nodes, data }) => {
    const { selectSingle, number } = nodes

    map
      .set(
        'ability',
        selectSingle(
          ['ability'],
          'Check ability',
          {
            kind: 'DATA',
            relationship: data.table('ability_modifier_references', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'baseDc',
        number(['baseDc'], 'Base DC (plus the spell level)', {
          order: 2,
          requiredIf: true,
          constraints: { minimum: 0 }
        })
      )
  }
)

const reactionTrigger = buildNodeMap<ReactionTriggerBindingAuthored>()

const REACTION_TRIGGER_NODE_MAP = reactionTrigger.define(
  'reactionTrigger',
  ({ map, nodes, cond, data }) => {
    const { selectSingle, selectMulti, text, groupObject, toggle } = nodes
    const { table } = data
    const local = cond.local()
    const isMovement = local.field(['kind']).eq('MOVEMENT')
    const isDamageTaken = local.field(['kind']).eq('DAMAGE_TAKEN')
    const isSpellCast = local.field(['kind']).eq('SPELL_CAST')
    const isTargetedSelf = local.field(['kind']).eq('TARGETED_SELF')
    const isAttackedSelf = local.field(['kind']).eq('ATTACKED_SELF')

    map
      .set(
        'kind',
        selectSingle(
          ['kind'],
          'Reaction trigger',
          { kind: 'INLINE_OPTIONS', options: REACTION_TRIGGER_KIND_OPTIONS },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'stage',
        selectSingle(
          ['stage'],
          'Movement stage',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'BEFORE_LEAVE_REACH', label: 'Before it leaves your reach' },
              { code: 'ENTER_REACH', label: 'As it enters your reach' }
            ]
          },
          { order: 2, requiredIf: isMovement, showIf: isMovement }
        )
      )
      .set(
        'perceptionRequirement',
        selectSingle(
          ['perceptionRequirement'],
          'Perception requirement',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'DETECT', label: 'Detect' },
              { code: 'LOCATE', label: 'Locate' },
              { code: 'PRECISE', label: 'Precisely perceive' },
              { code: 'SEE', label: 'See' }
            ]
          },
          { order: 3, showIf: isMovement }
        )
      )
      .set(
        'eligibilityDefinitionId',
        text(['eligibilityDefinitionId'], 'Eligibility definition ID', {
          order: 4,
          requiredIf: isMovement,
          showIf: isMovement
        })
      )
      .set(
        'damageTypeIds',
        selectMulti(
          ['damageTypeIds'],
          'Damage types',
          {
            kind: 'DATA',
            relationship: table('damage_types', { selectColumns: ['id', 'label', 'description'] })
          },
          { order: 5, requiredIf: isDamageTaken, showIf: isDamageTaken }
        )
      )
      .set(
        'sourceEffectIds',
        selectMulti(
          ['sourceEffectIds'],
          'Only actions from these spells',
          {
            kind: 'DATA',
            relationship: table('spells', { selectColumns: ['id', 'label'] })
          },
          { order: 7, showIf: isTargetedSelf, hiddenBehavior: 'CLEAR' }
        )
      )
      .set(
        'higherLevelCheck',
        groupObject(
          ['higherLevelCheck'],
          'Check for a higher-level spell',
          () => HIGHER_LEVEL_CHECK_NODE_MAP,
          { presentation: 'inline', order: 6, showIf: isSpellCast }
        )
      )
      .set(
        'attackRange',
        selectSingle(
          ['attackRange'],
          'Only against',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'MELEE', label: 'A melee attack' },
              { code: 'RANGED', label: 'A ranged attack' }
            ]
          },
          { order: 8, showIf: isAttackedSelf, hiddenBehavior: 'CLEAR' }
        )
      )
      .set(
        'weaponOnly',
        toggle(['weaponOnly'], 'Only against a weapon attack', {
          order: 10,
          showIf: isAttackedSelf,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'requiresSight',
        toggle(['requiresSight'], 'Only against an attacker you see', {
          order: 9,
          showIf: isAttackedSelf,
          hiddenBehavior: 'CLEAR'
        })
      )
  }
)

const invocation = buildNodeMap<EffectInvocationAuthored>()

export type InvocationNodeMap = NodeMap<EffectInvocationAuthored>

export const INVOCATION_NODE_MAP: InvocationNodeMap = invocation.define(
  'invocation',
  ({ map, nodes, cond, logic, data }) => {
    const { selectSingle, selectMulti, groupObject } = nodes
    const { table } = data
    const { or } = logic
    const local = cond.local()

    map
      .set(
        'kind',
        selectSingle(
          ['kind'],
          'Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: INVOCATION_KIND_OPTIONS
          },
          {
            order: 1,
            requiredIf: true
          }
        )
      )
      .set(
        'triggerCode',
        selectSingle(
          ['triggerCode'],
          'Trigger',
          {
            kind: 'INLINE_OPTIONS',
            options: TRIGGER_OPTIONS
          },
          {
            order: 2,
            requiredIf: true
          }
        )
      )
      .set(
        'savingThrow',
        groupObject(['savingThrow'], 'Saving Throw', () => SAVING_THROW_NODE_MAP, {
          presentation: 'inline',
          order: 3,
          showIf: or([
            local.field(['triggerCode']).eq('SAVING_THROW'),
            local.field(['triggerCode']).eq('HP_ZERO')
          ])
        })
      )
      .set(
        'check',
        groupObject(['check'], 'Check', () => CHECK_NODE_MAP, {
          presentation: 'inline',
          order: 3,
          requiredIf: local.field(['triggerCode']).eq('CHECK'),
          showIf: local.field(['triggerCode']).eq('CHECK')
        })
      )
      .set(
        'activation',
        groupObject(['activation'], 'Activation', () => ACTIVATION_NODE_MAP, {
          presentation: 'inline',
          order: 4,
          requiredIf: true,
          showIf: local.field(['kind']).eq('ACTION')
        })
      )
      .set(
        'reactionTrigger',
        groupObject(['reactionTrigger'], 'Reaction Trigger', () => REACTION_TRIGGER_NODE_MAP, {
          presentation: 'inline',
          order: 5,
          showIf: local.field(['kind']).eq('ACTION')
        })
      )
      .set(
        'resourceUse',
        groupObject(['resourceUse'], 'Resource Use', () => RESOURCE_USE_NODE_MAP, {
          presentation: 'inline',
          order: 6,
          showIf: local.field(['kind']).eq('ACTION')
        })
      )
      .set(
        'damageTypeIds',
        selectMulti(
          ['damageTypeIds'],
          'Damage types',
          {
            kind: 'DATA',
            relationship: table('damage_types', { selectColumns: ['id', 'label', 'description'] })
          },
          {
            order: 7,
            requiredIf: local.field(['triggerCode']).eq('INCOMING_DAMAGE'),
            showIf: local.field(['triggerCode']).eq('INCOMING_DAMAGE'),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'optionalOnHit',
        groupObject(['optionalOnHit'], 'Optional On Hit', () => OPTIONAL_ON_HIT_NODE_MAP, {
          presentation: 'inline',
          order: 7,
          showIf: local.field(['kind']).eq('PASSIVE')
        })
      )
      .set(
        'ridesFeatureId',
        selectSingle(
          ['ridesFeatureId'],
          'Rides only the attacks of',
          {
            kind: 'LOCAL_COLLECTION',
            rootCollectionPath: ['features'],
            valuePath: ['id'],
            labelPath: ['label']
          },
          {
            order: 7,
            showIf: local.field(['kind']).eq('PASSIVE'),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'ridesSpellIds',
        selectMulti(
          ['ridesSpellIds'],
          'Rides only the casts of',
          {
            kind: 'DATA',
            relationship: table('spells', { selectColumns: ['id', 'label'] })
          },
          {
            order: 7,
            showIf: local.field(['kind']).eq('PASSIVE'),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'range',
        groupObject(['range'], 'Range', () => RANGE_NODE_MAP, {
          presentation: 'inline',
          order: 8,
          requiredIf: true
        })
      )
      .set(
        'shape',
        groupObject(['shape'], 'Shape', () => SHAPE_NODE_MAP, { presentation: 'inline', order: 9 })
      )
      .set(
        'targeting',
        groupObject(['targeting'], 'Targeting', () => TARGETING_NODE_MAP, {
          presentation: 'inline',
          order: 10
        })
      )
  }
)
