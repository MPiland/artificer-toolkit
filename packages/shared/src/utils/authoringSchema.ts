import {
  actionPresentationPresets,
  type ActionPresentation,
  type SemanticSurfacePresentation,
  type SemanticTextPresentation
} from '@artificer-toolkit/design-system'

/** Common platform-neutral action recipes available to Authoring Schema definitions. */
export const AUTHORING_ACTION_PRESENTATIONS = actionPresentationPresets

/** Whether an authored value is editable by authors or owned by the system. */
export const AUTHORING_EXPOSURE = {
  AUTHOR: 'author',
  SYSTEM: 'system'
} as const

export type AuthoringExposure = (typeof AUTHORING_EXPOSURE)[keyof typeof AUTHORING_EXPOSURE]

/** Platform-neutral editing layout selected by an object-group schema. */
export const OBJECT_GROUP_PRESENTATION = {
  INLINE: 'inline',
  BRANCH: 'branch'
} as const

export type ObjectGroupPresentation =
  (typeof OBJECT_GROUP_PRESENTATION)[keyof typeof OBJECT_GROUP_PRESENTATION]

/** Platform-neutral editing layout selected by an array-group schema. */
export const ARRAY_GROUP_PRESENTATION = {
  INLINE: 'inline',
  TABLE: 'table',
  SUMMARY: 'summary',
  BRANCH: 'branch',
  FOCUSED: 'focused'
} as const

export type ArrayGroupPresentation =
  (typeof ARRAY_GROUP_PRESENTATION)[keyof typeof ARRAY_GROUP_PRESENTATION]

export type GroupPresentation = ObjectGroupPresentation | ArrayGroupPresentation

/** Closed semantic command for adding an item to the current collection. */
export type CollectionAddAction = {
  type: 'collection.add'
  label: string
  presentation: ActionPresentation
}

/** Closed semantic command for opening an existing collection item for editing. */
export type CollectionEditAction = {
  type: 'collection.edit'
  label: string
  presentation: ActionPresentation
}

/** Closed semantic command for copying an item with new identities throughout its subtree. */
export type CollectionDuplicateAction = {
  type: 'collection.duplicate'
  label: string
  presentation: ActionPresentation
}

/** Closed semantic command for removing an item from the current collection. */
export type CollectionRemoveAction = {
  type: 'collection.remove'
  label: string
  presentation: ActionPresentation
}

/** Legal commands for an object group. Object groups cannot be edited or duplicated as rows. */
export type ObjectGroupAction = CollectionAddAction | CollectionRemoveAction

/** Legal commands for an array collection. */
export type CollectionAction =
  | CollectionAddAction
  | CollectionEditAction
  | CollectionDuplicateAction
  | CollectionRemoveAction

/** Fixed workspace navigation command. Domain schemas do not repeat these commands. */
export type StepNavigationAction = {
  type: 'step.navigate'
  direction: 'previous' | 'next'
  label: string
  presentation: ActionPresentation
}

/**
 * Collection order ownership. Derived collections are resolver-ordered. Manual collections use
 * a stable one-segment identity path and may persist a one-segment numeric order path.
 */
export type CollectionOrdering =
  | { mode: 'derived' }
  | {
      mode: 'manual'
      identityPath: readonly [string]
      orderPath?: readonly [string]
    }

export const COLLECTION_ROW_LAYOUT = ['default', 'card', 'flat', 'compact'] as const
export type CollectionRowLayout = (typeof COLLECTION_ROW_LAYOUT)[number]

export const COLLECTION_ROW_EXPANSION = ['collapsible', 'expanded'] as const
export type CollectionRowExpansion = (typeof COLLECTION_ROW_EXPANSION)[number]

export const COLLECTION_JOIN = ['AND', 'OR'] as const
export type CollectionJoin = (typeof COLLECTION_JOIN)[number]

/** Closed summary semantics understood by every authoring client. */
export const COLLECTION_ROW_SUMMARY = [
  'default',
  'facet-context',
  'facet-condition',
  'modifier',
  'effect',
  'effect-path',
  'outcome',
  'speed'
] as const

export type CollectionRowSummary = (typeof COLLECTION_ROW_SUMMARY)[number]

/** Common authoring metadata accepted by every node kind. */
export type NodeAuthoringMeta = {
  exposure?: AuthoringExposure
}

/** Optional responsive visual intent for a group heading and its container. */
export type AuthoringGroupAppearance = {
  heading?: SemanticTextPresentation
  surface?: SemanticSurfacePresentation
}

/** Authoring semantics that apply only to array collections. */
export type NodeCollectionAuthoringMeta = {
  actions: readonly CollectionAction[]
  ordering: CollectionOrdering
  itemLabel?: string
  emptyLabel?: string
  showHeading?: boolean
  join?: CollectionJoin
  rowLayout?: CollectionRowLayout
  rowExpansion?: CollectionRowExpansion
  rowSummary?: CollectionRowSummary
}

/** Authoring semantics that apply only to object groups. */
export type NodeObjectAuthoringMeta = NodeAuthoringMeta & {
  actions?: readonly ObjectGroupAction[]
  appearance?: AuthoringGroupAppearance
  emptyLabel?: string
}

