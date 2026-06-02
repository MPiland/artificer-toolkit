import type { ReactNode } from 'react'

export type EditableTableRow = {
  id: string
  [key: string]: unknown
}

export type ProgressionResponsiveMode = 'desktop' | 'mobileLandscape' | 'mobilePortrait' | 'tablet'

export type ProgressionRowEditorMode = 'create' | 'edit'

export type ProgressionRowEditorRenderProps = {
  draftRow: EditableTableRow
  mode: ProgressionRowEditorMode
  setDraftRowValue: (key: string, value: unknown) => void
  sourceRow: EditableTableRow | null
}

export type ProgressionRowCommitPayload = {
  draftRow: EditableTableRow
  mode: ProgressionRowEditorMode
  sourceRow: EditableTableRow | null
}

export type EditableTableColumn = {
  align?: 'center' | 'end' | 'start'
  id: string
  label: string
  renderCell: (row: EditableTableRow) => ReactNode
  width?: string
}

export type ProgressionTableProps = {
  addLabel?: string
  ariaLabel: string
  columns: readonly EditableTableColumn[]
  createDraftRow?: () => EditableTableRow
  editorTitle?: string | ((row: EditableTableRow | null, mode: ProgressionRowEditorMode) => string)
  forceMode?: ProgressionResponsiveMode
  getRowSummary?: (row: EditableTableRow) => ReactNode
  getRowTitle?: (row: EditableTableRow) => string
  onCommitRow?: (payload: ProgressionRowCommitPayload) => void
  renderRowEditor?: (props: ProgressionRowEditorRenderProps) => ReactNode
  renderRowActions?: (row: EditableTableRow) => ReactNode
  rows: readonly EditableTableRow[]
  saveLabel?: string
}
