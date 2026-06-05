export type EditorHeaderPathItem = {
  label: string
}

export type EditorHeaderProps = {
  path: readonly EditorHeaderPathItem[]
  tagLabel?: string
  title: string
}
