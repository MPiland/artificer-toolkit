import {
  actionAppearancePresets,
  actionPresentationPresets
} from '@artificer-toolkit/design-system'

export const LOGIC_OPTION_AUTHORING = {
  authoring: {
    collection: {
      actions: [
        {
          type: 'collection.add',
          label: 'Add option',
          presentation: {
            default: actionAppearancePresets.text,
            compact: {
              ...actionAppearancePresets.button,
              width: 'full',
              density: 'comfortable'
            }
          }
        },
        {
          type: 'collection.remove',
          label: 'Remove option',
          presentation: actionPresentationPresets.icon
        }
      ],
      ordering: { mode: 'derived' },
      itemLabel: 'option',
      emptyLabel: 'No restriction options added yet.',
      showHeading: false,
      join: 'OR',
      rowLayout: 'card',
      rowExpansion: 'expanded'
    }
  }
} as const

export const LOGIC_CONTEXT_AUTHORING = {
  authoring: {
    collection: {
      actions: [
        {
          type: 'collection.add',
          label: 'Add condition',
          presentation: {
            default: actionAppearancePresets.text,
            compact: {
              ...actionAppearancePresets.button,
              width: 'full',
              density: 'comfortable'
            }
          }
        },
        {
          type: 'collection.remove',
          label: 'Remove condition',
          presentation: actionPresentationPresets.text
        }
      ],
      ordering: { mode: 'derived' },
      itemLabel: 'condition',
      emptyLabel: 'No conditions added yet.',
      showHeading: false,
      join: 'AND',
      rowLayout: 'flat',
      rowExpansion: 'expanded',
      rowSummary: 'facet-context'
    }
  }
} as const

export const LOGIC_CONDITION_AUTHORING = {
  authoring: {
    collection: {
      actions: [],
      ordering: { mode: 'derived' },
      itemLabel: 'condition',
      emptyLabel: 'This condition has not been configured yet.',
      showHeading: false,
      join: 'AND',
      rowLayout: 'compact',
      rowExpansion: 'expanded',
      rowSummary: 'facet-condition'
    }
  }
} as const
