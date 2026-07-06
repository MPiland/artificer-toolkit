import type { ItemProps, ItemStatus } from '../layout/Steps/Item/Item.types'
import type { SummaryProps } from '../layout/Steps/StatusSummary/StatusSummary.types'

export const railItems: readonly ItemProps[] = [
  {
    id: 'spell-basics',
    icon: 'book',
    label: 'Spell Basics',
    status: 'complete'
  },
  {
    children: [
      {
        description: 'Action, range, targeting',
        icon: 'spark',
        id: 'how-it-starts',
        label: 'How It Starts',
        level: 1,
        status: 'complete'
      },
      {
        children: [
          {
            children: [
              {
                description: 'Slot scaling rules',
                icon: 'trend',
                id: 'upcast-scaling',
                isActive: true,
                label: 'Upcast Scaling',
                level: 3,
                status: 'dirty'
              },
              {
                icon: 'gear',
                id: 'conditions',
                label: 'Conditions',
                level: 3,
                status: 'empty',
                tone: 'muted'
              }
            ],
            expanded: true,
            icon: 'flame',
            id: 'fire-damage',
            label: 'Fire Damage',
            level: 2,
            status: 'complete'
          },
          {
            icon: 'bolt',
            id: 'saving-throw',
            label: 'Saving Throw',
            level: 2,
            status: 'warning'
          }
        ],
        expanded: true,
        icon: 'check',
        id: 'on-hit',
        label: 'On Hit',
        level: 1,
        status: 'complete'
      }
    ],
    expanded: true,
    icon: 'gear',
    id: 'mechanics',
    label: 'Mechanics',
    status: 'dirty'
  },
  {
    icon: 'book',
    id: 'description',
    label: 'Description',
    status: 'complete'
  },
  {
    icon: 'spark',
    id: 'options',
    label: 'Options',
    status: 'empty',
    tone: 'muted'
  }
]

export const railSummaries: readonly SummaryProps[] = [
  { label: 'complete', status: 'complete', value: '6/8' },
  { label: 'unsaved', status: 'dirty', value: 'Edited' },
  { label: 'needs review', status: 'warning', value: '1 issue' }
]

export const defaultRailItem: ItemProps = {
  icon: 'book',
  id: 'spell-basics',
  label: 'Spell Basics',
  status: 'complete'
}

export const activeNestedRailItem: ItemProps = {
  description: 'Slot scaling rules',
  icon: 'trend',
  id: 'upcast-scaling',
  isActive: true,
  label: 'Upcast Scaling',
  level: 3,
  status: 'dirty'
}

export const mutedEmptyRailItem: ItemProps = {
  icon: 'gear',
  id: 'conditions',
  label: 'Conditions',
  level: 3,
  status: 'empty',
  tone: 'muted'
}

export const expandedBranchRailItem: ItemProps = {
  children: [
    {
      icon: 'spark',
      id: 'how-it-starts',
      label: 'How It Starts',
      level: 1,
      status: 'complete'
    },
    {
      icon: 'check',
      id: 'on-hit',
      label: 'On Hit',
      level: 1,
      status: 'dirty'
    }
  ],
  expanded: true,
  icon: 'gear',
  id: 'mechanics',
  label: 'Mechanics',
  status: 'dirty'
}

export const statusMarkerStatuses: readonly ItemStatus[] = [
  'complete',
  'dirty',
  'warning',
  'error',
  'empty'
]