/** Authoring semantics that apply only to array groups. */
export type NodeArrayAuthoringMeta = NodeAuthoringMeta & {
  appearance?: AuthoringGroupAppearance
  collection?: NodeCollectionAuthoringMeta
}

/** Child-map defaults that a containing array group may override. */
export type NodeMapAuthoringMeta = {
  collection?: Pick<NodeCollectionAuthoringMeta, 'rowSummary'>
}

export type ResolvedInputAuthoringMeta = {
  exposure: AuthoringExposure
}

export type ResolvedObjectAuthoringMeta = {
  exposure: AuthoringExposure
  actions: readonly ObjectGroupAction[]
  appearance?: AuthoringGroupAppearance
  emptyLabel?: string
}

export type ResolvedArrayAuthoringMeta = {
  exposure: AuthoringExposure
  appearance?: AuthoringGroupAppearance
  collection: NodeCollectionAuthoringMeta
}

/** Explicit metadata for fields that are owned by persistence or the resolver. */
export const SYSTEM_FIELD_AUTHORING = {
  authoring: { exposure: AUTHORING_EXPOSURE.SYSTEM }
} as const

export function resolveInputAuthoringMeta(
  authoring: NodeAuthoringMeta | undefined
): ResolvedInputAuthoringMeta {
  return { exposure: authoring?.exposure ?? AUTHORING_EXPOSURE.AUTHOR }
}

export function resolveObjectAuthoringMeta(
  label: string,
  authoring: NodeObjectAuthoringMeta | undefined
): ResolvedObjectAuthoringMeta {
  const actions =
    authoring?.actions ??
    ([
      {
        type: 'collection.add',
        label: `Add ${label}`,
        presentation: AUTHORING_ACTION_PRESENTATIONS.button
      },
      {
        type: 'collection.remove',
        label: `Remove ${label}`,
        presentation: AUTHORING_ACTION_PRESENTATIONS.icon
      }
    ] as const)
  assertUniqueActionTypes(actions, `${label} object group`)

  return {
    exposure: authoring?.exposure ?? AUTHORING_EXPOSURE.AUTHOR,
    actions,
    ...(authoring?.appearance === undefined ? {} : { appearance: authoring.appearance }),
    ...(authoring?.emptyLabel === undefined ? {} : { emptyLabel: authoring.emptyLabel })
  }
}

export function resolveArrayAuthoringMeta(
  label: string,
  presentation: ArrayGroupPresentation,
  authoring: NodeArrayAuthoringMeta | undefined,
  mapAuthoring: NodeMapAuthoringMeta | undefined
): ResolvedArrayAuthoringMeta {
  const defaultActions: readonly CollectionAction[] =
    presentation === ARRAY_GROUP_PRESENTATION.SUMMARY ||
    presentation === ARRAY_GROUP_PRESENTATION.FOCUSED
      ? [
          {
            type: 'collection.add',
            label: `Add ${label}`,
            presentation: AUTHORING_ACTION_PRESENTATIONS.button
          },
          {
            type: 'collection.edit',
            label: `Edit ${label}`,
            presentation: AUTHORING_ACTION_PRESENTATIONS.icon
          },
          {
            type: 'collection.duplicate',
            label: `Duplicate ${label}`,
            presentation: AUTHORING_ACTION_PRESENTATIONS.icon
          },
          {
            type: 'collection.remove',
            label: `Remove ${label}`,
            presentation: AUTHORING_ACTION_PRESENTATIONS.icon
          }
        ]
      : [
          {
            type: 'collection.add',
            label: `Add ${label}`,
            presentation: AUTHORING_ACTION_PRESENTATIONS.button
          },
          {
            type: 'collection.remove',
            label: `Remove ${label}`,
            presentation: AUTHORING_ACTION_PRESENTATIONS.icon
          }
        ]
  const collection = authoring?.collection
  const actions = collection?.actions ?? defaultActions
  assertUniqueActionTypes(actions, `${label} collection`)

  return {
    exposure: authoring?.exposure ?? AUTHORING_EXPOSURE.AUTHOR,
    ...(authoring?.appearance === undefined ? {} : { appearance: authoring.appearance }),
    collection: {
      actions,
      ordering: collection?.ordering ?? { mode: 'derived' },
      ...(collection?.itemLabel === undefined ? {} : { itemLabel: collection.itemLabel }),
      ...(collection?.emptyLabel === undefined ? {} : { emptyLabel: collection.emptyLabel }),
      ...(collection?.showHeading === undefined ? {} : { showHeading: collection.showHeading }),
      ...(collection?.join === undefined ? {} : { join: collection.join }),
      ...(collection?.rowLayout === undefined ? {} : { rowLayout: collection.rowLayout }),
      ...(collection?.rowExpansion === undefined ? {} : { rowExpansion: collection.rowExpansion }),
      ...((collection?.rowSummary ?? mapAuthoring?.collection?.rowSummary) === undefined
        ? {}
        : { rowSummary: collection?.rowSummary ?? mapAuthoring?.collection?.rowSummary })
    }
  }
}

export function assertUniqueActionTypes(
  actions: readonly (CollectionAction | ObjectGroupAction)[],
  context: string
): void {
  const seen = new Set<string>()
  for (const action of actions) {
    if (seen.has(action.type)) {
      throw new Error(`${context} defines duplicate action ${action.type}`)
    }
    seen.add(action.type)
  }
}
