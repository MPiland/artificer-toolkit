import { GQL } from '@/types'
import { Paths } from 'type-fest'

export type ListItemType =
  | GQL.SpellListItem
  | GQL.ClassListItem
  | GQL.RaceListItem
  | GQL.EquipmentListItem
  | GQL.FeatListItem
  | GQL.BackgroundListItem
  | GQL.Character

type UpdateField<T> = (arg: { path: Paths<T>; value: any }) => void
type RemoveField<T> = (arg: { path: Paths<T> }) => void
type AddField<T> = (arg: { path: Paths<T>; value?: any }) => void

export type OnChange<T> = {
  updateField: UpdateField<T>
  removeField: RemoveField<T>
  addField: AddField<T>
}

export type MetaDataType = GQL.SpellMeta | GQL.ClassMeta | GQL.RaceMeta | GQL.EquipmentMeta

export type FormDataType = GQL.Spell | GQL.Race | GQL.Class | GQL.Feat | GQL.Background | GQL.Equipment | GQL.Character

export type FeatureDataType = GQL.Feature | GQL.AncestryFeature | GQL.FeatureOption

export type FormType = 'spells' | 'equipment' | 'characters' | 'classes' | 'races' | 'backgrounds' | 'feats'

export type SectionDataType =
  | GQL.FeatureModifier
  | GQL.FeatureProficiency
  | GQL.FeatureSense
  | GQL.FeatureSpell
  | GQL.FeatureFeat
  | GQL.FeatureExpertise

export type CharacterSectionData =
  | GQL.CharacterFeat
  | GQL.CharacterSense
  | GQL.CharacterProficiency
  | GQL.CharacterExpertise
  | GQL.CharacterModifier

export type DeepKeyOf<T> = Extract<Paths<T>, string>

export type Step = {
  id:
    | 'details'
    | 'GQL.Class'
    | 'gQL.Race'
    | 'abilities'
    | 'traits'
    | 'attributes'
    | 'features'
    | 'contains'
    | 'proficiencies'
    | 'GQL.Equipment'
    | 'startingEquipment'
    | 'ancestry'
    | 'GQL.Background'
  label:
    | 'Details'
    | 'GQL.Class'
    | 'GQL.Race'
    | 'Abilities'
    | 'Traits'
    | 'Attributes'
    | 'Features'
    | 'FeaturesContent'
    | 'Contains'
    | 'Proficiencies'
    | 'GQL.Equipment'
    | 'Starting GQL.Equipment'
    | 'Ancestry'
    | 'GQL.Background'
}

export const sectionSteps = ['modifiers', 'spells', 'proficiencies', 'expertise', 'senses', 'feats'] as const

export type SectionName = (typeof sectionSteps)[number]
export const featureTypes = ['feature', 'option', 'ancestry', 'ancestryOption'] as const

export type FeatureTypes = (typeof featureTypes)[number]
