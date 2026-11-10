import type {
  ActivationAuthored,
  CastModifierAuthored,
  CastModifierCountAuthored,
  CastModifierParameterAuthored,
  EffectInvocationKind,
  EffectInvocationAuthored,
  OptionalOnHitAuthored,
  ReactionHigherLevelCheckAuthored,
  ReactionTriggerBindingAuthored,
  ResourceUseAuthored,
  SparesCreaturesAuthored
} from '#authored'
import { ACTIVATION_OPTIONS, EQUIPMENT_CATEGORY_OPTIONS, TRIGGER_OPTIONS } from '#core'
import { buildNodeMap, type NodeMap, type NodeSelectSource } from '#utils'
import {
  MEASUREMENT_NODE_MAP,
  RANGE_NODE_MAP,
  SAVING_THROW_NODE_MAP,
  SHAPE_NODE_MAP
} from '../../shared/maps/index.js'
import { CHECK_NODE_MAP } from './check.js'
import { SIZE_RANGE_NODE_MAP } from './sizeRange.js'
import { TARGETING_NODE_MAP } from './targeting.js'

/**
 * The resource pools an effect can spend or restore: the `charges` of the record being authored,
 * plus those of its parent class.
 */
export const CHARGE_SELECT_SOURCE: NodeSelectSource = {
  kind: 'DOCUMENT_OBJECTS',
  key: 'charges',
  parent: { idPath: ['parentClassId'], documentTable: 'classes' }
}

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
  const { selectSingle, number } = nodes

  map
    .set(
      'chargeId',
      selectSingle(['chargeId'], 'Resource pool', CHARGE_SELECT_SOURCE, { requiredIf: true })
    )
    .set('cost', number(['cost'], 'Cost', { constraints: { minimum: 1 }, requiredIf: true }))
})

const CAST_MODIFIER_OUTCOME_OPTIONS: {
  code: NonNullable<CastModifierAuthored['targets']>['outcome']
  label: string
}[] = [
  { code: 'SAVE_AUTO_SUCCESS', label: 'Their save succeeds' },
  { code: 'SAVE_DISADVANTAGE', label: 'Their save has disadvantage' },
  { code: 'EXTRA_TARGET', label: 'They are further targets of the spell' }
]

const castModifierTargets = buildNodeMap<NonNullable<CastModifierAuthored['targets']>>()

