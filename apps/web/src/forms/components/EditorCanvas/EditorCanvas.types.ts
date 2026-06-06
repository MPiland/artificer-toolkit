import type { EditorHeaderPathItem } from '../EditorHeader/EditorHeader.types'
import type { TableProps } from '../Table/Table.types'

export type EditorCanvasProps = {
  path: readonly EditorHeaderPathItem[]
  table: TableProps
  title: string
}
