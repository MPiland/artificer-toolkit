import {
  CLASS_ATTRIBUTE_OPTIONS,
  CLASS_CATEGORY,
  CLASS_CATEGORY_OPTIONS,
  PREPARE_LIMIT_METHOD_OPTIONS,
  ROUNDING_OPTIONS,
  SCALING_AMOUNT_OPTIONS,
  SPELLCASTING_ATTRIBUTE_OPTIONS,
  SUBCLASS_ATTRIBUTE_OPTIONS
} from '#core'
import {
  CHARGE_NODE_MAP,
  DETAIL_NODE_MAP,
  FEATURE_NODE_MAP,
  PROFICIENCY_NODE_MAP,
  STARTING_EQUIPMENT_NODE_MAP
} from '#maps'
import { buildNodeMap } from '#utils'
import type {
  ClassAuthored,
  ClassHitpointAuthored,
  ClassMulticlassAuthored,
  ClassMulticlassRequirementAuthored,
  ClassMulticlassRequirementGroup,
  ClassPrepareLimitAuthored,
  ClassResourceAuthored,
  ClassSpellcastingAuthored,
  ClassSpellLimitsAuthored,
  ClassSpellSlotAuthored,
  ClassStartingGoldAuthored,
  ClassSpecializationAuthored,
  DetailAuthored
} from '#authored'

const CLASS_STEPS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  classDetails: { id: 'classDetails', label: 'Class Details', order: 20 },
  equipment: { id: 'equipment', label: 'Equipment', order: 30 },
  spellcasting: { id: 'spellcasting', label: 'Spellcasting', order: 40 },
  advancement: { id: 'advancement', label: 'Advancement', order: 50 }
} as const

const CLASS_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10, step: CLASS_STEPS.basics },
  classDetails: {
    id: 'classDetails',
    label: 'Class Details',
    order: 10,
    step: CLASS_STEPS.classDetails
  },
  equipment: { id: 'equipment', label: 'Equipment', order: 10, step: CLASS_STEPS.equipment },
  spellcasting: {
    id: 'spellcasting',
    label: 'Spellcasting',
    order: 10,
    step: CLASS_STEPS.spellcasting
  },
  advancement: { id: 'advancement', label: 'Advancement', order: 10, step: CLASS_STEPS.advancement }
} as const

const detailNode = buildNodeMap<DetailAuthored>()

