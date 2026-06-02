import type { EditorHeaderPathItem } from '../EditorHeader/EditorHeader.types'
import type { ProgressionTableProps } from '../ProgressionTable/ProgressionTable.types'

export type EditorCanvasProps = {
  path: readonly EditorHeaderPathItem[]
  progressionTable: ProgressionTableProps
  title: string
}
