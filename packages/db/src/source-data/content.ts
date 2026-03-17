import type {
  BackgroundAuthored,
  ChargeAuthored,
  ClassAuthored,
  DetailAuthored,
  EffectAuthored,
  EquipmentAuthored,
  FeatGrantAuthored,
  FeatAuthored,
  FeatureAuthored,
  ModifierGrantAuthored,
  OptionAuthored,
  ProficiencyGrantAuthored,
  RaceAuthored,
  SavingThrowAuthored,
  SenseGrantAuthored,
  SpellAuthored,
  SpellGrantAuthored,
  StartingEquipmentAuthored
} from '@artificer-toolkit/shared'

/**
 * Baseline source data lives in authored/domain shapes so the repo keeps a
 * stable content language even when the database schema is more normalized.
 */
export interface BaselineSharedContent {
  charges: ChargeAuthored[]
  details: DetailAuthored[]
  savingThrows: SavingThrowAuthored[]
  startingEquipment: StartingEquipmentAuthored[]
}

export interface BaselineEffectsContent {
  effects: EffectAuthored[]
}

export interface BaselineFeaturesContent {
  features: FeatureAuthored[]
  options: OptionAuthored[]
}

export interface BaselineGrantsContent {
  feats: FeatGrantAuthored[]
  modifiers: ModifierGrantAuthored[]
  proficiencies: ProficiencyGrantAuthored[]
  senses: SenseGrantAuthored[]
  spells: SpellGrantAuthored[]
}

export interface BaselineSubjectsContent {
  backgrounds: BackgroundAuthored[]
  classes: ClassAuthored[]
  equipment: EquipmentAuthored[]
  feats: FeatAuthored[]
  races: RaceAuthored[]
  spells: SpellAuthored[]
}

export interface BaselineVocabularyContent {
  systems: SystemSeedRecord[]
}

export interface VocabularySeedRecord {
  id: string
  code: string
  label: string
  description?: string | null
  tooltip?: string | null
  short?: string | null
}

export interface SystemSeedRecord {
  id: string
  label: string
  description?: string | null
  alignments: VocabularySeedRecord[]
  challengeRatings: VocabularySeedRecord[]
  conditionTypes: VocabularySeedRecord[]
  creatureTypes: VocabularySeedRecord[]
  currencies: VocabularySeedRecord[]
  damageTypes: VocabularySeedRecord[]
  languages: VocabularySeedRecord[]
  magicSchools: VocabularySeedRecord[]
  passives: VocabularySeedRecord[]
  rarities: VocabularySeedRecord[]
  senses: VocabularySeedRecord[]
  skills: VocabularySeedRecord[]
  speeds: VocabularySeedRecord[]
  terrains: VocabularySeedRecord[]
  userId: string
}

/**
 * This is the repo-owned seed/import artifact for SRD baseline content.
 * Repositories hydrate rows back into authored shapes, while compilers remain
 * responsible only for authored-to-compiled transformation.
 */
export interface BaselineContentBundle {
  vocabulary: BaselineVocabularyContent
  shared: BaselineSharedContent
  effects: BaselineEffectsContent
  features: BaselineFeaturesContent
  grants: BaselineGrantsContent
  subjects: BaselineSubjectsContent
}

export function defineBaselineContentBundle(
  bundle: BaselineContentBundle
): BaselineContentBundle {
  return bundle
}
