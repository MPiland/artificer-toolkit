import type { AuthoredListFilter, AuthoredListItem } from './AuthoredList.types'

const masterPermissions = {
  canView: true,
  canEdit: false,
  canCopy: true,
  canDelete: false
}

const ownedPermissions = {
  canView: true,
  canEdit: true,
  canCopy: true,
  canDelete: true
}

export const spellListItems: AuthoredListItem[] = [
  {
    id: 'magic-missile',
    name: 'Magic Missile',
    attributes: { level: '1', school: 'Evocation', castingTime: '1 Action' },
    badges: ['Sorcerer', 'Wizard'],
    filterValues: { level: '1', school: 'Evocation', class: ['Sorcerer', 'Wizard'] },
    sortValues: { name: 'Magic Missile', level: 1 },
    sourceLabel: 'SRD',
    sourceKind: 'master',
    permissions: masterPermissions
  },
  {
    id: 'misty-step',
    name: 'Misty Step',
    attributes: { level: '2', school: 'Conjuration', castingTime: '1 Bonus Action' },
    badges: ['Sorcerer', 'Warlock', 'Wizard'],
    filterValues: { level: '2', school: 'Conjuration', class: ['Sorcerer', 'Warlock', 'Wizard'] },
    sortValues: { name: 'Misty Step', level: 2 },
    sourceLabel: 'SRD',
    sourceKind: 'master',
    permissions: masterPermissions
  },
  {
    id: 'ember-lace',
    name: 'Ember Lace',
    attributes: { level: '3', school: 'Evocation', castingTime: '1 Action' },
    badges: ['Bard', 'Sorcerer', 'Wizard'],
    filterValues: { level: '3', school: 'Evocation', class: ['Bard', 'Sorcerer', 'Wizard'] },
    sortValues: { name: 'Ember Lace', level: 3 },
    sourceLabel: 'Homebrew',
    sourceKind: 'owned',
    permissions: ownedPermissions
  },
  {
    id: 'warding-rune',
    name: 'Warding Rune',
    attributes: { level: '2', school: 'Abjuration', castingTime: '1 Reaction' },
    badges: ['Cleric', 'Wizard'],
    filterValues: { level: '2', school: 'Abjuration', class: ['Cleric', 'Wizard'] },
    sortValues: { name: 'Warding Rune', level: 2 },
    sourceLabel: 'Homebrew',
    sourceKind: 'owned',
    permissions: ownedPermissions
  },
  {
    id: 'healing-word',
    name: 'Healing Word',
    attributes: { level: '1', school: 'Evocation', castingTime: '1 Bonus Action' },
    badges: ['Bard', 'Cleric', 'Druid'],
    filterValues: { level: '1', school: 'Evocation', class: ['Bard', 'Cleric', 'Druid'] },
    sortValues: { name: 'Healing Word', level: 1 },
    sourceLabel: 'SRD',
    sourceKind: 'master',
    permissions: masterPermissions
  }
]

export const spellListFilters: AuthoredListFilter[] = [
  {
    key: 'school',
    label: 'School',
    placeholder: 'Any school',
    options: [
      { value: 'Abjuration', label: 'Abjuration' },
      { value: 'Conjuration', label: 'Conjuration' },
      { value: 'Evocation', label: 'Evocation' }
    ]
  },
  {
    key: 'level',
    label: 'Level',
    placeholder: 'Any level',
    options: [
      { value: '1', label: '1st level' },
      { value: '2', label: '2nd level' },
      { value: '3', label: '3rd level' }
    ]
  },
  {
    key: 'class',
    label: 'Class',
    placeholder: 'Any class',
    options: [
      { value: 'Bard', label: 'Bard' },
      { value: 'Cleric', label: 'Cleric' },
      { value: 'Sorcerer', label: 'Sorcerer' },
      { value: 'Warlock', label: 'Warlock' },
      { value: 'Wizard', label: 'Wizard' }
    ]
  }
]
