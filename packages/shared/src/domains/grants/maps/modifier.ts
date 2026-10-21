import type { ModifierGrantAuthored } from '#authored'
import {
  ABILITY_MODIFIER_REFERENCE_OPTIONS,
  ABILITY_OPTIONS,
  ATTACK_DOMAIN_OPTIONS,
  ATTACK_OCCASION_OPTIONS,
  AUTHORING_SELECTION_REGISTRY,
  CHARGE_LIMIT_OPTIONS,
  CHARGE_RESET_OPTIONS,
  CHARGE_SCALING_OPTIONS,
  DAMAGE_DEFENSE_BYPASS_OPTIONS,
  DAMAGE_DIE_RECIPIENT_OPTIONS,
  DURATION_OPTIONS,
  LENGTH_UNIT_OPTIONS,
  MODIFIER_KIND_OPTIONS,
  MODIFIER_SCOPE_OPTIONS,
  MAX_ROLLED_DIE_COUNT,
  MODIFIER_VALUE_SOURCE_OPTIONS,
  RANGE_OPTIONS,
  ROLLED_DIE_FACES,
  ROLLED_DIE_SIGN_OPTIONS,
  ROLLED_DIE_TIMING_OPTIONS,
  SHAPE_KIND_OPTIONS,
  VALUE_DOMAIN_OPTIONS
} from '#core'
import { DURATION_NODE_MAP } from '../../shared/maps/duration.js'
import { FACET_NODE_MAP } from '../../shared/maps/facet.js'
import { SAVING_THROW_NODE_MAP } from '../../shared/maps/savingThrow.js'
import { AUTHORED_LENGTH_AMOUNT_MAX, AUTHORING_ACTION_PRESENTATIONS, buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'

type ModifierGrantUnion = AllUnionFields<ModifierGrantAuthored>
type ModifierPayload = NonNullable<ModifierGrantUnion['payload']>
type ModifierDomain = ModifierGrantUnion['domain']
type ChargeLimitLevel = NonNullable<
  Extract<ModifierPayload, { levels: unknown[] }>['levels']
>[number]
type AttackDecoys = Extract<ModifierPayload, { thresholds: unknown[] }>
type AttackDecoyArmorClass = NonNullable<AttackDecoys['armorClass']>
type AttackDecoyThreshold = NonNullable<AttackDecoys['thresholds']>[number]
type DamageDieCastLevelScaling = NonNullable<
  AllUnionFields<ModifierPayload>['countPerCastLevelAbove']
>

const modifierGrantDomain = buildNodeMap<ModifierDomain>()

const MODIFIER_GRANT_DOMAIN_NODE_MAP = modifierGrantDomain.define(
  'modifierGrantDomain',
  ({ map, nodes, cond, data, logic }) => {
    const { selectSingle, selectMulti, number, toggle } = nodes
    const parent = cond.parent<ModifierGrantUnion>()
    const { and, or } = logic
    const { table } = data

    map
      .set(
        'ability',
        selectSingle(
          ['ability'],
          'Ability',
          {
            kind: 'INLINE_OPTIONS',
            options: ABILITY_OPTIONS
          },
          {
            showIf: or([
              parent.field(['valueDomainCode']).eq('ABILITY_SCORE'),
              parent.field(['valueDomainCode']).eq('ABILITY_CHECK'),
              parent.field(['valueDomainCode']).eq('SAVING_THROW_MODIFIER'),
              // An attack roll's advantage or disadvantage may cover only attacks made with an ability.
              and([
                parent.field(['valueDomainCode']).eq('ATTACK_ROLL'),
                or([
                  parent.field(['modifierKind']).eq('ADVANTAGE'),
                  parent.field(['modifierKind']).eq('DISADVANTAGE')
                ])
              ])
            ])
          }
        )
      )
      .set(
        'skillId',
        selectSingle(
          ['skillId'],
          'Skill',
          {
            kind: 'DATA',
            relationship: table('skills', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            showIf: parent.field(['valueDomainCode']).eq('SKILL_MODIFIER')
          }
        )
      )
      .set(
        'speedId',
        selectSingle(
          ['speedId'],
          'Speed',
          {
            kind: 'DATA',
            relationship: table('speeds', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            showIf: parent.field(['valueDomainCode']).eq('SPEED')
          }
        )
      )
      .set(
        'spellLevel',
        number(['spellLevel'], 'Spell Level', {
          showIf: parent.field(['valueDomainCode']).eq('SPELL_SLOT_COUNT')
        })
      )
      .set(
        'attackDomain',
        selectSingle(
          ['attackDomain'],
          'Attack Domain',
          {
            kind: 'INLINE_OPTIONS',
            options: ATTACK_DOMAIN_OPTIONS
          },
          {
            showIf: or([
              parent.field(['valueDomainCode']).eq('ATTACK_ROLL'),
              parent.field(['valueDomainCode']).eq('ATTACKS_AGAINST'),
              parent.field(['valueDomainCode']).eq('ATTACK_TRAIT'),
              parent.field(['valueDomainCode']).eq('CRITICAL_HIT_THRESHOLD'),
              parent.field(['valueDomainCode']).eq('CRITICAL_EXTRA_DICE'),
              parent.field(['valueDomainCode']).eq('DAMAGE')
            ])
          }
        )
      )
      .set(
        'trait',
        selectSingle(
          ['trait'],
          'Trait',
          { kind: 'INLINE_OPTIONS', options: DAMAGE_DEFENSE_BYPASS_OPTIONS },
          {
            showIf: parent.field(['valueDomainCode']).eq('ATTACK_TRAIT'),
            requiredIf: true
          }
        )
      )
      .set(
        'requiresHolderSeesAttacker',
        toggle(['requiresHolderSeesAttacker'], 'Only Attackers The Holder Can See', {
          showIf: parent.field(['valueDomainCode']).eq('ATTACKS_AGAINST')
        })
      )
      .set(
        'exemptAttackerSenseDefinitionIds',
        selectMulti(
          ['exemptAttackerSenseDefinitionIds'],
          'Attackers Seeing Through These Senses Are Unaffected',
          {
            kind: 'DATA',
            relationship: table('senses', { selectColumns: ['id', 'label', 'description'] })
          },
          {
            showIf: parent.field(['valueDomainCode']).eq('ATTACKS_AGAINST'),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'attackOccasion',
        selectSingle(
          ['attackOccasion'],
          'Only Attacks Made On This Occasion',
          { kind: 'INLINE_OPTIONS', options: ATTACK_OCCASION_OPTIONS },
          {
            showIf: parent.field(['valueDomainCode']).eq('ATTACKS_AGAINST'),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'againstEffectSource',
        toggle(['againstEffectSource'], 'Only Attacks Against The Effect Source', {
          showIf: and([
            parent.field(['valueDomainCode']).eq('ATTACK_ROLL'),
            or([
              parent.field(['modifierKind']).eq('ADVANTAGE'),
              parent.field(['modifierKind']).eq('DISADVANTAGE')
            ])
          ])
        })
      )
      .set(
        'requiresHolderSeesSource',
        toggle(['requiresHolderSeesSource'], 'Only Effects Whose Source The Holder Can See', {
          showIf: and([
            parent.field(['valueDomainCode']).eq('SAVING_THROW_MODIFIER'),
            or([
              parent.field(['modifierKind']).eq('ADVANTAGE'),
              parent.field(['modifierKind']).eq('DISADVANTAGE')
            ])
          ])
        })
      )
      .set(
        'senseDefinitionId',
        selectSingle(
          ['senseDefinitionId'],
          'Sense',
          {
            kind: 'DATA',
            relationship: table('senses', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            showIf: parent.field(['valueDomainCode']).eq('SENSE_RANGE')
          }
        )
      )
      .set(
        'ruleDefinitionId',
        selectSingle(
          ['ruleDefinitionId'],
          'Rule',
          {
            kind: 'DATA',
            relationship: table('reusable_definitions', {
              selectColumns: ['id', 'label']
            })
          },
          {
            showIf: parent.field(['valueDomainCode']).eq('SAVING_THROW_MODIFIER')
          }
        )
      )
      .set(
        'conditionTypeId',
        selectSingle(
          ['conditionTypeId'],
          'Condition Type',
          {
            kind: 'DATA',
            relationship: table('condition_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            showIf: and([
              parent.field(['valueDomainCode']).eq('SAVING_THROW_MODIFIER'),
              or([
                parent.field(['modifierKind']).eq('ADVANTAGE'),
                parent.field(['modifierKind']).eq('DISADVANTAGE')
              ])
            ])
          }
        )
      )
  }
)

const chargeLimitLevel = buildNodeMap<ChargeLimitLevel>()

const MODIFIER_CHARGE_LIMIT_LEVEL_NODE_MAP = chargeLimitLevel.define(
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

const MODIFIER_ATTACK_DECOY_ARMOR_CLASS_NODE_MAP = attackDecoyArmorClass.define(
  'modifierAttackDecoyArmorClass',
  ({ map, nodes }) => {
    const { number, selectMulti } = nodes

    map.set('amount', number(['amount'], 'Amount')).set(
      'abilities',
      selectMulti(['abilities'], 'Abilities', {
        kind: 'INLINE_OPTIONS',
        options: ABILITY_OPTIONS
      })
    )
  }
)

const attackDecoyThreshold = buildNodeMap<AttackDecoyThreshold>()

const MODIFIER_ATTACK_DECOY_THRESHOLD_NODE_MAP = attackDecoyThreshold.define(
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

const damageDieCastLevelScaling = buildNodeMap<DamageDieCastLevelScaling>()

const DAMAGE_DIE_CAST_LEVEL_SCALING_NODE_MAP = damageDieCastLevelScaling.define(
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

const INCOMING_GATE_SUCCESS_IMMUNITY_NODE_MAP = incomingGateSuccessImmunity.define(
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
})

const DAMAGE_INTERCEPTION_SAVE_NODE_MAP = damageInterceptionSave.define(
  'damageInterceptionSave',
  ({ map, nodes }) => {
    map
      .set(
        'ability',
        nodes.selectSingle(['ability'], 'Save Ability', {
          kind: 'INLINE_OPTIONS',
          options: ABILITY_OPTIONS
        })
      )
      .set(
        'dc',
        nodes.groupObject(['dc'], 'Save DC', () => DAMAGE_INTERCEPTION_SAVE_DC_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
  }
)

const DAMAGE_INTERCEPTION_EXCLUDES_NODE_MAP = buildNodeMap<
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

const modifierPayload = buildNodeMap<ModifierPayload>()

const MODIFIER_GRANT_PAYLOAD_NODE_MAP = modifierPayload.define(
  'modifierGrantPayload',
  ({ map, nodes, cond, data, logic }) => {
    const { text, number, toggle, selectSingle, selectMulti, groupArray, groupObject } = nodes
    const parent = cond.parent<ModifierGrantUnion>()
    const local = cond.local()
    const { and, or, not } = logic
    const { table } = data
    const isBonus = parent.field(['modifierKind']).eq('BONUS')
    const isPenalty = parent.field(['modifierKind']).eq('PENALTY')
    const isMultiply = parent.field(['modifierKind']).eq('MULTIPLY')
    const isMovementPassage = parent.field(['valueDomainCode']).eq('MOVEMENT_PASSAGE')
    const isRolledDie = parent.field(['modifierKind']).eq('ADD_BONUS_DIE')
    const isDamageDie = and([parent.field(['valueDomainCode']).eq('DAMAGE'), isRolledDie])
    // A speed or sense range is a typed length, never a value source (D111); a fraction is not.
    const isLength = and([
      or([
        parent.field(['valueDomainCode']).eq('SPEED'),
        parent.field(['valueDomainCode']).eq('SENSE_RANGE')
      ]),
      not(isMultiply)
    ])
    const usesScalarMultiplier = or([
      local.field(['valueKind']).eq('PROFICIENCY_BONUS'),
      local.field(['valueKind']).eq('SKILL_BONUS'),
      local.field(['valueKind']).eq('CHARACTER_LEVEL'),
      local.field(['valueKind']).eq('CLASS_LEVEL'),
      local.field(['valueKind']).eq('SPELL_SLOT_LEVEL')
    ])

    map
      .set(
        'valueKind',
        selectSingle(
          ['valueKind'],
          'Value Source',
          {
            kind: 'INLINE_OPTIONS',
            options: MODIFIER_VALUE_SOURCE_OPTIONS
          },
          {
            showIf: and([or([isBonus, isPenalty]), not(isLength)])
          }
        )
      )
      .set(
        'ability',
        selectSingle(
          ['ability'],
          'Ability',
          {
            kind: 'INLINE_OPTIONS',
            options: ABILITY_OPTIONS
          },
          {
            showIf: or([
              parent.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS'),
              and([isBonus, local.field(['valueKind']).eq('ABILITY_MODIFIER')])
            ])
          }
        )
      )
      .set(
        'skillId',
        selectSingle(
          ['skillId'],
          'Skill',
          {
            kind: 'DATA',
            relationship: table('skills', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            showIf: or([
              local.field(['valueKind']).eq('SKILL_BONUS'),
              parent.field(['valueDomainCode']).eq('CHECKS_AGAINST_HOLDER')
            ])
          }
        )
      )
      .set(
        'classId',
        selectSingle(
          ['classId'],
          'Class',
          {
            kind: 'DATA',
            relationship: table('classes', {
              selectColumns: ['id', 'label']
            })
          },
          {
            showIf: local.field(['valueKind']).eq('CLASS_LEVEL')
          }
        )
      )
      .set(
        'bonusMultiplier',
        number(['multiplier'], 'Multiplier', {
          constraints: { minimum: 0 },
          showIf: or([
            and([isBonus, usesScalarMultiplier]),
            and([isBonus, local.field(['valueKind']).eq('ABILITY_MODIFIER')]),
            parent.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS')
          ])
        })
      )
      .set(
        'multiplier',
        number(['multiplier'], 'Multiplier', {
          showIf: or([
            and([isPenalty, usesScalarMultiplier]),
            parent.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT')
          ])
        })
      )
      .set(
        'subtractLevels',
        number(['subtractLevels'], 'Subtract Levels', {
          constraints: { minimum: 0 },
          showIf: local.field(['valueKind']).eq('SPELL_SLOT_LEVEL')
        })
      )
      .set(
        'levelsPerStep',
        number(['levelsPerStep'], 'Levels Per Step', {
          constraints: { minimum: 1 },
          showIf: local.field(['valueKind']).eq('SPELL_SLOT_LEVEL')
        })
      )
      .set(
        'maximum',
        number(['maximum'], 'Maximum', {
          showIf: local.field(['valueKind']).eq('SPELL_SLOT_LEVEL')
        })
      )
      .set(
        'count',
        number(['count'], 'Dice', {
          constraints: { minimum: 1, maximum: MAX_ROLLED_DIE_COUNT },
          showIf: isRolledDie
        })
      )
      .set(
        'faces',
        number(['faces'], 'Die Faces', {
          constraints: { minimum: ROLLED_DIE_FACES[0], maximum: Math.max(...ROLLED_DIE_FACES) },
          showIf: isRolledDie
        })
      )
      .set(
        'sign',
        selectSingle(
          ['sign'],
          'Add or Subtract',
          { kind: 'INLINE_OPTIONS', options: ROLLED_DIE_SIGN_OPTIONS },
          { showIf: isRolledDie }
        )
      )
      .set(
        'timing',
        selectSingle(
          ['timing'],
          'Joins The Roll',
          { kind: 'INLINE_OPTIONS', options: ROLLED_DIE_TIMING_OPTIONS },
          { showIf: and([isRolledDie, not(isDamageDie)]) }
        )
      )
      .set(
        'recipient',
        selectSingle(
          ['recipient'],
          'Joins The Damage',
          { kind: 'INLINE_OPTIONS', options: DAMAGE_DIE_RECIPIENT_OPTIONS },
          { showIf: isDamageDie }
        )
      )
      .set(
        'damageDieTypeSource',
        selectSingle(
          ['damageTypeSource'],
          'Damage Type From',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              {
                code: 'ATTACK',
                label: 'The damage it joins',
                description: 'Takes the attack’s damage type; a subtracted die always does.'
              }
            ]
          },
          { showIf: isDamageDie }
        )
      )
      .set(
        'countPerCastLevelAbove',
        groupObject(
          ['countPerCastLevelAbove'],
          'Dice Per Higher Spell Level',
          () => DAMAGE_DIE_CAST_LEVEL_SCALING_NODE_MAP,
          { presentation: 'inline', showIf: isDamageDie }
        )
      )
      .set(
        'damageTypeId',
        selectSingle(
          ['damageTypeId'],
          'Damage Type',
          {
            kind: 'DATA',
            relationship: table('damage_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            showIf: or([
              parent.field(['modifierKind']).eq('REPLACE_DAMAGE_TYPE'),
              and([isDamageDie, not(local.field(['damageTypeSource']).eq('ATTACK'))]),
              and([
                parent.field(['valueDomainCode']).eq('DAMAGE_RESISTANCE'),
                not(local.field(['damageTypeSource']).eq('TRIGGER'))
              ]),
              parent.field(['valueDomainCode']).eq('DAMAGE_IMMUNITY'),
              parent.field(['valueDomainCode']).eq('DAMAGE_VULNERABILITY')
            ]),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'sourceEffectIds',
        selectMulti(
          ['sourceEffectIds'],
          'Only damage from these spells',
          {
            kind: 'DATA',
            relationship: table('spells', { selectColumns: ['id', 'label'] })
          },
          {
            showIf: parent.field(['valueDomainCode']).eq('DAMAGE_IMMUNITY'),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'damageTypeSource',
        selectSingle(
          ['damageTypeSource'],
          'Damage Type From',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              {
                code: 'TRIGGER',
                label: 'The triggering damage',
                description: 'Resists the damage type that triggered this reaction.'
              }
            ]
          },
          { showIf: parent.field(['valueDomainCode']).eq('DAMAGE_RESISTANCE') }
        )
      )
      .set(
        'conditionTypeId',
        selectSingle(
          ['conditionTypeId'],
          'Condition Type',
          {
            kind: 'DATA',
            relationship: table('condition_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          {
            showIf: or([
              parent.field(['valueDomainCode']).eq('CONDITION'),
              parent.field(['valueDomainCode']).eq('CONDITION_IMMUNITY')
            ])
          }
        )
      )
      .set(
        'magicSchoolId',
        selectSingle(
          ['magicSchoolId'],
          'Magic School',
          {
            kind: 'DATA',
            relationship: table('magic_schools', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { showIf: parent.field(['valueDomainCode']).eq('SPELL_SCHOOL_IMMUNITY') }
        )
      )
      .set(
        'attributeId',
        text(['attributeId'], 'Attribute ID', {
          showIf: parent.field(['valueDomainCode']).eq('ATTRIBUTE')
        })
      )
      .set(
        'movementModeId',
        text(['movementModeId'], 'Movement Mode ID', {
          showIf: parent.field(['valueDomainCode']).eq('MOVEMENT_MODE')
        })
      )
      .set(
        'creatures',
        selectSingle(
          ['creatures'],
          'Hostile Creatures',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'NONE', label: 'None', description: 'Hostile creatures block the holder.' },
              {
                code: 'ANY',
                label: 'Any',
                description: 'The holder may move through any hostile creature.'
              },
              {
                code: 'LARGER_THAN_SELF',
                label: 'Larger than the holder',
                description: 'The holder may move through hostile creatures larger than itself.'
              }
            ]
          },
          { showIf: isMovementPassage, requiredIf: true }
        )
      )
      .set(
        'mayEndInCreature',
        toggle(['mayEndInCreature'], 'May End Its Move Inside A Creature', {
          showIf: isMovementPassage
        })
      )
      .set(
        'blockingBarriers',
        toggle(['blockingBarriers'], 'Moves Through Walls And Objects', {
          showIf: isMovementPassage
        })
      )
      .set(
        'costMultiplier',
        number(['costMultiplier'], 'Cost Multiplier Inside What It Passes', {
          constraints: { minimum: 1, maximum: 2 },
          showIf: isMovementPassage,
          requiredIf: true
        })
      )
      .set(
        'abilities',
        selectMulti(
          ['abilities'],
          'Abilities',
          {
            kind: 'INLINE_OPTIONS',
            options: ABILITY_MODIFIER_REFERENCE_OPTIONS
          },
          {
            // An armor class formula adds each listed ability modifier to its amount; only the best-of
            // bonus may name the spellcasting ability (the schema refuses it in a formula).
            showIf: or([
              parent.field(['modifierKind']).eq('OPTIONAL_ABILITY_MODIFIER_BONUS'),
              and([
                parent.field(['valueDomainCode']).eq('ARMOR_CLASS'),
                parent.field(['modifierKind']).eq('SET_VALUE')
              ])
            ])
          }
        )
      )
      .set(
        'rangeKind',
        selectSingle(
          ['rangeKind'],
          'Range Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: RANGE_OPTIONS
          },
          {
            showIf: parent.field(['modifierKind']).eq('REPLACE_RANGE_KIND')
          }
        )
      )
      .set(
        'durationKind',
        selectSingle(
          ['durationKind'],
          'Duration Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: DURATION_OPTIONS
          },
          {
            showIf: parent.field(['modifierKind']).eq('REPLACE_DURATION_KIND')
          }
        )
      )
      .set(
        'shapeKind',
        selectSingle(
          ['shapeKind'],
          'Shape Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: SHAPE_KIND_OPTIONS
          },
          {
            showIf: parent.field(['modifierKind']).eq('REPLACE_SHAPE_KIND')
          }
        )
      )
      .set(
        'resetKind',
        selectSingle(
          ['resetKind'],
          'Reset Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: CHARGE_RESET_OPTIONS
          },
          {
            showIf: parent.field(['modifierKind']).eq('REPLACE_CHARGE_RESET_KIND')
          }
        )
      )
      .set(
        'limitKind',
        selectSingle(
          ['limitKind'],
          'Limit Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: CHARGE_LIMIT_OPTIONS
          },
          {
            showIf: parent.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT')
          }
        )
      )
      .set(
        'scalingKind',
        selectSingle(
          ['scalingKind'],
          'Scaling Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: CHARGE_SCALING_OPTIONS
          },
          {
            showIf: parent.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT')
          }
        )
      )
      .set(
        'bonusMin',
        number(['min'], 'Min', {
          constraints: { minimum: 0 },
          showIf: or([
            and([isBonus, local.field(['valueKind']).eq('ABILITY_MODIFIER')]),
            parent.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS'),
            parent.field(['modifierKind']).eq('OPTIONAL_ABILITY_MODIFIER_BONUS')
          ])
        })
      )
      .set(
        'min',
        number(['min'], 'Min', {
          showIf: parent.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT')
        })
      )
      .set(
        'bonusMax',
        number(['max'], 'Max', {
          constraints: { minimum: 0 },
          showIf: or([
            and([isBonus, local.field(['valueKind']).eq('ABILITY_MODIFIER')]),
            parent.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS'),
            parent.field(['modifierKind']).eq('OPTIONAL_ABILITY_MODIFIER_BONUS')
          ])
        })
      )
      .set(
        'max',
        number(['max'], 'Max', {
          showIf: parent.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT')
        })
      )
      .set(
        'bonusAmount',
        number(['amount'], 'Amount', {
          constraints: { minimum: 0 },
          showIf: and([isBonus, local.field(['valueKind']).eq('FIXED'), not(isLength)])
        })
      )
      .set(
        'amount',
        number(['amount'], 'Amount', {
          showIf: and([
            or([
              parent.field(['modifierKind']).eq('SET_VALUE'),
              parent.field(['modifierKind']).eq('CAP_VALUE'),
              parent.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT'),
              and([isPenalty, local.field(['valueKind']).eq('FIXED')])
            ]),
            not(isLength)
          ])
        })
      )
      .set(
        'minimumRollAmount',
        number(['amount'], 'Minimum Roll', {
          constraints: { minimum: 2, maximum: 20 },
          showIf: parent.field(['modifierKind']).eq('MINIMUM_ROLL'),
          requiredIf: true
        })
      )
      .set(
        'lengthAmount',
        number(['amount'], 'Amount', {
          constraints: { minimum: 0, maximum: AUTHORED_LENGTH_AMOUNT_MAX },
          showIf: isLength,
          requiredIf: true
        })
      )
      .set(
        'numerator',
        number(['numerator'], 'Numerator', {
          constraints: { minimum: 0 },
          showIf: isMultiply,
          requiredIf: true
        })
      )
      .set(
        'denominator',
        number(['denominator'], 'Denominator', {
          constraints: { minimum: 1 },
          showIf: isMultiply,
          requiredIf: true
        })
      )
      .set(
        'unit',
        selectSingle(
          ['unit'],
          'Unit',
          { kind: 'INLINE_OPTIONS', options: LENGTH_UNIT_OPTIONS },
          { showIf: isLength, requiredIf: true }
        )
      )
      .set(
        'levels',
        groupArray(['levels'], 'Levels', () => MODIFIER_CHARGE_LIMIT_LEVEL_NODE_MAP, {
          presentation: 'table',
          showIf: and([
            parent.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT'),
            local.field(['scalingKind']).eq('PER_LEVEL')
          ])
        })
      )
      .set(
        'armorClass',
        groupObject(
          ['armorClass'],
          'Decoy Armor Class',
          () => MODIFIER_ATTACK_DECOY_ARMOR_CLASS_NODE_MAP,
          {
            presentation: 'inline',
            showIf: parent.field(['valueDomainCode']).eq('ATTACK_DECOYS')
          }
        )
      )
      .set(
        'thresholds',
        groupArray(
          ['thresholds'],
          'Targeting Rolls',
          () => MODIFIER_ATTACK_DECOY_THRESHOLD_NODE_MAP,
          {
            presentation: 'table',
            showIf: parent.field(['valueDomainCode']).eq('ATTACK_DECOYS')
          }
        )
      )
      .set(
        'exemptAttackerSenseDefinitionIds',
        selectMulti(
          ['exemptAttackerSenseDefinitionIds'],
          'Attackers Seeing Through These Senses Are Unaffected',
          {
            kind: 'DATA',
            relationship: table('senses', { selectColumns: ['id', 'label', 'description'] })
          },
          {
            showIf: parent.field(['valueDomainCode']).eq('ATTACK_DECOYS'),
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'dropToHitPoints',
        number(['dropToHitPoints'], 'Hit Points It Drops To Instead', {
          constraints: { minimum: 1 },
          requiredIf: true,
          showIf: parent.field(['valueDomainCode']).eq('DAMAGE_INTERCEPTION')
        })
      )
      .set(
        'negatesKill',
        toggle(['negatesKill'], 'Also Negates Instant Death', {
          showIf: parent.field(['valueDomainCode']).eq('DAMAGE_INTERCEPTION')
        })
      )
      .set(
        'save',
        groupObject(['save'], 'Required Save', () => DAMAGE_INTERCEPTION_SAVE_NODE_MAP, {
          presentation: 'inline',
          showIf: parent.field(['valueDomainCode']).eq('DAMAGE_INTERCEPTION')
        })
      )
      .set(
        'excludes',
        groupObject(['excludes'], 'Exclusions', () => DAMAGE_INTERCEPTION_EXCLUDES_NODE_MAP, {
          presentation: 'inline',
          showIf: parent.field(['valueDomainCode']).eq('DAMAGE_INTERCEPTION')
        })
      )
      .set(
        'maxDamageTaken',
        number(['maxDamageTaken'], 'Only Damage Of At Most', {
          constraints: { minimum: 1 },
          showIf: parent.field(['valueDomainCode']).eq('DAMAGE_INTERCEPTION')
        })
      )
      .set(
        'savingThrow',
        groupObject(['savingThrow'], 'Attacker Saving Throw', () => SAVING_THROW_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true,
          showIf: parent.field(['valueDomainCode']).eq('INCOMING_ATTACK_GATE')
        })
      )
      .set(
        'attackerCreatureTypeIds',
        selectMulti(
          ['attackerCreatureTypeIds'],
          'Attacker Creature Types',
          {
            kind: 'DATA',
            relationship: table('creature_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { showIf: parent.field(['valueDomainCode']).eq('INCOMING_ATTACK_GATE') }
        )
      )
      .set(
        'successImmunity',
        groupObject(
          ['successImmunity'],
          'Success Immunity',
          () => INCOMING_GATE_SUCCESS_IMMUNITY_NODE_MAP,
          {
            presentation: 'inline',
            showIf: parent.field(['valueDomainCode']).eq('INCOMING_ATTACK_GATE')
          }
        )
      )
  }
)

const modifierGrant = buildNodeMap<ModifierGrantUnion>()

const MODIFIER_GRANT_SECTIONS = {
  modifier: { id: 'modifier', label: 'Modifier', order: 10 },
  domain: { id: 'domain', label: 'Domain', order: 20 },
  value: { id: 'value', label: 'Value', order: 30 }
} as const

export const MODIFIER_GRANT_NODE_MAP = modifierGrant.define(
  'modifierGrant',
  ({ map, nodes, cond, logic }) => {
    const { text, number, selectSingle, groupObject } = nodes
    const local = cond.local()
    const { and, or } = logic

    map
      .set(
        'grantKind',
        text(['grantKind'], 'Grant Kind', {
          section: MODIFIER_GRANT_SECTIONS.modifier,
          order: 10,
          authoring: { exposure: 'system' }
        })
      )
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order'))
      .set(
        'selectionKind',
        selectSingle(
          ['selectionKind'],
          'Selection Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: [AUTHORING_SELECTION_REGISTRY.GRANTED]
          },
          {
            section: MODIFIER_GRANT_SECTIONS.modifier,
            order: 20,
            authoring: { exposure: 'system' }
          }
        )
      )
      .set(
        'valueDomainCode',
        selectSingle(
          ['valueDomainCode'],
          'Value Domain',
          {
            kind: 'INLINE_OPTIONS',
            options: VALUE_DOMAIN_OPTIONS
          },
          { section: MODIFIER_GRANT_SECTIONS.modifier, order: 30 }
        )
      )
      .set(
        'modifierKind',
        selectSingle(
          ['modifierKind'],
          'Modifier Kind',
          {
            kind: 'INLINE_OPTIONS',
            options: MODIFIER_KIND_OPTIONS
          },
          { section: MODIFIER_GRANT_SECTIONS.modifier, order: 40 }
        )
      )
      .set(
        'scope',
        selectSingle(
          ['scope'],
          'Scope',
          {
            kind: 'INLINE_OPTIONS',
            options: MODIFIER_SCOPE_OPTIONS
          },
          { section: MODIFIER_GRANT_SECTIONS.modifier, order: 50 }
        )
      )
      .set(
        'domain',
        groupObject(['domain'], 'Domain', () => MODIFIER_GRANT_DOMAIN_NODE_MAP, {
          presentation: 'inline',
          section: MODIFIER_GRANT_SECTIONS.domain,
          order: 10,
          showIf: or([
            local.field(['valueDomainCode']).eq('ATTACK_ROLL'),
            local.field(['valueDomainCode']).eq('ATTACKS_AGAINST'),
            local.field(['valueDomainCode']).eq('ATTACK_TRAIT'),
            local.field(['valueDomainCode']).eq('CRITICAL_HIT_THRESHOLD'),
            local.field(['valueDomainCode']).eq('CRITICAL_EXTRA_DICE'),
            local.field(['valueDomainCode']).eq('ABILITY_CHECK'),
            local.field(['valueDomainCode']).eq('SAVING_THROW_MODIFIER'),
            local.field(['valueDomainCode']).eq('SKILL_MODIFIER'),
            local.field(['valueDomainCode']).eq('ABILITY_SCORE'),
            local.field(['valueDomainCode']).eq('SPEED'),
            local.field(['valueDomainCode']).eq('SENSE_RANGE'),
            local.field(['valueDomainCode']).eq('DAMAGE'),
            local.field(['valueDomainCode']).eq('SPELL_SLOT_COUNT')
          ])
          // Note: CONDITION_IMMUNITY uses payload conditionTypeId only — no domain params needed
        })
      )
      .set(
        'payload',
        groupObject(['payload'], 'Value', () => MODIFIER_GRANT_PAYLOAD_NODE_MAP, {
          presentation: 'inline',
          section: MODIFIER_GRANT_SECTIONS.value,
          order: 10,
          showIf: or([
            local.field(['modifierKind']).eq('BONUS'),
            local.field(['modifierKind']).eq('PENALTY'),
            local.field(['modifierKind']).eq('SET_VALUE'),
            local.field(['modifierKind']).eq('CAP_VALUE'),
            local.field(['modifierKind']).eq('MULTIPLY'),
            local.field(['modifierKind']).eq('ADD_BONUS_DIE'),
            local.field(['modifierKind']).eq('MINIMUM_ROLL'),
            local.field(['modifierKind']).eq('REPLACE_DAMAGE_TYPE'),
            local.field(['modifierKind']).eq('REPLACE_RANGE_KIND'),
            local.field(['modifierKind']).eq('REPLACE_DURATION_KIND'),
            local.field(['modifierKind']).eq('REPLACE_SHAPE_KIND'),
            local.field(['modifierKind']).eq('REPLACE_CHARGE_RESET_KIND'),
            local.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT'),
            local.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS'),
            local.field(['modifierKind']).eq('ADD_OPTION'),
            local.field(['modifierKind']).eq('REMOVE_OPTION'),
            local.field(['modifierKind']).eq('OPTIONAL_ABILITY_MODIFIER_BONUS'),
            and([
              local.field(['modifierKind']).eq('ENABLE'),
              or([
                local.field(['valueDomainCode']).eq('ATTACK_DECOYS'),
                local.field(['valueDomainCode']).eq('INCOMING_ATTACK_GATE')
              ])
            ])
          ])
        })
      )
      .set(
        'restrictions',
        groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP, {
          presentation: 'inline',
          section: MODIFIER_GRANT_SECTIONS.modifier,
          order: 40,
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
  },
  {
    collection: {
      rowSummary: 'modifier'
    }
  }
)
