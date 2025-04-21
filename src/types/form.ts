import type {
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
  SpellListItem,
  ClassListItem,
  RaceListItem,
  EquipmentListItem,
  FeatListItem,
  BackgroundListItem,
  SpellMeta,
  ClassMeta,
  RaceMeta,
  EquipmentMeta,
} from '../../amplify/gql/types'
import { Paths } from 'type-fest'

export type ListItemType =
  | SpellListItem
  | ClassListItem
  | RaceListItem
  | EquipmentListItem
  | FeatListItem
  | BackgroundListItem
  | Character

type UpdateField<T> = (arg: { path: Paths<T>; value: any }) => void
type RemoveField<T> = (arg: { path: Paths<T> }) => void
type AddField<T> = (arg: { path: Paths<T>; value?: any }) => void

export type OnChange<T> = {
  updateField: UpdateField<T>
  removeField: RemoveField<T>
  addField: AddField<T>
}

export type MetaDataType = SpellMeta | ClassMeta | RaceMeta | EquipmentMeta

export type FormDataType = Spell | Race | Class | Feat | Background | Equipment | Character

export type FeatureDataType = Feature | AncestryFeature | FeatureOption

export type FormType = 'spells' | 'equipment' | 'characters' | 'classes' | 'races' | 'backgrounds' | 'feats'

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

export type DeepKeyOf<T> = Extract<Paths<T>, string>

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