export const CLASS_DETAIL_NODE_MAP = detailNode.define('classDetail', ({ map, nodes }) => {
  const { text, richText, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', richText(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})

const classSpellSlot = buildNodeMap<ClassSpellSlotAuthored>()

const CLASS_SPELL_SLOT_NODE_MAP = classSpellSlot.define('classSpellSlot', ({ map, nodes }) => {
  const { number } = nodes

  map
    .set('spellLevel', number(['spellLevel'], 'Spell Level'))
    .set('slotCount', number(['slotCount'], 'Slot Count'))
})

const classSpellLimits = buildNodeMap<ClassSpellLimitsAuthored>()

const CLASS_SPELL_LIMITS_NODE_MAP = classSpellLimits.define(
  'classSpellLimits',
  ({ map, nodes }) => {
    const { number, groupArray } = nodes

    map
      .set('classLevel', number(['classLevel'], 'Class Level'))
      .set(
        'slots',
        groupArray(['slots'], 'Slots', () => CLASS_SPELL_SLOT_NODE_MAP, { presentation: 'table' })
      )
      .set('learnedSpellsLimit', number(['learnedSpellsLimit'], 'Known Spells Limit'))
      .set('preparedSpellsLimit', number(['preparedSpellsLimit'], 'Prepared Spells Limit'))
      .set('cantripsLimit', number(['cantripsLimit'], 'Cantrips Limit'))
  }
)

const classPrepareLimitPerLevel =
  buildNodeMap<NonNullable<ClassPrepareLimitAuthored['perLevel']>[number]>()

const CLASS_PREPARE_LIMIT_PER_LEVEL_NODE_MAP = classPrepareLimitPerLevel.define(
  'classPrepareLimitPerLevel',
  ({ map, nodes }) => {
    const { number } = nodes

    map
      .set('classLevel', number(['classLevel'], 'Class Level'))
      .set('amount', number(['amount'], 'Amount'))
  }
)

const classPrepareLimitNode = buildNodeMap<ClassPrepareLimitAuthored>()

export const CLASS_PREPARE_LIMIT_NODE_MAP = classPrepareLimitNode.define(
  'classPrepareLimit',
  ({ map, nodes, cond, logic }) => {
    const { selectMulti, selectSingle, groupArray } = nodes
    const local = cond.local()
    const { or } = logic

    map
      .set(
        'methodKinds',
        selectMulti(['methodKinds'], 'Method Kinds', {
          kind: 'INLINE_OPTIONS',
          options: PREPARE_LIMIT_METHOD_OPTIONS
        })
      )
      .set(
        'scaling',
        selectSingle(['scaling'], 'Scaling Amount', {
          kind: 'INLINE_OPTIONS',
          options: SCALING_AMOUNT_OPTIONS
        })
      )
      .set(
        'rounding',
        selectSingle(
          ['rounding'],
          'Rounding',
          {
            kind: 'INLINE_OPTIONS',
            options: ROUNDING_OPTIONS
          },
          {
            showIf: local.field(['scaling']).eq('HALF')
          }
        )
      )
      .set(
        'perLevel',
        groupArray(['perLevel'], 'Per-Level Limits', () => CLASS_PREPARE_LIMIT_PER_LEVEL_NODE_MAP, {
          presentation: 'table',
          showIf: or([
            local.field(['methodKinds']).contains(['PER_LEVEL']),
            local.field(['scaling']).eq('FULL'),
            local.field(['scaling']).eq('HALF'),
            local.field(['scaling']).eq('DOUBLE')
          ])
        })
      )
  }
)

const classSpellcastingNode = buildNodeMap<ClassSpellcastingAuthored>()

export const CLASS_SPELLCASTING_NODE_MAP = classSpellcastingNode.define(
  'classSpellcasting',
  ({ map, nodes, cond, data }) => {
    const { selectSingle, selectMulti, number, text, groupArray, groupObject } = nodes
    const { table } = data
    const local = cond.local()

    map
      .set(
        'spellLimits',
        groupArray(['spellLimits'], 'Spell Limits', () => CLASS_SPELL_LIMITS_NODE_MAP, {
          presentation: 'summary'
        })
      )
      .set('availableAtLevel', number(['availableAtLevel'], 'Available At Level'))
      .set('order', number(['order'], 'Presentation Order'))
      .set(
        'details',
        groupArray(['details'], 'Details', () => DETAIL_NODE_MAP, { presentation: 'inline' })
      )
      .set('magicName', text(['magicName'], 'Magic Name'))
      .set(
        'availableSpellIds',
        selectMulti(['availableSpellIds'], 'Spell List', {
          kind: 'DATA',
          relationship: table('spells', {
            selectColumns: ['id', 'label']
          })
        })
      )
      .set(
        'ability',
        selectSingle(['ability'], 'Spellcasting Ability', {
          kind: 'DATA',
          relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set('maxSpellLevel', number(['maxSpellLevel'], 'Max Spell Level'))
      .set(
        'attributes',
        selectMulti(['attributes'], 'Attributes', {
          kind: 'INLINE_OPTIONS',
          options: SPELLCASTING_ATTRIBUTE_OPTIONS
        })
      )
      .set(
        'charges',
        groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, { presentation: 'inline' })
      )
      .set(
        'prepareLimit',
        groupObject(['prepareLimit'], 'Prepare Limit', () => CLASS_PREPARE_LIMIT_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['attributes']).contains(['PREPARES_SPELLS'])
        })
      )
  }
)

const classResourceNode = buildNodeMap<ClassResourceAuthored>()

export const CLASS_RESOURCE_NODE_MAP = classResourceNode.define(
  'classResource',
  ({ map, nodes }) => {
    const { text, richText, number, groupObject } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set('label', text(['label'], 'Label'))
      .set('description', richText(['description'], 'Description'))
      .set('availableAtLevel', number(['availableAtLevel'], 'Available At Level'))
      .set('order', number(['order'], 'Presentation Order'))
      .set(
        'charges',
        groupObject(['charges'], 'Charges', () => CHARGE_NODE_MAP, { presentation: 'inline' })
      )
  }
)

const classHitpointNode = buildNodeMap<ClassHitpointAuthored>()

const CLASS_HITPOINT_NODE_MAP = classHitpointNode.define(
  'classHitpoint',
  ({ map, nodes, data }) => {
    const { selectSingle, text } = nodes

    map
      .set(
        'ability',
        selectSingle(['ability'], 'Ability', {
          kind: 'DATA',
          relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set('dieConfig', text(['dieConfig'], 'Die Config'))
  }
)

const classStartingGoldNode = buildNodeMap<ClassStartingGoldAuthored>()

const CLASS_STARTING_GOLD_NODE_MAP = classStartingGoldNode.define(
  'classStartingGold',
  ({ map, nodes, data }) => {
    const { number, selectSingle, text } = nodes
    const { table } = data

    map
      .set('multiplier', number(['multiplier'], 'Multiplier'))
      .set(
        'currencyId',
        selectSingle(['currencyId'], 'Currency', {
          kind: 'DATA',
          relationship: table('currencies', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set('dieConfig', text(['dieConfig'], 'Die Config'))
  }
)

const classRequirementNode = buildNodeMap<ClassMulticlassRequirementAuthored>()

const CLASS_MULTICLASS_REQUIREMENT_NODE_MAP = classRequirementNode.define(
  'classMulticlassRequirement',
  ({ map, nodes, data }) => {
    const { text, selectSingle, number } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'ability',
        selectSingle(['ability'], 'Ability', {
          kind: 'DATA',
          relationship: data.table('abilities', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set('min', number(['min'], 'Minimum'))
  }
)

const classRequirementGroupNode = buildNodeMap<ClassMulticlassRequirementGroup>()

const CLASS_MULTICLASS_REQUIREMENT_GROUP_NODE_MAP = classRequirementGroupNode.define(
  'classMulticlassRequirementGroup',
  ({ map, nodes }) => {
    const { text, groupArray } = nodes

    map.set('id', text(['id'], 'ID')).set(
      'requirements',
      groupArray(['requirements'], 'Requirements', () => CLASS_MULTICLASS_REQUIREMENT_NODE_MAP, {
        presentation: 'inline'
      })
    )
  }
)

const classMulticlassNode = buildNodeMap<ClassMulticlassAuthored>()

const CLASS_MULTICLASS_NODE_MAP = classMulticlassNode.define(
  'classMulticlass',
  ({ map, nodes }) => {
    const { text, groupObject, groupArray } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'requirementGroups',
        groupObject(
          ['requirementGroups'],
          'Requirement Groups',
          () => CLASS_MULTICLASS_REQUIREMENT_GROUPS_NODE_MAP,
          { presentation: 'inline' }
        )
      )
      .set(
        'proficiencies',
        groupArray(['proficiencies'], 'Proficiencies', () => PROFICIENCY_NODE_MAP, {
          presentation: 'inline'
        })
      )
  }
)

const classRequirementGroupsNode = buildNodeMap<ClassMulticlassAuthored['requirementGroups']>()

const CLASS_MULTICLASS_REQUIREMENT_GROUPS_NODE_MAP = classRequirementGroupsNode.define(
  'classMulticlassRequirementGroups',
  ({ map, nodes }) => {
    const { groupArray } = nodes

    map.set(
      'groups',
      groupArray(['groups'], 'Groups', () => CLASS_MULTICLASS_REQUIREMENT_GROUP_NODE_MAP, {
        presentation: 'inline'
      })
    )
  }
)

const classSpecializationNode = buildNodeMap<ClassSpecializationAuthored>()

const CLASS_SPECIALIZATION_NODE_MAP = classSpecializationNode.define(
  'classSpecialization',
  ({ map, nodes }) => {
    const { text, number } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set('label', text(['label'], 'Label'))
      .set('order', number(['order'], 'Order'))
  }
)

const classNode = buildNodeMap<ClassAuthored>()

export const CLASS_NODE_MAP = classNode.define('class', ({ map, nodes, cond, data }) => {
  const { text, richText, number, selectMulti, selectSingle, groupArray, groupObject } = nodes
  const local = cond.local()
  const { table } = data

  const isBaseClass = local.field(['category']).eq(CLASS_CATEGORY.BASE)
  const isSubclass = local.field(['category']).eq(CLASS_CATEGORY.SUBCLASS)

  map
    .set('id', text(['id'], 'ID'))
    .set(
      'label',
      text(['label'], 'Name', { section: CLASS_SECTIONS.basics, order: 10, requiredIf: true })
    )
    .set(
      'description',
      richText(['description'], 'Description', { section: CLASS_SECTIONS.basics, order: 20 })
    )
    .set(
      'details',
      groupArray(['details'], 'Details', () => CLASS_DETAIL_NODE_MAP, {
        presentation: 'inline',
        section: CLASS_SECTIONS.classDetails,
        order: 10
      })
    )
    .set(
      'proficiencies',
      groupArray(['proficiencies'], 'Proficiencies', () => PROFICIENCY_NODE_MAP, {
        presentation: 'branch',
        section: CLASS_SECTIONS.classDetails,
        order: 20
      })
    )
    .set(
      'spellcasting',
      groupObject(['spellcasting'], 'Spellcasting', () => CLASS_SPELLCASTING_NODE_MAP, {
        presentation: 'branch',
        section: CLASS_SECTIONS.spellcasting,
        order: 10
      })
    )
    .set(
      'resources',
      groupObject(['resources'], 'Resource', () => CLASS_RESOURCE_NODE_MAP, {
        presentation: 'inline',
        section: CLASS_SECTIONS.advancement,
        order: 20
      })
    )
    .set(
      'features',
      groupArray(['features'], 'Features', () => FEATURE_NODE_MAP, {
        presentation: 'branch',
        section: CLASS_SECTIONS.advancement,
        order: 10
      })
    )
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set(
      'category',
      selectSingle(
        ['category'],
        'Category',
        {
          kind: 'INLINE_OPTIONS',
          options: CLASS_CATEGORY_OPTIONS
        },
        { section: CLASS_SECTIONS.basics, order: 30, requiredIf: true }
      )
    )
    .set(
      'baseAttributes',
      selectMulti(
        ['attributes'],
        'Attributes',
        {
          kind: 'INLINE_OPTIONS',
          options: CLASS_ATTRIBUTE_OPTIONS
        },
        {
          section: CLASS_SECTIONS.classDetails,
          order: 30,
          showIf: isBaseClass
        }
      )
    )
    .set(
      'subclassSelectionLevel',
      number(['subclassSelectionLevel'], 'Subclass Selection Level', {
        section: CLASS_SECTIONS.basics,
        order: 40,
        showIf: isBaseClass
      })
    )
    .set(
      'startingGold',
      groupObject(['startingGold'], 'Starting Gold', () => CLASS_STARTING_GOLD_NODE_MAP, {
        presentation: 'inline',
        section: CLASS_SECTIONS.equipment,
        order: 10,
        showIf: isBaseClass
      })
    )
    .set(
      'startingEquipment',
      groupObject(['startingEquipment'], 'Starting Equipment', () => STARTING_EQUIPMENT_NODE_MAP, {
        presentation: 'branch',
        section: CLASS_SECTIONS.equipment,
        order: 20,
        showIf: isBaseClass
      })
    )
    .set(
      'hitpoint',
      groupObject(['hitpoint'], 'Hit Point', () => CLASS_HITPOINT_NODE_MAP, {
        presentation: 'inline',
        section: CLASS_SECTIONS.classDetails,
        order: 40,
        showIf: isBaseClass
      })
    )
    .set(
      'multiclass',
      groupObject(['multiclass'], 'Multiclass', () => CLASS_MULTICLASS_NODE_MAP, {
        presentation: 'branch',
        section: CLASS_SECTIONS.classDetails,
        order: 50,
        showIf: isBaseClass
      })
    )
    .set(
      'subclassAttributes',
      selectMulti(
        ['attributes'],
        'Attributes',
        {
          kind: 'INLINE_OPTIONS',
          options: SUBCLASS_ATTRIBUTE_OPTIONS
        },
        {
          section: CLASS_SECTIONS.classDetails,
          order: 30,
          showIf: isSubclass
        }
      )
    )
    .set(
      'parentClassId',
      selectSingle(
        ['parentClassId'],
        'Parent Class',
        {
          kind: 'DATA',
          relationship: table('classes', {
            selectColumns: ['id', 'label'],
            where: (col) => col('category').eq('BASE')
          })
        },
        {
          section: CLASS_SECTIONS.basics,
          order: 40,
          showIf: isSubclass,
          requiredIf: isSubclass
        }
      )
    )
    .set(
      'specializations',
      groupArray(['specializations'], 'Specializations', () => CLASS_SPECIALIZATION_NODE_MAP, {
        presentation: 'branch',
        section: CLASS_SECTIONS.classDetails,
        order: 60,
        showIf: isSubclass
      })
    )
})
