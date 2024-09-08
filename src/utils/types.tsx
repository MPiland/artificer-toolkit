import { PropertyPath } from 'lodash'

export type FilterType = {
  key: string
  array?: any[]
  object?: any
  mapKey?: string
  type: 'equal' | 'notEqual'
  value?: string | null
  matchingKey?: string
}

export type RowInputType = {
  name?: string | any[]
  value?: string
  breakpoint?: string[]
  options?: any[]
  validation?: 'num' | 'cur'
  errorMsg?: string
  label?: string
  readOnly?: boolean
  type?: 'input' | 'select'
  filter?: FilterType[]
  multiple?: boolean
  required?: boolean
  optionalKey?: string
  placeholder?: string
  id?: string
}

export type RowHeaderType = {
  name?:
    | string
    | {
        sortOn: string
        orderKey?: string
        order?: Array<{ [key: number]: string }>
        filter?: {
          filterOn: string | PropertyPath
          filterKey: string
        }
        subSort?: {
          sortOn: string
          orderKey?: string
        }
      }
  value?: string
  required?: boolean
  breakpoint?: string[]
  defaultSort?: boolean
}

export type SortConfigType = {
  key: {
    orderKey?: string | PropertyPath
    order?: any[]
    sortOn: string | PropertyPath
    subSort?: {
      orderKey?: string | PropertyPath
      order?: any[]
      sortOn: string | PropertyPath | undefined
    }
    filter?: {
      filterKey: string
      filterOn: string | PropertyPath
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

export type DropdownOptionType = {
  name: string | number | null | undefined
  value: string | number | null | undefined
  _id: number | string | null
  [key: string]: any
}

export type StepType = {
  id:
    | 'details'
    | 'class'
    | 'race'
    | 'abilities'
    | 'traits'
    | 'attributes'
    | 'features'
    | 'contains'
    | 'proficiencies'
    | 'equipment'
    | 'startingEquipment'
    | 'ancestry'
    | 'background'
  name:
    | 'Details'
    | 'Class'
    | 'Race'
    | 'Abilities'
    | 'Traits'
    | 'Attributes'
    | 'Features'
    | 'FeaturesContent'
    | 'Contains'
    | 'Proficiencies'
    | 'Equipment'
    | 'Starting Equipment'
    | 'Ancestry'
    | 'Background'
}

export type ContextType = {
  type?: 'new' | 'edit' | string
  title?: 'classes' | 'spells' | 'races' | 'items' | 'feats' | 'options' | 'backgrounds' | 'characters'
}

export type SectionNameType =
  | 'options'
  | 'modifiers'
  | 'spells'
  | 'proficiencies'
  | 'expertise'
  | 'senses'
  | 'features'
  | 'ancestry'
  | 'feats'
  | ''

export type FeatureStepType = 'feature' | 'option' | 'subfeature' | ''

export type DiceConfigType = {
  quantity: number
  type: number
  reduceType: 'kl' | 'kh' | 'dl' | 'dh' | null | undefined
  reduceCount: number
  rerollType: 'r' | 'ro' | null | undefined
  rerollCondition: '<' | '>' | '===' | null | undefined
  rerollValue: number
}

export type DiceResultType = {
  type: number
  value: number
  id?: string
}

export type DiceRollsType = {
  score: number | null
  ability: any
  rolling: boolean
  rolled: DiceResultType[]
  kept: DiceResultType[]
  applied: boolean
}

export type SectionOptionsType = {
  section: any
  sectionName: SectionNameType
  feature?: any
  optionIndex: string
  state: any
  builders: any
  feats?: any
  spells?: any
  items?: any
  classes?: any
  featureType: 'race' | 'class'
  featureLevel?: number
}

export type Point = { x: number; y: number; z: number }

export type FeatureArrayType = {
  level: number
  features: any[]
}

export type ClassProficiencyType = {
  [key: string]: {
    type: any[]
    property?: any[]
    selectionCount: number | null
  }
}

export type ClassSpellType = {
  level: number
  spells: any[]
}
