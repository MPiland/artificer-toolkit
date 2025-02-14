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
  FeatureSubfeature,
  FeatureFeat,
  FeatureAncestry,
  CharacterFeat,
  CharacterSense,
  CharacterProficiency,
  CharacterExpertise,
  CharacterModifier,
  FeatureExpertise,
} from '../../amplify/gql/types'

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

export type FeatureDataType = Feature | AncestryFeature | FeatureOption | FeatureSubfeature

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
          | (T[K] extends Array<infer U>
              ?
                  | `${K}.${number}`
                  | (U extends Array<any>
                      ?
                          | `${K}.${number}.${number}`
                          | (U[number] extends Array<any>
                              ?
                                  | `${K}.${number}.${number}.${number}`
                                  | `${K}.${number}.${number}.${number}.${DeepKeyOf<
                                      U[number][number],
                                      Subtract<Depth, 1>,
                                      T | Seen
                                    >}`
                              : `${K}.${number}.${number}.${DeepKeyOf<U[number], Subtract<Depth, 1>, T | Seen>}`)
                      : `${K}.${number}.${DeepKeyOf<U, Subtract<Depth, 1>, T | Seen>}`)
              : T[K] extends object
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

export const sectionSteps = [
  'modifiers',
  'spells',
  'proficiencies',
  'expertise',
  'senses',
  'feats',
  'ancestries',
  'options',
  'subfeatures',
] as const

export type SectionName = (typeof sectionSteps)[number]

export const featureTypes = ['feature', 'option', 'ancestry', 'subfeature', 'ancestryOption'] as const

export type FeatureTypes = (typeof featureTypes)[number]
