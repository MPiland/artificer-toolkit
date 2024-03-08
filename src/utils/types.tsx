import { PropertyPath } from 'lodash'

export type RowInput = {
  name?: string | any[]
  value?: string
  breakpoint?: string[]
  options?: any[]
  validation?: string
  errorMsg?: string
  label?: string
  readOnly?: boolean
  type?: 'input' | 'select'
  multiple?: boolean
  required?: boolean
  optionalKey?: string
  placeholder?: string
  id?: string
}

export type RowHeader = {
  name?:
    | string
    | {
        sortOn: string
        orderKey?: string
        order?: Array<{ [key: number]: string }>
      }
  value?: string
  required?: boolean
  breakpoint?: string[]
  defaultSort?: boolean
}

export type SortConfig = {
  key: {
    orderKey?: string | PropertyPath
    order?: any[]
    sortOn: string | PropertyPath
    subSort?: {
      orderKey?: string | PropertyPath
      order?: any[]
      sortOn: string | PropertyPath | undefined
    }
  }
  direction?: 'ascending' | 'descending'
}

export type ReducerActionType = {
  type?: 'added' | 'reset' | 'removed'
  target: {
    name?: string | string[]
    value?: any
  }
}

export type Context = {
  handleClose?: () => void
  data:
    | any
    | {
        value?: any
      }
}

export type FeatureContext = 'OptionContent' | ''

export type FeatureStepName = 'FeatureContent' | 'SectionContent' | ''

export type SectionName =
  | 'option'
  | 'modifier'
  | 'spell'
  | 'proficiency'
  | 'sense'
  | 'feature'
  | ''

export type SelectOption = string | undefined

export type DropdownOption = {
  name: string | null
  value: string
  id: number | string | null
  _id: number | string | null
  [key: string]: any
}

export type Step =
  | 'Details'
  | 'Traits'
  | 'Attributes'
  | 'Features'
  | 'Contains'
  | 'Proficiencies'
  | 'Equipment'
  | 'Ancestry'

export type FormContext = 'new' | 'edit'
