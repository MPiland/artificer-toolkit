import { PropertyPath } from 'lodash'

export type RowInput = {
  name?: string | any[]
  value?: string
  breakpoint?: boolean
  options?: any[]
  validation?: string
  errorMsg?: string
  label?: string
  readOnly?: boolean
  type?: string
  multiple?: boolean
  required?: boolean
  optionalKey?: string
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
  breakpoint?: boolean
  defaultSort?: boolean
}

export interface SortConfig {
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

export interface Action {
  type?: string
  payload: {
    target: {
      name?: string | string[]
      value?: any
    }
  }
}

export interface Option {
  name: string | null
  value: string
  _id: number | string | null
  [key: string]: any
}

export type Context = {
  handleClose?: () => void
  data:
    | any
    | {
        value?: any
      }
}
