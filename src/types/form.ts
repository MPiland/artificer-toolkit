import {
  Character,
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
  AncestryFeature,
  FeatureOption,
  FeatureFeat,
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

export type FormDataType = Spell | Race | Class | Feat | Background | Equipment | Character

export type FeatureDataType = Feature | AncestryFeature | FeatureOption

export type SectionDataType =
  | FeatureModifier
  | FeatureProficiency
  | FeatureSense
  | FeatureSpell
  | FeatureFeat
  | FeatureExpertise

export type CharacterSectionData =
  | CharacterFeat
  | CharacterSense
  | CharacterProficiency
  | CharacterExpertise
  | CharacterModifier

// Helper types for numeric operations
type Subtract<N extends number, M extends number> =
  [...TupleOf<N>]['length'] extends [...TupleOf<M>, ...infer R]['length'] ? R['length'] : never

type TupleOf<N extends number, T extends unknown[] = []> = T['length'] extends N ? T : TupleOf<N, [...T, unknown]>

/**
 * Creates a type representing all possible deep property paths of T as string literals.
 * Handles up to 3 levels of array nesting with proper indexing.
 * Prevents infinite recursion with depth limiting and circular reference detection.
 */

// export type DeepKeyOf<T, Depth extends number = 2, Seen = never> =
//   [Depth] extends (
//     [0] // Stop recursion if Depth reaches 0
//   ) ?
//     never
//   : T extends (
//     object // Only process objects
//   ) ?
//     T extends (
//       Seen // Avoid circular references
//     ) ?
//       never
//     : {
//         [K in keyof T & string]:
//           | `${K}` // Current property key
//           | (NonNullable<T[K]> extends Array<infer U> ?
//               | `${K}.${number}`
//               | (NonNullable<U> extends Array<infer V> ?
//                   | `${K}.${number}.${number}`
//                   | (NonNullable<V> extends Array<infer W> ?
//                       | `${K}.${number}.${number}.${number}`
//                       | `${K}.${number}.${number}.${number}.${DeepKeyOf<NonNullable<W>, Subtract<Depth, 1>, T | Seen>}`
//                     : `${K}.${number}.${number}.${DeepKeyOf<NonNullable<V>, Subtract<Depth, 1>, T | Seen>}`)
//                 : `${K}.${number}.${DeepKeyOf<NonNullable<U>, Subtract<Depth, 1>, T | Seen>}`)
//             : NonNullable<T[K]> extends object ? `${K}.${DeepKeyOf<NonNullable<T[K]>, Subtract<Depth, 1>, T | Seen>}`
//             : never)
//       }[keyof T & string]
//   : never

export type DeepKeyOf<T, Depth extends number = 2, Seen = never> =
  [Depth] extends (
    [0] // Stop recursion if Depth reaches 0
  ) ?
    never
  : T extends (
    object // Only process objects
  ) ?
    T extends (
      Seen // Avoid circular references
    ) ?
      never
    : {
        [K in keyof T & string]:
          | `${K}` // Current property key
          | (NonNullable<T[K]> extends Array<infer U> ?
              | ArrayValue<T, K>
              | (NonNullable<U> extends Array<infer V> ?
                  | NestedArrayValue<T, K>
                  | (NonNullable<V> extends Array<infer W> ? DoubleNestedArrayValue<T, K, W, Depth, Seen>
                    : NestedArrayValueArray<T, K, V, Depth, Seen>)
                : ArrayValueArray<T, K, U, Depth, Seen>)
            : NonNullable<T[K]> extends object ? ObjectProperty<T, K, Depth, Seen>
            : never)
      }[keyof T & string]
  : never

/** Handles object property paths */
type ObjectProperty<
  T,
  K extends keyof T & string,
  Depth extends number,
  Seen,
> = `${K}.${DeepKeyOf<NonNullable<T[K]>, Subtract<Depth, 1>, T | Seen>}`

/** Represents a simple array index path */
type ArrayValue<T, K extends keyof T & string> = `${K}.${number}`

/** Represents a path to a property of an array element */
type ArrayValueArray<
  T,
  K extends keyof T & string,
  U,
  Depth extends number,
  Seen,
> = `${K}.${number}.${DeepKeyOf<NonNullable<U>, Subtract<Depth, 1>, T | Seen>}`

/** Represents a nested array index path */
type NestedArrayValue<T, K extends keyof T & string> = `${K}.${number}.${number}`

/** Represents a path to a property of a nested array element */
type NestedArrayValueArray<
  T,
  K extends keyof T & string,
  V,
  Depth extends number,
  Seen,
> = `${K}.${number}.${number}.${DeepKeyOf<NonNullable<V>, Subtract<Depth, 1>, T | Seen>}`

/** Handles double-nested array paths */
type DoubleNestedArrayValue<T, K extends keyof T & string, W, Depth extends number, Seen> =
  | `${K}.${number}.${number}.${number}`
  | `${K}.${number}.${number}.${number}.${DeepKeyOf<NonNullable<W>, Subtract<Depth, 1>, T | Seen>}`

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

export const sectionSteps = ['modifiers', 'spells', 'proficiencies', 'expertise', 'senses', 'feats'] as const

export type SectionName = (typeof sectionSteps)[number]
export const featureTypes = ['feature', 'option', 'ancestry', 'ancestryOption'] as const

export type FeatureTypes = (typeof featureTypes)[number]
