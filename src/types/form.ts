import {
  Character,
  ClassInput,
  FeatInput,
  RaceInput,
  SpellInput,
  BackgroundInput,
  EquipmentInput,
  CharacterInput,
  Background,
  Class,
  Equipment,
  Feat,
  Race,
  Spell,
  Feature,
  FeatureModifier,
  FeatureProficiency,
  FeatureSense,
  FeatureSpell,
  FeatureInput,
  AncestryFeature,
  FeatureOption,
  Subfeature,
  FeatureFeat,
  FeatureAncestry,
  CharacterFeat,
  CharacterSense,
  CharacterProficiency,
  CharacterExpertise,
  CharacterModifier,
  FeatureExpertise,
} from '../../amplify/API'

export type UpdateState<T> =
  | { type: 'add'; path: DeepKeyOf<T>; value?: any }
  | { type: 'update'; path: DeepKeyOf<T>; value: any }
  | { type: 'remove'; path: DeepKeyOf<T> }
  | { type: 'reset'; value: any }
  | { type: 'initialReset'; value: any }
  | { type: 'index'; value: number }

export type FormInputType =
  | SpellInput
  | RaceInput
  | ClassInput
  | FeatInput
  | BackgroundInput
  | EquipmentInput
  | CharacterInput
  | FeatureInput

export type FormDataType = Spell | Race | Class | Feat | Background | Equipment | Character

export type FeatureDataType = Feature | AncestryFeature | FeatureOption | Subfeature

export type SectionDataType =
  | FeatureModifier
  | FeatureProficiency
  | FeatureSense
  | FeatureSpell
  | FeatureFeat
  | FeatureAncestry
  | FeatureExpertise

export type CharacterSectionData =
  | CharacterFeat
  | CharacterSense
  | CharacterProficiency
  | CharacterExpertise
  | CharacterModifier

export type DeepKeyOf<T, Depth extends number = 4, Seen = never> = [Depth] extends [0] // Stop recursion if Depth reaches 0
  ? never
  : T extends object // Only process objects
  ? T extends Seen // Avoid circular references
    ? never
    : {
        [K in keyof T & string]:
          | `${K}` // Current property key
          | (T[K] extends Array<infer U> // Handle arrays
              ? `${K}.${number}` | `${K}.${number}.${DeepKeyOf<U, Subtract<Depth, 1>, T | Seen>}`
              : T[K] extends object // Handle nested objects
              ? `${K}.${DeepKeyOf<T[K], Subtract<Depth, 1>, T | Seen>}`
              : never)
      }[keyof T & string]
  : never

// Helper types
type Subtract<N extends number, M extends number> = [...TupleOf<N>]['length'] extends [
  ...TupleOf<M>,
  ...infer R
]['length']
  ? R['length']
  : never

type TupleOf<N extends number, T extends unknown[] = []> = T['length'] extends N ? T : TupleOf<N, [...T, unknown]>

export type Step = {
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
  label:
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

export type FormSteps = Step['id']

export type Context = {
  type?: 'new' | 'edit' | string
  title?: 'classes' | 'spells' | 'races' | 'equipment' | 'feats' | 'options' | 'backgrounds' | 'characters'
}

export const sectionSteps = [
  'modifiers',
  'spells',
  'proficiencies',
  'expertise',
  'senses',
  'feats',
  'ancestries',
] as const

export type SectionName = (typeof sectionSteps)[number]

export const featureTypes = ['feature', 'option', 'ancestry', 'subfeature'] as const

export type FeatureTypes = (typeof featureTypes)[number]

export type ClassSpell = {
  level: number
  spells: Spell[]
}
