import {
  ABILITY_OPTIONS,
  type AbilityCode,
  CLASS_ATTRIBUTE_OPTIONS,
  PREPARE_LIMIT_METHOD_OPTIONS
} from '#core'
import { CHARGE_NODE_MAP, FEATURE_NODE_MAP, PROFICIENCY_NODE_MAP } from '#maps'
import { buildNodeMap, type NodeMap, EmptyObject } from '#utils'
import type { ClassSpellcastingAuthored, ClassPrepareLimitAuthored, ClassResourceAuthored, ClassBaseAuthored, ParentClassAuthored, ClassAuthored } from '#authored'

// Class Spellcasting Node Map - Fixed with proper DSL
const classSpellcastingNode = buildNodeMap<ClassSpellcastingAuthored>()
export const CLASS_SPELLCASTING_NODE_MAP = classSpellcastingNode.define('classSpellcasting', ({ map, nodes, data }) => {
  const { selectSingle, number, text } = nodes
  const { table } = data
  map
    .set('ability', selectSingle(['ability'], 'Spellcasting Ability', {
      kind: 'INLINE',
      options: ABILITY_OPTIONS
    }))
    .set('maxSpellLevel', number(['maxSpellLevel'], 'Max Spell Level'))
    .set('magicName', text(['magicName'], 'Magic Name'))
})

// Class Prepare Limit Node Map - Fixed with proper DSL
const classPrepareLimitNode = buildNodeMap<ClassPrepareLimitAuthored>()
export const CLASS_PREPARE_LIMIT_NODE_MAP = classPrepareLimitNode.define('classPrepareLimit', ({ map, nodes }) => {
  const { selectMulti, selectSingle } = nodes
  map.set('methodKinds', selectMulti(['methodKinds'], 'Method Kinds', {
    kind: 'INLINE',
    options: PREPARE_LIMIT_METHOD_OPTIONS
  }))
})

// Class Resource Node Map - Fixed with proper DSL
const classResourceNode = buildNodeMap<ClassResourceAuthored>()
export const CLASS_RESOURCE_NODE_MAP = classResourceNode.define('classResource', ({ map, nodes }) => {
  const { text, number } = nodes
  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('levelAvailable', number(['levelAvailable'], 'Level Available'))
})

// Class Base Node Map - Fixed with proper DSL to match full ClassBaseAuthored
const classBaseNode = buildNodeMap<ClassBaseAuthored>()
export const CLASS_BASE_NODE_MAP = classBaseNode.define('classBase', ({ map, nodes }) => {
  const { text } = nodes
  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
})

// Parent Class Node Map - Fixed with proper DSL to match full ParentClassAuthored
const parentClassNode = buildNodeMap<ParentClassAuthored>()
export const PARENT_CLASS_NODE_MAP = parentClassNode.define('parentClass', ({ map, nodes }) => {
  const { text, number } = nodes
  map
    .set('startingGold', text(['startingGold'], 'Starting Gold'))
    .set('hitpoint', text(['hitpoint'], 'Hitpoint'))
})

// Class Node Map - Complete map for ClassAuthored with all properties
const classNode = buildNodeMap<ClassAuthored>()
export const CLASS_NODE_MAP = classNode.define('class', ({ map, nodes, data }) => {
  const { text, number, selectMulti, selectSingle } = nodes
  const { table } = data
  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('category', selectSingle(['category'], 'Category', {
      kind: 'INLINE',
      options: [
        { code: 'BASE', label: 'Base Class' },
        { code: 'SUBCLASS', label: 'Subclass' }
      ]
    }))
    .set('parentClassId', selectSingle(['parentClassId'], 'Parent Class', {
      kind: 'DATA',
      relationship: table('classes', {
        selectColumns: ['id', 'label'],
        where: (col) => col('category').eq('BASE')
      })
    }))
    .set('attributes', selectMulti(['attributes'], 'Attributes', {
      kind: 'INLINE',
      options: CLASS_ATTRIBUTE_OPTIONS
    }))
    .set('startingGold', text(['startingGold'], 'Starting Gold'))
    .set('hitpoint', text(['hitpoint'], 'Hitpoint'))
    .set('multiclass', text(['multiclass'], 'Multiclass'))
})
