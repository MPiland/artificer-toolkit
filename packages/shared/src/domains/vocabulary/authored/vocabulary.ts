export interface Vocabulary<TCode extends string = string> {
  id: string
  code: TCode
  label: string
  description?: string | null
  tooltip?: string | null
  short?: string | null
}
