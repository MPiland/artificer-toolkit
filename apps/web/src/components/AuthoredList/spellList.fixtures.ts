import type { AuthoredListFilter, AuthoredListItem } from './AuthoredList.types'
import { foundationVars } from '#css/foundations.css'

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
    publicId: '1',
    name: 'Magic Missile',
    description: 'Three glowing darts of magical force strike creatures you can see within range.',
    attributes: {
      level: '1',
      school: 'Evocation',
      classes: ['Sorcerer', 'Wizard'],
      castingTime: '1 Action'
    },
    statusLabel: 'Active',
    filterValues: { level: '1', school: 'Evocation', class: ['Sorcerer', 'Wizard'] },
    sortValues: { name: 'Magic Missile', level: 1, school: 'Evocation' },
    accentColor: foundationVars.color.school.evocation,
    accentLabel: 'Evocation school',
    sourceLabel: 'SRD',
    sourceKind: 'master',
    permissions: masterPermissions
  },
  {
    id: 'misty-step',
    publicId: '2',
    name: 'Misty Step',
    description: 'Teleport up to 30 feet to an unoccupied space you can see.',
    attributes: {
      level: '2',
      school: 'Conjuration',
      classes: ['Sorcerer', 'Warlock', 'Wizard'],
      castingTime: '1 Bonus Action'
    },
    statusLabel: 'Active',
    filterValues: { level: '2', school: 'Conjuration', class: ['Sorcerer', 'Warlock', 'Wizard'] },
    sortValues: { name: 'Misty Step', level: 2, school: 'Conjuration' },
    accentColor: foundationVars.color.school.conjuration,
    accentLabel: 'Conjuration school',
    sourceLabel: 'SRD',
    sourceKind: 'master',
    permissions: masterPermissions
  },
  {
    id: 'ember-lace',
    publicId: '3',
    name: 'Ember Lace',
    description: 'A ribbon of flame follows a creature across the battlefield.',
    attributes: {
      level: '3',
      school: 'Evocation',
      classes: ['Bard', 'Sorcerer', 'Wizard'],
      castingTime: '1 Action'
    },
    statusLabel: 'Draft',
    statusTone: 'draft',
    filterValues: { level: '3', school: 'Evocation', class: ['Bard', 'Sorcerer', 'Wizard'] },
    sortValues: { name: 'Ember Lace', level: 3, school: 'Evocation' },
    accentColor: foundationVars.color.school.evocation,
    accentLabel: 'Evocation school',
    sourceLabel: 'Homebrew',
    sourceKind: 'owned',
    permissions: ownedPermissions
  },
  {
    id: 'warding-rune',
    publicId: '4',
    name: 'Warding Rune',
    description: 'A protective sigil flares when danger closes in.',
    attributes: {
      level: '2',
      school: 'Abjuration',
      classes: ['Cleric', 'Wizard'],
      castingTime: '1 Reaction'
    },
    statusLabel: 'Draft',
    statusTone: 'draft',
    filterValues: { level: '2', school: 'Abjuration', class: ['Cleric', 'Wizard'] },
    sortValues: { name: 'Warding Rune', level: 2, school: 'Abjuration' },
    accentColor: foundationVars.color.school.abjuration,
    accentLabel: 'Abjuration school',
    sourceLabel: 'Homebrew',
    sourceKind: 'owned',
    permissions: ownedPermissions
  },
  {
    id: 'healing-word',
    publicId: '5',
    name: 'Healing Word',
    description: 'A creature you can see within range regains hit points.',
    attributes: {
      level: '1',
      school: 'Evocation',
      classes: ['Bard', 'Cleric', 'Druid'],
      castingTime: '1 Bonus Action'
    },
    statusLabel: 'Active',
    filterValues: { level: '1', school: 'Evocation', class: ['Bard', 'Cleric', 'Druid'] },
    sortValues: { name: 'Healing Word', level: 1, school: 'Evocation' },
    accentColor: foundationVars.color.school.evocation,
    accentLabel: 'Evocation school',
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
