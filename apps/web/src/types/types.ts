import type {
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
  Race,
  Equipment,
  Feat,
  Character,
  Spell,
  Background,
  Class,
  System,
  Feature,
  SubfeatureOption,
  SubfeatureModifier,
  SubfeatureProficiency,
  SubfeatureSpell,
  SubfeatureSense,
  SubfeatureFeat,
  SubfeatureExpertise
} from '@artificer-toolkit/shared'
import { Paths } from 'type-fest'

export type WithKind<T, K extends string> = { __kind: K } & Partial<T>
export type BackgroundInput = WithKind<Background, 'BackgroundInput'>
export type RaceInput = WithKind<Race, 'RaceInput'>
export type ClassInput = WithKind<Class, 'ClassInput'>
export type FeatInput = WithKind<Feat, 'FeatInput'>
export type SpellInput = WithKind<Spell, 'SpellInput'>
export type EquipmentInput = WithKind<Equipment, 'EquipmentInput'>
export type CharacterInput = WithKind<Character, 'CharacterInput'>
export type SystemInput = WithKind<System, 'SystemInput'>
export type FeatureInput = WithKind<Feature, 'FeatureInput'>

export type SourceTypeMap = {
  spells: Spell
  classes: Class
  equipment: Equipment
  system: System
  races: Race
  feats: Feat
  backgrounds: Background
}

export type ListItemType
  = | SpellListItem
    | ClassListItem
    | RaceListItem
    | EquipmentListItem
    | FeatListItem
    | BackgroundListItem
    | Character

export type MetaDataType = SpellMeta | ClassMeta | RaceMeta | EquipmentMeta

export type FormDataType
  = | BackgroundInput
    | RaceInput
    | ClassInput
    | EquipmentInput
    | SpellInput
    | FeatInput
    | CharacterInput

export type SourceDataType = Race | Class | Equipment | Feat | Character | Background | Spell

export type FeatureFormDataType = Feature | SubfeatureOption

export type FormType = 'spells' | 'equipment' | 'characters' | 'classes' | 'races' | 'backgrounds' | 'feats'

export type SectionFormDataType
  = | SubfeatureModifier
    | SubfeatureProficiency
    | SubfeatureSense
    | SubfeatureSpell
    | SubfeatureFeat
    | SubfeatureExpertise

export type CharacterSectionData
  = null

export type DeepKeyOf<T> = Extract<Paths<T>, string>

export type Step = {
  id: string
  label: string
  substeps?: [
    {
      id: string
      label: string
    }
  ]
}
