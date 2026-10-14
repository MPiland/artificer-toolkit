export interface CoreMeta<TCode extends string = string> {
  code: TCode
  label: string
  description?: string | null
  short?: string | null
}
