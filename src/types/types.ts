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
  FeatureModifierInput,
  FeatureProficiencyInput,
  FeatureSenseInput,
  FeatureSpellInput,
  FeatureFeatInput,
  FeatureExpertiseInput,
  CharacterFeatInput,
  CharacterSenseInput,
  CharacterProficiencyInput,
  CharacterModifierInput,
  FeatureInput,
  CharacterExpertiseInput,
  FeatureOptionInput,
  SpellInput,
  ClassInput,
  EquipmentInput,
  SystemInput,
  RaceInput,
  FeatInput,
  BackgroundInput,
  CharacterInput,
  Race,
  Equipment,
  Feat,
  Character,
  Spell,
  Background,
  Class,
  FeatureModifier,
  FeatureProficiency,
  FeatureSpell,
  FeatureSense,
  FeatureFeat,
  FeatureExpertise,
} from '@/types'
import { Paths } from 'type-fest'

export type SourceTypeMap = {
  spells: SpellInput
  classes: ClassInput
  equipment: EquipmentInput
  system: SystemInput
  races: RaceInput
  feats: FeatInput
  backgrounds: BackgroundInput
}

export type ListItemType =
  | SpellListItem
  | ClassListItem
  | RaceListItem
  | EquipmentListItem
  | FeatListItem
  | BackgroundListItem
  | Character

export type MetaDataType = SpellMeta | ClassMeta | RaceMeta | EquipmentMeta

export type FormDataType =
  | RaceInput
  | ClassInput
  | EquipmentInput
  | CharacterInput
  | SpellInput
  | FeatInput
  | BackgroundInput

export type SourceDataType = Race | Class | Equipment | Feat | Character | Background | Spell

export type FeatureFormDataType = FeatureInput | FeatureOptionInput

export type FormType = 'spells' | 'equipment' | 'characters' | 'classes' | 'races' | 'backgrounds' | 'feats'

export type SectionFormDataType =
  | FeatureModifierInput
  | FeatureProficiencyInput
  | FeatureSenseInput
  | FeatureSpellInput
  | FeatureFeatInput
  | FeatureExpertiseInput

export type SectionSourceDataType =
  | FeatureModifier
  | FeatureProficiency
  | FeatureSense
  | FeatureSpell
  | FeatureFeat
  | FeatureExpertise

export type CharacterSectionData =
  | CharacterFeatInput
  | CharacterSenseInput
  | CharacterProficiencyInput
  | CharacterExpertiseInput
  | CharacterModifierInput

export type DeepKeyOf<T> = Extract<Paths<T>, string>

export type Step = {
  id: string
  label: string
  fieldValidation?: Record<string, boolean>
  defaultValues?: Partial<FormDataType>
}
