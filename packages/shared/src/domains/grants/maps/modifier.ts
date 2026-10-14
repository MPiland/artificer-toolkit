import type { ModifierGrantAuthored } from '#authored'
import {
  ABILITY_OPTIONS,
  ATTACK_DOMAIN_OPTIONS,
  AUTHORING_SELECTION_REGISTRY,
  CHARGE_LIMIT_OPTIONS,
  CHARGE_RESET_OPTIONS,
  CHARGE_SCALING_OPTIONS,
  DURATION_OPTIONS,
  MODIFIER_KIND_OPTIONS,
  MODIFIER_SCOPE_OPTIONS,
  MODIFIER_VALUE_SOURCE_OPTIONS,
  RANGE_OPTIONS,
  SHAPE_KIND_OPTIONS,
  VALUE_DOMAIN_OPTIONS
} from '#core'
import { FACET_NODE_MAP } from '../../shared/maps/facet.js'
import { AUTHORING_ACTION_PRESENTATIONS, buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'

type ModifierGrantUnion = AllUnionFields<ModifierGrantAuthored>
type ModifierPayload = NonNullable<ModifierGrantUnion['payload']>
type ModifierDomain = ModifierGrantUnion['domain']
type ChargeLimitLevel = NonNullable<
  Extract<ModifierPayload, { levels: unknown[] }>['levels']
>[number]

const modifierGrantDomain = buildNodeMap<ModifierDomain>()

const MODIFIER_GRANT_DOMAIN_NODE_MAP = modifierGrantDomain.define(
  'modifierGrantDomain',
  ({ map, nodes, cond, data, logic }) => {
    const { selectSingle, number, toggle } = nodes
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
              parent.field(['valueDomainCode']).eq('SAVING_THROW_MODIFIER')
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
              parent.field(['valueDomainCode']).eq('DAMAGE')
            ])
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

const modifierPayload = buildNodeMap<ModifierPayload>()

const MODIFIER_GRANT_PAYLOAD_NODE_MAP = modifierPayload.define(
  'modifierGrantPayload',
  ({ map, nodes, cond, data, logic }) => {
    const { text, number, selectSingle, selectMulti, groupArray } = nodes
    const parent = cond.parent<ModifierGrantUnion>()
    const local = cond.local()
    const { and, or } = logic
    const { table } = data
    const isBonus = parent.field(['modifierKind']).eq('BONUS')
    const isPenalty = parent.field(['modifierKind']).eq('PENALTY')
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
            showIf: or([
              parent.field(['modifierKind']).eq('BONUS'),
              parent.field(['modifierKind']).eq('PENALTY')
            ])
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
            showIf: parent.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS')
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
            showIf: local.field(['valueKind']).eq('SKILL_BONUS')
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
        'dice',
        text(['dice'], 'Dice', {
          showIf: parent.field(['modifierKind']).eq('ADD_BONUS_DIE')
        })
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
              parent.field(['valueDomainCode']).eq('DAMAGE_RESISTANCE'),
              parent.field(['valueDomainCode']).eq('DAMAGE_IMMUNITY'),
              parent.field(['valueDomainCode']).eq('DAMAGE_VULNERABILITY')
            ])
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
            showIf: or([
              parent.field(['valueDomainCode']).eq('CONDITION'),
              parent.field(['valueDomainCode']).eq('CONDITION_IMMUNITY')
            ])
          }
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
        'abilities',
        selectMulti(
          ['abilities'],
          'Abilities',
          {
            kind: 'INLINE_OPTIONS',
            options: ABILITY_OPTIONS
          },
          {
            // An armor class formula adds each listed ability modifier to its amount.
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
          showIf: parent.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS')
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
          showIf: parent.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS')
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
          showIf: and([isBonus, local.field(['valueKind']).eq('FIXED')])
        })
      )
      .set(
        'amount',
        number(['amount'], 'Amount', {
          showIf: or([
            parent.field(['modifierKind']).eq('SET_VALUE'),
            parent.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT'),
            and([isPenalty, local.field(['valueKind']).eq('FIXED')])
          ])
        })
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
    const { or } = logic

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
            local.field(['modifierKind']).eq('ADD_BONUS_DIE'),
            local.field(['modifierKind']).eq('REPLACE_DAMAGE_TYPE'),
            local.field(['modifierKind']).eq('REPLACE_RANGE_KIND'),
            local.field(['modifierKind']).eq('REPLACE_DURATION_KIND'),
            local.field(['modifierKind']).eq('REPLACE_SHAPE_KIND'),
            local.field(['modifierKind']).eq('REPLACE_CHARGE_RESET_KIND'),
            local.field(['modifierKind']).eq('MODIFY_CHARGE_LIMIT'),
            local.field(['modifierKind']).eq('ABILITY_MODIFIER_BONUS'),
            local.field(['modifierKind']).eq('ADD_OPTION'),
            local.field(['modifierKind']).eq('REMOVE_OPTION'),
            local.field(['modifierKind']).eq('OPTIONAL_ABILITY_MODIFIER_BONUS')
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
