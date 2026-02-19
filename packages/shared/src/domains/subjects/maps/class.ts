import {
  CLASS_CATEGORY_REGISTRY,
  CLASS_ATTRIBUTE_REGISTRY,
  FEATURE_CATEGORY_REGISTRY,
  PREPARE_LIMIT_METHOD_REGISTRY,
  SUBCLASS_ATTRIBUTE_REGISTRY,
  type AbilityCode
} from '#core'
import { CHARGE_NODE_MAP, FEATURE_NODE_MAP, PROFICIENCY_NODE_MAP } from '../../../../dist/maps/maps.js'
import type { NodeMap } from '#util'
import type { EmptyObject } from 'type-fest'

export type ClassSpellcastingNodePayloads = {
  ability: { ability: AbilityCode }
  maxSpellLevel: { spellLevel: number }
}

export const CLASS_SPELLCASTING_NODE_MAP: NodeMap<ClassSpellcastingNodePayloads> = {
  ability: {
    kind: 'LEAF',
    meta: {
      label: 'Spellcasting Ability',
      code: 'SPELLCASTING_ABILITY',
      tooltip: 'Spellcasting ability of the class.'
    },
    payload: 'ability'
  },
  maxSpellLevel: {
    kind: 'LEAF',
    meta: {
      label: 'Max Spell Level',
      code: 'MAX_SPELL_LEVEL',
      tooltip: 'Max spell level of the class.'
    },
    payload: 'maxSpellLeve'
  }
}

export type ClassPrepareLimitNodePayloads = {
  spellCastingAbility: { ability: AbilityCode }
  classLevel: { multiplier?: number }
  perLevelTable: { perLevel: { classLevel: number, amount: number }[] }
}

export const CLASS_PREPARE_LIMIT_NODE_PATH: NodeMap<ClassPrepareLimitNodePayloads>
  = {
    spellCastingAbility: {
      kind: 'LEAF',
      meta: PREPARE_LIMIT_METHOD_REGISTRY.SPELLCASTING_ABILITY,
      payload: 'spellCastingAbility'
    },
    classLevel: {
      kind: 'LEAF',
      meta: PREPARE_LIMIT_METHOD_REGISTRY.CLASS_LEVEL,
      payload: 'classLevel'
    },
    perLevelTable: {
      kind: 'LEAF',
      meta: PREPARE_LIMIT_METHOD_REGISTRY.PER_LEVEL,
      payload: 'perLevelTable'
    }
  }

export type ClassResourceNodePayload = {
  charges: EmptyObject
}

export const CLASS_RESOURCE_NODE_MAP: NodeMap<ClassResourceNodePayload> = {
  charges: {
    kind: 'BRANCH',
    enables: {
      kind: 'PATH',
      map: CHARGE_NODE_MAP
    }
  }
}

export type BaseClassNodePayloads = {
  features: { featureIds?: string[] }
  resources: { resourceIds?: string[] }
}

export const BASE_CLASS_NODE_MAP: NodeMap<BaseClassNodePayloads> = {
  features: {
    kind: 'BRANCH',
    meta: {
      ...FEATURE_CATEGORY_REGISTRY.FEATURE,
      label: 'Features'
    },
    payload: 'features',
    enables: {
      kind: 'PATH',
      map: FEATURE_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'BRIDGE',
          table: 'class_features',
          parentColumn: 'class_id',
          childColumn: 'feature_id'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  resources: {
    kind: 'BRANCH',
    meta: {
      ...CLASS_ATTRIBUTE_REGISTRY.RESOURCE,
      label: 'Resources'
    },
    payload: 'resources',
    enables: {
      kind: 'PATH',
      map: CLASS_RESOURCE_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'FOREIGN_KEY',
          parent: {
            table: 'classes',
            column: 'id'
          },
          child: {
            table: 'class_resources',
            column: 'class_id'
          }
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  }
}

export type SubclassNodePayload = BaseClassNodePayloads & {
  subtypes: { subtypes: string[] }
}

export const SUBCLASS_NODE_MAP: NodeMap<SubclassNodePayload> = {
  ...BASE_CLASS_NODE_MAP,
  subtypes: {
    kind: 'LEAF',
    meta: {
      ...SUBCLASS_ATTRIBUTE_REGISTRY.SUBTYPE,
      label: 'Subtypes'
    },
    payload: 'subtypes'
  }
}

export type ClassNodePayloads = BaseClassNodePayloads & {
  subclasses: { subclassIds: string[] }
}

export const CLASS_NODE_MAP: NodeMap<ClassNodePayloads> = {
  subclasses: {
    kind: 'BRANCH',
    meta: {
      ...CLASS_CATEGORY_REGISTRY.SUBCLASS,
      label: 'Subclasses'
    },
    enables: {
      kind: 'PATH',
      map: SUBCLASS_NODE_MAP
    },
    payload: 'subclasses',
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'CONDITION',
          table: 'classes',
          column: 'category',
          condition: 'SUBCLASS'
        },
        selection: 'MULTI_REQUIRED',
        order: 0
      }
    ]
  },
  proficiencies: {
    kind: 'BRANCH',
    enables: {
      kind: 'PATH',
      map: PROFICIENCY_NODE_MAP
    }
  }
}
