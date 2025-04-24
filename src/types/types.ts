import type {
  SpellListItem,
  ClassListItem,
  RaceListItem,
  EquipmentListItem,
  FeatListItem,
  BackgroundListItem,
  Character,
  SpellMeta,
  ClassMeta,
  RaceMeta,
  EquipmentMeta,
  Spell,
  Race,
  Class,
  Feat,
  Background,
  Equipment,
  Feature,
  AncestryFeature,
  FeatureOption,
  FeatureModifier,
  FeatureProficiency,
  FeatureSense,
  FeatureSpell,
  FeatureFeat,
  FeatureExpertise,
  CharacterFeat,
  CharacterSense,
  CharacterProficiency,
  CharacterExpertise,
  CharacterModifier,
  System,
} from '@/types'
import { Paths } from 'type-fest'
import { sectionSteps, FEATURE_TYPES } from '@/components/Form'

export type SourceTypeMap = {
  spells: Spell
  classes: Class
  equipment: Equipment
  system: System
  races: Race
  feats: Feat
  backgrounds: Background
}

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

export type SectionName = (typeof sectionSteps)[number]

export type FeatureTypes = (typeof FEATURE_TYPES)[number]
