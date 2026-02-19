import { ProficiencyGrantAuthored } from '#authored'
import {
  ABILITY_OPTIONS,
  AUTHORING_MODE_KIND_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_OPTIONS,
  PROFICIENCY_KIND_OPTIONS,
  ROUNDING_OPTIONS,
  SCALING_AMOUNT_OPTIONS
} from '#core'
import { buildNodeMap } from '#util'
import type { AllUnionFields } from 'type-fest'

const proficiencyNodeMap
  = buildNodeMap<AllUnionFields<ProficiencyGrantAuthored>>()

export const PROFICIENCY_NODE_MAP = proficiencyNodeMap.define(
  (map, { field, and, or }) => map({
    proficiencyKind: {
      kind: 'INPUT',
      label: 'Proficiency Kind',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: PROFICIENCY_KIND_OPTIONS
      }
    },
    authoringModeKind: {
      kind: 'INPUT',
      label: 'Authoring Mode',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: AUTHORING_MODE_KIND_OPTIONS
      }
    },
    level: {
      kind: 'INPUT',
      label: 'Level',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: SCALING_AMOUNT_OPTIONS
      }
    },
    rounding: {
      kind: 'INPUT',
      label: 'Rounding',
      type: 'SELECT_SINGLE',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: ROUNDING_OPTIONS
      },
      showIf: field('level').eq('HALF')
    },
    skillIds: {
      kind: 'INPUT',
      label: 'Skills',
      type: 'SELECT_MULTI',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'skills'
        }
      },
      showIf: and([
        field('authoringModeKind').eq('SELECTED'),
        field('proficiencyKind').eq('SKILL')
      ])
    },
    abilities: {
      kind: 'INPUT',
      label: 'Abilities',
      type: 'SELECT_MULTI',
      requiredIf: true,
      source: {
        kind: 'INLINE',
        options: ABILITY_OPTIONS
      },
      showIf: and([
        field('authoringModeKind').eq('SELECTED'),
        field('proficiencyKind').eq('SAVE_ABILITY')
      ])
    },
    languageIds: {
      kind: 'INPUT',
      label: 'Languages',
      type: 'SELECT_MULTI',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'languages'
        }
      },
      showIf: and([
        field('authoringModeKind').eq('SELECTED'),
        field('proficiencyKind').eq('LANGUAGE')
      ])
    },
    equipmentIds: {
      kind: 'INPUT',
      label: 'Equipment',
      type: 'SELECT_MULTI',
      requiredIf: true,
      source: {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'equipment'
        }
      },
      showIf: and([
        field('authoringModeKind').eq('SELECTED'),
        field('proficiencyKind').eq('EQUIPMENT')
      ])
    },
    category: {
      kind: 'INPUT',
      label: 'Category',
      type: 'SELECT_SINGLE',
      requiredIf: field('proficiencyKind').eq('EQUIPMENT_PROPERTY'),
      source: {
        kind: 'INLINE',
        options: EQUIPMENT_CATEGORY_OPTIONS
      },
      showIf: or([
        and([
          field('authoringModeKind').eq('SELECTED'),
          field('proficiencyKind').eq('EQUIPMENT_PROPERTY')
        ]),
        and([
          field('authoringModeKind').eq('SELECTED'),
          field('proficiencyKind').eq('EQUIPMENT')
        ])
      ])
    },
    properties: {
      kind: 'INPUT',
      label: 'Properties',
      type: 'SELECT_MULTI',
      requiredIf: field('proficiencyKind').eq('EQUIPMENT_PROPERTY'),
      source: {
        kind: 'INLINE',
        options: EQUIPMENT_PROPERTY_OPTIONS
      },
      showIf: or([
        and([
          field('authoringModeKind').eq('SELECTED'),
          field('proficiencyKind').eq('EQUIPMENT_PROPERTY')
        ]),
        field('proficiencyKind').eq('EQUIPMENT')
      ])
    }
  })
)
