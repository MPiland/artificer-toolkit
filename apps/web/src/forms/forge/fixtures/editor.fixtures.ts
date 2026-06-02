import type { EditorHeaderPathItem } from '../components/EditorHeader/EditorHeader.types'
import type { EditableTableRow } from '../components/ProgressionTable/ProgressionTable.types'

export const editorHeaderPath: readonly EditorHeaderPathItem[] = [
  { label: 'Ember Lance' },
  { label: 'On Hit' },
  { label: 'Fire Damage' }
]

export const editorScalingRows: readonly EditableTableRow[] = [
  { addedDice: 'Base', id: 'level-1', level: 1, notes: 'Base level', totalDamage: '2d6' },
  { addedDice: '+1d6', id: 'level-6', level: 6, notes: 'Optional note...', totalDamage: '3d6' },
  { addedDice: '+1d6', id: 'level-11', level: 11, notes: 'Optional note...', totalDamage: '4d6' }
]

export const editorDenseScalingRows: readonly EditableTableRow[] = [
  { addedDice: 'Base', id: 'level-1', level: 1, notes: 'Base level', totalDamage: '2d6' },
  { addedDice: '+1d6', id: 'level-3', level: 3, notes: 'Early scaling', totalDamage: '3d6' },
  { addedDice: '+1d6', id: 'level-6', level: 6, notes: 'Signature bump', totalDamage: '4d6' },
  { addedDice: '+1d6', id: 'level-9', level: 9, notes: 'Mid-tier pressure', totalDamage: '5d6' },
  { addedDice: '+1d6', id: 'level-11', level: 11, notes: 'High-tier bump', totalDamage: '6d6' }
]

export const editorScalingRowsWithoutNotes: readonly EditableTableRow[] = [
  { addedDice: 'Base', id: 'level-1', level: 1, totalDamage: '2d6' },
  { addedDice: '+1d6', id: 'level-6', level: 6, totalDamage: '3d6' },
  { addedDice: '+1d6', id: 'level-11', level: 11, totalDamage: '4d6' }
]
