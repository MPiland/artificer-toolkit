import type { ReactNode } from 'react'

export type EditableTableRow = {
  id: string
  [key: string]: unknown
}

export type ResponsiveMode = 'desktop' | 'mobileLandscape' | 'mobilePortrait' | 'tablet'

export type Mode = 'create' | 'edit'

export type RenderProps = {
  draftRow: EditableTableRow
  mode: Mode
  setDraftRowValue: (key: string, value: unknown) => void
  sourceRow: EditableTableRow | null
}

export type RowCommitPayload = {
  draftRow: EditableTableRow
  mode: Mode
  sourceRow: EditableTableRow | null
}

export type EditableTableColumn = {
  align?: 'center' | 'end' | 'start'
  id: string
  label: string
  renderCell: (row: EditableTableRow) => ReactNode
  width?: string
}

export type TableProps = {
  addLabel?: string
  ariaLabel: string
  columns: readonly EditableTableColumn[]
  createDraftRow?: () => EditableTableRow
  editorTitle?: string | ((row: EditableTableRow | null, mode: Mode) => string)
  forceMode?: ResponsiveMode
  getRowSummary?: (row: EditableTableRow) => ReactNode
  getRowTitle?: (row: EditableTableRow) => string
  onCommitRow?: (payload: RowCommitPayload) => void
  renderRowEditor?: (props: RenderProps) => ReactNode
  renderRowActions?: (row: EditableTableRow) => ReactNode
  rows: readonly EditableTableRow[]
  saveLabel?: string
}
