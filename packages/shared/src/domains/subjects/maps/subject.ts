import {
  BACKGROUND_NODE_MAP,
  CHARACTER_NODE_MAP,
  CLASS_NODE_MAP,
  EQUIPMENT_NODE_MAP,
  FEAT_NODE_MAP,
  RACE_NODE_PATH,
  SPELL_NODE_MAP
} from '#maps'
import type { EnabledPathMap, Enables, NodeOptions, EmptyObject } from '#utils'

// -----------------------------------------------------------------------------
// Subject: A subject node is an entry point and MUST enable a PATH.
// -----------------------------------------------------------------------------

export type SubjectNode<SPayload extends Record<string, unknown>>
  = | (
    {
      kind: 'BRANCH'
      label: string
      enables: Enables
      // subject nodes may have options (DATA ROOT, etc.) — keep it open but typed
      options: NodeOptions[]
    } & { payload?: keyof SPayload }
) // change this to `payload: keyof SPayload`. // If you want to enforce that subject nodes always write a payload key, // Subject nodes may or may not write payload directly.

  // Subject node map: keys are subject codes; values are SubjectBranchNode with PATH enables.
| {
  kind: 'LEAF'
  label: string
  enables: Enables
}
export type SubjectNodeMap<SPayload extends Record<string, unknown>> = {
  [S in keyof SPayload]: SubjectNode<SPayload>
}

export type SubjectNodePayload = {
  EQUIPMENT: { equipmentIds?: string[] }
  CLASS: { classIds?: string[] }
  SPELL: { spellIds?: string[] }
  FEAT: { featIds?: string[] }
  BACKGROUND: { backgroundIds?: string[] }
  RACE: { raceIds?: string[] }
  CHARACTER: EmptyObject
}

export const SUBJECT_NODE_MAP: SubjectNodeMap<SubjectNodePayload> = {
  EQUIPMENT: {
    kind: 'BRANCH',
    label: 'Equipment',
    payload: 'EQUIPMENT',
    enables: {
      kind: 'PATH',
      map: EQUIPMENT_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'equipment'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  CLASS: {
    kind: 'BRANCH',
    label: 'Classes',
    payload: 'CLASS',
    enables: {
      kind: 'PATH',
      map: CLASS_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'classes'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  SPELL: {
    kind: 'BRANCH',
    label: 'Spells',
    payload: 'SPELL',
    enables: {
      kind: 'PATH',
      map: SPELL_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'spells'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  FEAT: {
    kind: 'BRANCH',
    label: 'Feats',
    payload: 'FEAT',
    enables: {
      kind: 'PATH',
      map: FEAT_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'feats'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  BACKGROUND: {
    kind: 'BRANCH',
    label: 'Backgrounds',
    payload: 'BACKGROUND',
    enables: {
      kind: 'PATH',
      map: BACKGROUND_NODE_MAP
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'backgrounds'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  RACE: {
    kind: 'BRANCH',
    label: 'Races',
    payload: 'RACE',
    enables: {
      kind: 'PATH',
      map: RACE_NODE_PATH
    },
    options: [
      {
        kind: 'DATA',
        relationship: {
          kind: 'ROOT',
          table: 'races'
        },
        selection: 'MULTI_OPTIONAL',
        order: 0
      }
    ]
  },
  CHARACTER: {
    kind: 'LEAF',
    label: 'Character',
    enables: {
      kind: 'PATH',
      map: CHARACTER_NODE_MAP
    }
  }
} as const

// Derived types
export type SubjectMap = typeof SUBJECT_NODE_MAP
export type SubjectKey = keyof SubjectMap

export type SubjectNextMap<S extends SubjectKey> = EnabledPathMap<SubjectMap[S]>
