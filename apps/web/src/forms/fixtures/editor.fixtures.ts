import type { EditorHeaderPathItem } from '../components/EditorHeader/EditorHeader.types'
import type { EditableTableRow } from '../components/Table/Table.types'

export const editorHeaderPath: readonly EditorHeaderPathItem[] = [
  { label: 'Ember Lance' },
  { label: 'On Hit' },
  { label: 'Fire Damage' }
]

export const editorScalingRows: readonly EditableTableRow[] = [
  { diceConfig: '3d6', id: 'ember-lance-level-1', level: 1, order: 1 },
  { diceConfig: '4d6', id: 'ember-lance-level-2', level: 2, order: 2 },
  { diceConfig: '5d6', id: 'ember-lance-level-3', level: 3, order: 3 }
]

export const editorDenseScalingRows: readonly EditableTableRow[] = [
  { diceConfig: '3d6', id: 'ember-lance-level-1', level: 1, order: 1 },
  { diceConfig: '4d6', id: 'ember-lance-level-2', level: 2, order: 2 },
  { diceConfig: '5d6', id: 'ember-lance-level-3', level: 3, order: 3 },
  { diceConfig: '6d6', id: 'ember-lance-level-4', level: 4, order: 4 },
  { diceConfig: '7d6', id: 'ember-lance-level-5', level: 5, order: 5 }
]
