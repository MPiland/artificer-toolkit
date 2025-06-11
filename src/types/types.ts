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
  AncestryFeatureInput,
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
} from '@/types'
import { Paths } from 'type-fest'
import { sectionSteps, FEATURE_TYPES } from '@/components/Form'

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

type GetValue<T, P> =
  P extends `${infer Key}.${infer Rest}`
    ? Key extends keyof T
      ? GetValue<T[Key], Rest>
      : never
    : P extends keyof T
      ? T[P]
      : P extends number
        ? T extends Array<infer U>
          ? U
          : never
        : never;

type UpdateField<T> = <P extends Paths<T>>(arg: { path: P; value: GetValue<T, P> }) => void
type RemoveField<T> = (arg: { path: Paths<T> }) => void
type AddField<T> = <P extends Paths<T>>(arg: { path: P; value?: GetValue<T, P> }) => void

export type OnChange<T> = {
  updateField: UpdateField<T>
  removeField: RemoveField<T>
  addField: AddField<T>
}

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

export type FeatureFormDataType = FeatureInput | AncestryFeatureInput | FeatureOptionInput

export type FormType = 'spells' | 'equipment' | 'characters' | 'classes' | 'races' | 'backgrounds' | 'feats'

export type SectionDataType =
  | FeatureModifierInput
  | FeatureProficiencyInput
  | FeatureSenseInput
  | FeatureSpellInput
  | FeatureFeatInput
  | FeatureExpertiseInput

export type CharacterSectionData =
  | CharacterFeatInput
  | CharacterSenseInput
  | CharacterProficiencyInput
  | CharacterExpertiseInput
  | CharacterModifierInput

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