const CAST_MODIFIER_TARGETS_NODE_MAP = castModifierTargets.define(
  'castModifierTargets',
  ({ map, nodes, data }) => {
    const { selectSingle, number } = nodes
    const { table } = data

    map
      .set(
        'outcome',
        selectSingle(
          ['outcome'],
          'Outcome for the creatures you name',
          { kind: 'INLINE_OPTIONS', options: CAST_MODIFIER_OUTCOME_OPTIONS },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'base',
        number(['base'], 'Creatures named', {
          order: 2,
          constraints: { minimum: 0 },
          requiredIf: true
        })
      )
      .set(
        'abilityDefinitionId',
        selectSingle(
          ['abilityDefinitionId'],
          'Plus the modifier of',
          {
            kind: 'DATA',
            relationship: table('ability_definitions', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { order: 3 }
        )
      )
      .set('minimum', number(['minimum'], 'At least', { order: 4, constraints: { minimum: 0 } }))
  }
)

const castModifierDamageRerolls = buildNodeMap<CastModifierCountAuthored>()

const CAST_MODIFIER_DAMAGE_REROLLS_NODE_MAP = castModifierDamageRerolls.define(
  'castModifierDamageRerolls',
  ({ map, nodes, data }) => {
    const { selectSingle, number } = nodes
    const { table } = data

    map
      .set(
        'base',
        number(['base'], 'Damage dice rerolled', {
          order: 1,
          constraints: { minimum: 0 },
          requiredIf: true
        })
      )
      .set(
        'abilityDefinitionId',
        selectSingle(
          ['abilityDefinitionId'],
          'Plus the modifier of',
          {
            kind: 'DATA',
            relationship: table('ability_definitions', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { order: 2 }
        )
      )
      .set('minimum', number(['minimum'], 'At least', { order: 3, constraints: { minimum: 0 } }))
  }
)

const castModifierParameter = buildNodeMap<CastModifierParameterAuthored>()

const CAST_MODIFIER_PARAMETER_NODE_MAP = castModifierParameter.define(
  'castModifierParameter',
  ({ map, nodes, cond, logic }) => {
    const { selectSingle, number, groupObject } = nodes
    const isRange = cond.local().field(['parameter']).eq('RANGE')
    const isActivation = cond.local().field(['parameter']).eq('ACTIVATION')
    const isDuration = cond.local().field(['parameter']).eq('DURATION')
    const multiplies = logic.or([isRange, isDuration])

    map
      .set(
        'parameter',
        selectSingle(
          ['parameter'],
          'Changes',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'RANGE', label: 'The spell’s range' },
              { code: 'ACTIVATION', label: 'What the spell takes to cast' },
              { code: 'DURATION', label: 'How long the spell lasts' }
            ]
          },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'multiplier',
        number(['multiplier'], 'Multiplied by', {
          order: 2,
          constraints: { minimum: 2 },
          requiredIf: multiplies,
          showIf: multiplies,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'touchDistance',
        groupObject(['touchDistance'], 'A Touch range becomes', () => MEASUREMENT_NODE_MAP, {
          presentation: 'inline',
          order: 3,
          requiredIf: isRange,
          showIf: isRange,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'activation',
        selectSingle(
          ['activation'],
          'Cast as',
          { kind: 'INLINE_OPTIONS', options: [{ code: 'BONUS_ACTION', label: 'A Bonus Action' }] },
          {
            order: 4,
            requiredIf: isActivation,
            showIf: isActivation,
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'minimumMinutes',
        number(['minimumMinutes'], 'For a spell lasting at least (minutes)', {
          order: 5,
          constraints: { minimum: 1 },
          requiredIf: isDuration,
          showIf: isDuration,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'maximumHours',
        number(['maximumHours'], 'Duration multiplied, up to (hours)', {
          order: 6,
          constraints: { minimum: 1 },
          requiredIf: isDuration,
          showIf: isDuration,
          hiddenBehavior: 'CLEAR'
        })
      )
  }
)

const castModifier = buildNodeMap<CastModifierAuthored>()

const CAST_MODIFIER_NODE_MAP = castModifier.define('castModifier', ({ map, nodes }) => {
  const { selectSingle, number, toggle, groupObject, groupArray } = nodes

  map
    .set(
      'chargeId',
      selectSingle(['chargeId'], 'Resource pool', CHARGE_SELECT_SOURCE, {
        order: 1,
        requiredIf: true
      })
    )
    .set(
      'cost',
      number(['cost'], 'Cost', { order: 2, constraints: { minimum: 1 }, requiredIf: true })
    )
    .set('perSpellLevel', toggle(['perSpellLevel'], "Times the spell's level", { order: 3 }))
    .set(
      'parameters',
      groupArray(['parameters'], 'Changes to the cast', () => CAST_MODIFIER_PARAMETER_NODE_MAP, {
        presentation: 'inline',
        order: 4
      })
    )
    .set(
      'targets',
      groupObject(['targets'], 'Creatures it affects', () => CAST_MODIFIER_TARGETS_NODE_MAP, {
        presentation: 'inline',
        order: 4
      })
    )
    .set(
      'damageRerolls',
      groupObject(
        ['damageRerolls'],
        'Rerolls damage dice after the roll',
        () => CAST_MODIFIER_DAMAGE_REROLLS_NODE_MAP,
        { presentation: 'inline', order: 5 }
      )
    )
})

const OPTIONAL_ON_HIT_KIND_OPTIONS: { code: OptionalOnHitAuthored['kind']; label: string }[] = [
  { code: 'FREE', label: 'Nothing' },
  { code: 'SPELL_SLOT', label: 'A spell slot of a level you choose' },
  { code: 'RESOURCE_POOL', label: 'Charges from a resource pool' }
]

const optionalOnHit = buildNodeMap<OptionalOnHitAuthored>()

const OPTIONAL_ON_HIT_NODE_MAP = optionalOnHit.define('optionalOnHit', ({ map, nodes, cond }) => {
  const { selectSingle, number } = nodes
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
      selectSingle(['chargeId'], 'Resource pool', CHARGE_SELECT_SOURCE, {
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

const sparesCreatures = buildNodeMap<SparesCreaturesAuthored>()

const SPARES_CREATURES_NODE_MAP = sparesCreatures.define(
  'sparesCreatures',
  ({ map, nodes, data }) => {
    const { number, toggle, selectMulti } = nodes
    const { table } = data

    map
      .set(
        'base',
        number(['base'], 'Creatures spared', { constraints: { minimum: 0 }, requiredIf: true })
      )
      .set('plusSpellLevel', toggle(['plusSpellLevel'], "Plus the spell's level"))
      .set(
        'magicSchoolIds',
        selectMulti(['magicSchoolIds'], 'Only spells of the schools', {
          kind: 'DATA',
          relationship: table('magic_schools', { selectColumns: ['id', 'label', 'description'] })
        })
      )
  }
)

const REACTION_TRIGGER_KIND_OPTIONS: {
  code: ReactionTriggerBindingAuthored['kind']
  label: string
}[] = [
  { code: 'MOVEMENT', label: 'A creature moves' },
  { code: 'ATTACKED_SELF', label: 'You are hit by an attack' },
  { code: 'SPELL_CAST', label: 'A creature casts a spell' },
  { code: 'ATTACK_ROLL_BY_OTHER', label: 'A creature makes an attack roll' },
  { code: 'ATTACK_ON_OTHER', label: 'A creature attacks another creature near you' },
  { code: 'ATTACK_RESOLVED_ON_SELF', label: 'An attack against you hits or misses' },
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
  ({ map, nodes, cond, logic, data }) => {
    const { selectSingle, selectMulti, text, groupObject, toggle, number } = nodes
    const { table } = data
    const local = cond.local()
    const isMovement = local.field(['kind']).eq('MOVEMENT')
    const isDamageTaken = local.field(['kind']).eq('DAMAGE_TAKEN')
    const isSpellCast = local.field(['kind']).eq('SPELL_CAST')
    const isTargetedSelf = local.field(['kind']).eq('TARGETED_SELF')
    const isAttackedSelf = local.field(['kind']).eq('ATTACKED_SELF')
    const isAttackOnOther = local.field(['kind']).eq('ATTACK_ON_OTHER')
    const isAttackResolvedOnSelf = local.field(['kind']).eq('ATTACK_RESOLVED_ON_SELF')
    const answersAnAttacker = logic.or([isAttackedSelf, isAttackOnOther, isAttackResolvedOnSelf])
    const filtersAttackerSize = logic.or([isAttackOnOther, isAttackResolvedOnSelf])

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
          showIf: answersAnAttacker,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'targetWithinFeet',
        number(['targetWithinFeet'], 'Attack target within (ft) of you', {
          order: 11,
          constraints: { minimum: 1 },
          requiredIf: isAttackOnOther,
          showIf: isAttackOnOther,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'holderEquippedCategory',
        selectSingle(
          ['holderEquippedCategory'],
          'Only while you have equipped',
          { kind: 'INLINE_OPTIONS', options: EQUIPMENT_CATEGORY_OPTIONS },
          { order: 12, showIf: isAttackOnOther, hiddenBehavior: 'CLEAR' }
        )
      )
      .set(
        'outcome',
        selectSingle(
          ['outcome'],
          'The attack',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'HIT', label: 'Hits you' },
              { code: 'MISS', label: 'Misses you' },
              { code: 'ANY', label: 'Hits or misses you' }
            ]
          },
          {
            order: 13,
            requiredIf: isAttackResolvedOnSelf,
            showIf: isAttackResolvedOnSelf,
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'attackerWithinFeet',
        number(['attackerWithinFeet'], 'Attacker within (ft) of you', {
          order: 14,
          constraints: { minimum: 1 },
          showIf: isAttackResolvedOnSelf,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'attackerSize',
        groupObject(['attackerSize'], 'Attacker size', () => SIZE_RANGE_NODE_MAP, {
          presentation: 'inline',
          order: 15,
          showIf: filtersAttackerSize,
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
        'castModifier',
        groupObject(['castModifier'], 'Cast Modifier', () => CAST_MODIFIER_NODE_MAP, {
          presentation: 'inline',
          order: 7,
          showIf: local.field(['kind']).eq('PASSIVE')
        })
      )
      .set(
        'sparesCreatures',
        groupObject(['sparesCreatures'], 'Spares Creatures', () => SPARES_CREATURES_NODE_MAP, {
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
