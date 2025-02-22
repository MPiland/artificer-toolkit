export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AbilityGenerateMethod = {
  __typename: 'AbilityGenerateMethod';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  options?: Maybe<Array<Maybe<GenerateOption>>>;
  total?: Maybe<Scalars['Int']['output']>;
  value: Scalars['String']['output'];
};

export type AbilityGenerateMethodInput = {
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  options?: InputMaybe<Array<InputMaybe<GenerateOptionInput>>>;
  total?: InputMaybe<Scalars['Int']['input']>;
  value: Scalars['String']['input'];
};

export type AbilityScore = {
  __typename: 'AbilityScore';
  abilities?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  score?: Maybe<Scalars['Int']['output']>;
};

export type AbilityScoreInput = {
  abilities?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  score?: InputMaybe<Scalars['Int']['input']>;
};

export type ActionGroup = {
  __typename: 'ActionGroup';
  primary?: Maybe<ActionProperty>;
  secondary?: Maybe<ActionProperty>;
};

export type ActionGroupInput = {
  primary?: InputMaybe<ActionPropertyInput>;
  secondary?: InputMaybe<ActionPropertyInput>;
};

export type ActionProperty = {
  __typename: 'ActionProperty';
  amount?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
};

export type ActionPropertyInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
};

export enum AllEnum {
  all = 'all'
}

export enum AllEnumInput {
  all = 'all'
}

export type Ancestry = {
  __typename: 'Ancestry';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  options?: Maybe<Array<AncestryOption>>;
  value: Scalars['String']['output'];
};

export type AncestryFeature = {
  __typename: 'AncestryFeature';
  actions?: Maybe<ActionGroup>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<Maybe<FeatureExpertise>>>;
  feats?: Maybe<Array<Maybe<FeatureFeat>>>;
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  levelAvailable?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<Maybe<FeatureModifier>>>;
  options?: Maybe<Array<Maybe<FeatureOption>>>;
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<Maybe<FeatureProficiency>>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  senses?: Maybe<Array<Maybe<FeatureSense>>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<Maybe<FeatureSpell>>>;
  subfeatures?: Maybe<Array<Maybe<FeatureSubfeature>>>;
  targets?: Maybe<Scalars['Int']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type AncestryFeatureInput = {
  actions?: InputMaybe<ActionGroupInput>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<InputMaybe<FeatureExpertiseInput>>>;
  feats?: InputMaybe<Array<InputMaybe<FeatureFeatInput>>>;
  id: Scalars['ID']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<InputMaybe<FeatureModifierInput>>>;
  options?: InputMaybe<Array<InputMaybe<FeatureOptionInput>>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<InputMaybe<FeatureProficiencyInput>>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  senses?: InputMaybe<Array<InputMaybe<FeatureSenseInput>>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<InputMaybe<FeatureSpellInput>>>;
  subfeatures?: InputMaybe<Array<InputMaybe<FeatureSubfeatureInput>>>;
  targets?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type AncestryInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  options?: InputMaybe<Array<AncestryOptionInput>>;
  value: Scalars['String']['input'];
};

export type AncestryOption = {
  __typename: 'AncestryOption';
  desc?: Maybe<Scalars['String']['output']>;
  features?: Maybe<Array<Maybe<AncestryFeature>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type AncestryOptionInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  features?: InputMaybe<Array<InputMaybe<AncestryFeatureInput>>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type Background = {
  __typename: 'Background';
  currency?: Maybe<BackgroundCurrency>;
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Detail>>;
  equipment?: Maybe<Array<Maybe<EquipmentGroup>>>;
  features?: Maybe<Array<Maybe<Feature>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  proficiencies?: Maybe<Array<Maybe<FeatureProficiency>>>;
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type BackgroundConnection = {
  __typename: 'BackgroundConnection';
  items?: Maybe<Array<Background>>;
  message?: Maybe<Scalars['String']['output']>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type BackgroundCurrency = {
  __typename: 'BackgroundCurrency';
  copper?: Maybe<Scalars['Int']['output']>;
  electrum?: Maybe<Scalars['Int']['output']>;
  gold?: Maybe<Scalars['Int']['output']>;
  platinum?: Maybe<Scalars['Int']['output']>;
  silver?: Maybe<Scalars['Int']['output']>;
};

export type BackgroundCurrencyInput = {
  copper?: InputMaybe<Scalars['Int']['input']>;
  electrum?: InputMaybe<Scalars['Int']['input']>;
  gold?: InputMaybe<Scalars['Int']['input']>;
  platinum?: InputMaybe<Scalars['Int']['input']>;
  silver?: InputMaybe<Scalars['Int']['input']>;
};

export type BackgroundInput = {
  currency?: InputMaybe<BackgroundCurrencyInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<Array<DetailInput>>;
  equipment?: InputMaybe<Array<InputMaybe<EquipmentGroupInput>>>;
  features?: InputMaybe<Array<InputMaybe<FeatureInput>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  label: Scalars['String']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  proficiencies?: InputMaybe<Array<InputMaybe<FeatureProficiencyInput>>>;
  systemId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type BatchBackgroundsInput = {
  data: BackgroundInput;
  tableName: Scalars['String']['input'];
};

export type BatchClassesInput = {
  data: ClassInput;
  tableName: Scalars['String']['input'];
};

export type BatchEquipmentInput = {
  data: EquipmentInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatInput = {
  data: FeatInput;
  tableName: Scalars['String']['input'];
};

export type BatchRacesInput = {
  data: RaceInput;
  tableName: Scalars['String']['input'];
};

export type BatchSpellsInput = {
  data: SpellInput;
  tableName: Scalars['String']['input'];
};

export type BatchSystemsInput = {
  data: SystemInput;
  tableName: Scalars['String']['input'];
};

export type Capacity = {
  __typename: 'Capacity';
  amount?: Maybe<Scalars['Float']['output']>;
  unit: Scalars['ID']['output'];
};

export type CapacityInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  unit: Scalars['ID']['input'];
};

export type Character = {
  __typename: 'Character';
  abilities?: Maybe<CharacterAbilities>;
  advancement?: Maybe<Scalars['ID']['output']>;
  ancestry?: Maybe<CharacterAncestry>;
  classes?: Maybe<Array<Maybe<CharacterClass>>>;
  desc?: Maybe<Scalars['String']['output']>;
  equipment?: Maybe<Array<Maybe<Contains>>>;
  expertise?: Maybe<Array<Maybe<CharacterExpertise>>>;
  feats?: Maybe<Array<Maybe<CharacterFeat>>>;
  features?: Maybe<Array<Maybe<CharacterFeature>>>;
  hitpoint?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<Maybe<CharacterModifier>>>;
  ownerId: Scalars['String']['output'];
  proficiencies?: Maybe<Array<Maybe<CharacterProficiency>>>;
  race?: Maybe<Scalars['ID']['output']>;
  senses?: Maybe<Array<Maybe<CharacterSense>>>;
  spellcasting?: Maybe<CharacterSpellcasting>;
  startingEquipment?: Maybe<CharacterStartingEquipment>;
  systemId: Scalars['String']['output'];
  value?: Maybe<Scalars['String']['output']>;
};

export type CharacterAbilities = {
  __typename: 'CharacterAbilities';
  manualRolled?: Maybe<ManualRolled>;
  pointBuy?: Maybe<PointBuy>;
  scores?: Maybe<Array<Maybe<Scores>>>;
  selectedSystem?: Maybe<Scalars['ID']['output']>;
  standardArray?: Maybe<Array<Maybe<StandardArray>>>;
};

export type CharacterAbilitiesInput = {
  manualRolled?: InputMaybe<ManualRolledInput>;
  pointBuy?: InputMaybe<PointBuyInput>;
  scores?: InputMaybe<Array<InputMaybe<ScoresInput>>>;
  selectedSystem?: InputMaybe<Scalars['ID']['input']>;
  standardArray?: InputMaybe<Array<InputMaybe<StandardArrayInput>>>;
};

export type CharacterAncestry = {
  __typename: 'CharacterAncestry';
  id?: Maybe<Scalars['ID']['output']>;
  lineages?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterAncestryInput = {
  id?: InputMaybe<Scalars['ID']['input']>;
  lineage?: InputMaybe<Array<InputMaybe<LineageInput>>>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterClass = {
  __typename: 'CharacterClass';
  id?: Maybe<Scalars['ID']['output']>;
  level?: Maybe<Scalars['Int']['output']>;
  subclass?: Maybe<Subclass>;
};

export type CharacterClassInput = {
  id?: InputMaybe<Scalars['ID']['input']>;
  level?: InputMaybe<Scalars['Int']['input']>;
  subclass?: InputMaybe<SubclassInput>;
};

export type CharacterConnection = {
  __typename: 'CharacterConnection';
  items?: Maybe<Array<Character>>;
  message?: Maybe<Scalars['String']['output']>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type CharacterExpertise = {
  __typename: 'CharacterExpertise';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  expertiseId: Scalars['ID']['output'];
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureOptionId?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterExpertiseInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  expertiseId: Scalars['ID']['input'];
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureOptionId?: InputMaybe<Scalars['ID']['input']>;
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterFeat = {
  __typename: 'CharacterFeat';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureOptionId?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterFeatInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureOptionId?: InputMaybe<Scalars['ID']['input']>;
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterFeature = {
  __typename: 'CharacterFeature';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  level?: Maybe<Scalars['Int']['output']>;
  option?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterFeatureInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  level?: InputMaybe<Scalars['Int']['input']>;
  option?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterInput = {
  abilities?: InputMaybe<CharacterAbilitiesInput>;
  advancement?: InputMaybe<Scalars['ID']['input']>;
  ancestry?: InputMaybe<CharacterAncestryInput>;
  classes?: InputMaybe<Array<InputMaybe<CharacterClassInput>>>;
  desc?: InputMaybe<Scalars['String']['input']>;
  equipment?: InputMaybe<Array<InputMaybe<ContainsInput>>>;
  expertise?: InputMaybe<CharacterExpertiseInput>;
  feats?: InputMaybe<Array<InputMaybe<CharacterFeatInput>>>;
  features?: InputMaybe<Array<InputMaybe<CharacterFeatureInput>>>;
  hitpoint?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<CharacterModifierInput>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  proficiencies?: InputMaybe<CharacterProficiencyInput>;
  race?: InputMaybe<Scalars['ID']['input']>;
  senses?: InputMaybe<Array<InputMaybe<CharacterSenseInput>>>;
  spellcasting?: InputMaybe<CharacterSpellcastingInput>;
  startingEquipment?: InputMaybe<CharacterStartingEquipmentInput>;
  systemId: Scalars['String']['input'];
  value?: InputMaybe<Scalars['String']['input']>;
};

export type CharacterModifier = {
  __typename: 'CharacterModifier';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureOptionId?: Maybe<Scalars['ID']['output']>;
  modifierId: Scalars['ID']['output'];
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterModifierInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureOptionId?: InputMaybe<Scalars['ID']['input']>;
  modifierId: Scalars['ID']['input'];
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterProficiency = {
  __typename: 'CharacterProficiency';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureOptionId?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  proficiencyId: Scalars['ID']['output'];
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterProficiencyInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureOptionId?: InputMaybe<Scalars['ID']['input']>;
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  proficiencyId: Scalars['ID']['input'];
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterSense = {
  __typename: 'CharacterSense';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureOptionId?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  senseId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterSenseInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureOptionId?: InputMaybe<Scalars['ID']['input']>;
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
  senseId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterSetting = {
  __typename: 'CharacterSetting';
  advancementMethods?: Maybe<Array<Maybe<GenericType>>>;
  hitpointCalcMethods?: Maybe<Array<Maybe<GenericType>>>;
  spellPointCalcMethods?: Maybe<Array<Maybe<GenericType>>>;
  startingEquipmentOptions?: Maybe<Array<Maybe<GenericType>>>;
};

export type CharacterSettingInput = {
  advancementMethods?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  hitpointCalcMethods?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  spellPointCalcMethods?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  startingEquipmentOptions?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
};

export type CharacterSpell = {
  __typename: 'CharacterSpell';
  ability?: Maybe<Scalars['ID']['output']>;
  alwaysPrepared?: Maybe<Scalars['Boolean']['output']>;
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  castAtLevel?: Maybe<Scalars['Boolean']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  countAsKnown?: Maybe<Scalars['Boolean']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureOptionId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  isRitual?: Maybe<Scalars['Boolean']['output']>;
  level: Scalars['Int']['output'];
  optionIndex?: Maybe<Scalars['String']['output']>;
  optionalAbility?: Maybe<Scalars['Boolean']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  requiresConcentration?: Maybe<Scalars['Boolean']['output']>;
  usesSlot?: Maybe<Scalars['Boolean']['output']>;
};

export type CharacterSpellInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  alwaysPrepared?: InputMaybe<Scalars['Boolean']['input']>;
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  castAtLevel?: InputMaybe<Scalars['Boolean']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  countAsKnown?: InputMaybe<Scalars['Boolean']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureOptionId?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  isRitual?: InputMaybe<Scalars['Boolean']['input']>;
  level: Scalars['Int']['input'];
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  optionalAbility?: InputMaybe<Scalars['Boolean']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
  requiresConcentration?: InputMaybe<Scalars['Boolean']['input']>;
  usesSlot?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CharacterSpellSlots = {
  __typename: 'CharacterSpellSlots';
  classId: Scalars['ID']['output'];
  level: Scalars['Int']['output'];
  used: Scalars['Int']['output'];
};

export type CharacterSpellSlotsInputs = {
  classId: Scalars['ID']['input'];
  level: Scalars['Int']['input'];
  used: Scalars['Int']['input'];
};

export type CharacterSpellcasting = {
  __typename: 'CharacterSpellcasting';
  additional?: Maybe<Array<Maybe<CharacterSpell>>>;
  known?: Maybe<Array<Maybe<ClassSpellList>>>;
  prepared?: Maybe<Array<Maybe<ClassSpellList>>>;
  spellSlots?: Maybe<Array<Maybe<CharacterSpellSlots>>>;
};

export type CharacterSpellcastingInput = {
  additional?: InputMaybe<Array<InputMaybe<CharacterSpellInput>>>;
  known?: InputMaybe<Array<InputMaybe<ClassSpellListInput>>>;
  prepared?: InputMaybe<Array<InputMaybe<ClassSpellListInput>>>;
  spellSlots?: InputMaybe<Array<InputMaybe<CharacterSpellSlotsInputs>>>;
};

export type CharacterStartingEquipment = {
  __typename: 'CharacterStartingEquipment';
  option: Scalars['ID']['output'];
  remainingGold?: Maybe<Scalars['Int']['output']>;
  totalGold?: Maybe<Scalars['Int']['output']>;
};

export type CharacterStartingEquipmentInput = {
  option: Scalars['ID']['input'];
  remainingGold?: InputMaybe<Scalars['Int']['input']>;
  totalGold?: InputMaybe<Scalars['Int']['input']>;
};

export type Charge = {
  __typename: 'Charge';
  ability?: Maybe<Scalars['ID']['output']>;
  addAmount?: Maybe<Scalars['Int']['output']>;
  limit?: Maybe<Scalars['ID']['output']>;
  minAmount?: Maybe<Scalars['Int']['output']>;
  multiplier?: Maybe<Scalars['Int']['output']>;
  reset?: Maybe<Scalars['ID']['output']>;
  resourcePoints?: Maybe<Scalars['Int']['output']>;
  setAmount?: Maybe<Scalars['Int']['output']>;
  skill?: Maybe<Scalars['ID']['output']>;
  usesPerLevel?: Maybe<Array<Maybe<UsesPerLevel>>>;
};

export type ChargeInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  addAmount?: InputMaybe<Scalars['Int']['input']>;
  limit?: InputMaybe<Scalars['ID']['input']>;
  minAmount?: InputMaybe<Scalars['Int']['input']>;
  multiplier?: InputMaybe<Scalars['Int']['input']>;
  reset?: InputMaybe<Scalars['ID']['input']>;
  resourcePoints?: InputMaybe<Scalars['Int']['input']>;
  setAmount?: InputMaybe<Scalars['Int']['input']>;
  skill?: InputMaybe<Scalars['ID']['input']>;
  usesPerLevel?: InputMaybe<Array<InputMaybe<UsesPerLevelInput>>>;
};

export type ChargeOption = {
  __typename: 'ChargeOption';
  classes?: Maybe<Array<Maybe<ClassesEnum>>>;
  damage?: Maybe<Array<Maybe<DamageEnum>>>;
  equipment?: Maybe<Array<Maybe<EquipmentEnum>>>;
  feats?: Maybe<Array<Maybe<AllEnum>>>;
  features?: Maybe<Array<Maybe<FeatureEnum>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  sections?: Maybe<Array<Maybe<SectionEnum>>>;
  spells?: Maybe<Array<Maybe<SpellEnum>>>;
  value: Scalars['String']['output'];
};

export type ChargeOptionInput = {
  classes?: InputMaybe<Array<InputMaybe<ClassesEnumInput>>>;
  damage?: InputMaybe<Array<InputMaybe<DamageEnumInput>>>;
  equipment?: InputMaybe<Array<InputMaybe<EquipmentEnumInput>>>;
  feats?: InputMaybe<Array<InputMaybe<AllEnumInput>>>;
  features?: InputMaybe<Array<InputMaybe<FeatureEnumInput>>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<InputMaybe<SectionEnumInput>>>;
  spells?: InputMaybe<Array<InputMaybe<SpellEnumInput>>>;
  value: Scalars['String']['input'];
};

export type Class = {
  __typename: 'Class';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category: Scalars['ID']['output'];
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Maybe<Detail>>>;
  equipment?: Maybe<Array<Maybe<Array<Maybe<Array<Maybe<EquipmentGroup>>>>>>>;
  features?: Maybe<Array<Maybe<Feature>>>;
  hitpoint?: Maybe<Hitpoint>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAttributes?: Maybe<Array<Maybe<LevelAttribute>>>;
  masterId?: Maybe<Scalars['String']['output']>;
  multiclass?: Maybe<Multiclass>;
  ownerId: Scalars['ID']['output'];
  parentClass?: Maybe<Scalars['ID']['output']>;
  proficiencies?: Maybe<Array<Maybe<FeatureProficiency>>>;
  resource?: Maybe<Resource>;
  spellcasting?: Maybe<Spellcasting>;
  startingGold?: Maybe<StartingGold>;
  subtypes?: Maybe<Array<Maybe<Subtype>>>;
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type ClassConnection = {
  __typename: 'ClassConnection';
  items?: Maybe<Array<Class>>;
  message?: Maybe<Scalars['String']['output']>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type ClassInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category: Scalars['ID']['input'];
  desc?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<Array<InputMaybe<DetailInput>>>;
  equipment?: InputMaybe<Array<InputMaybe<Array<InputMaybe<Array<InputMaybe<EquipmentGroupInput>>>>>>>;
  features?: InputMaybe<Array<InputMaybe<FeatureInput>>>;
  hitpoint?: InputMaybe<HitpointInput>;
  id?: InputMaybe<Scalars['ID']['input']>;
  label: Scalars['String']['input'];
  levelAttributes?: InputMaybe<Array<InputMaybe<LevelAttributeInput>>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  multiclass?: InputMaybe<MulticlassInput>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  parentClass?: InputMaybe<Scalars['ID']['input']>;
  proficiencies?: InputMaybe<Array<InputMaybe<FeatureProficiencyInput>>>;
  resource?: InputMaybe<ResourceInput>;
  spellcasting?: InputMaybe<SpellcastingInput>;
  startingGold?: InputMaybe<StartingGoldInput>;
  subtypes?: InputMaybe<Array<InputMaybe<SubtypeInput>>>;
  systemId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type ClassSpell = {
  __typename: 'ClassSpell';
  ability?: Maybe<Scalars['ID']['output']>;
  alwaysPrepared?: Maybe<Scalars['Boolean']['output']>;
  castAtLevel?: Maybe<Scalars['Boolean']['output']>;
  classId: Scalars['ID']['output'];
  countAsKnown?: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  isRitual?: Maybe<Scalars['Boolean']['output']>;
  optionalAbility?: Maybe<Scalars['Boolean']['output']>;
  requiresConcentration?: Maybe<Scalars['Boolean']['output']>;
  usesSlot?: Maybe<Scalars['Boolean']['output']>;
};

export type ClassSpellInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  alwaysPrepared?: InputMaybe<Scalars['Boolean']['input']>;
  castAtLevel?: InputMaybe<Scalars['Boolean']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  countAsKnown?: InputMaybe<Scalars['Boolean']['input']>;
  id: Scalars['ID']['input'];
  isRitual?: InputMaybe<Scalars['Boolean']['input']>;
  optionalAbility?: InputMaybe<Scalars['Boolean']['input']>;
  requiresConcentration?: InputMaybe<Scalars['Boolean']['input']>;
  usesSlot?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ClassSpellList = {
  __typename: 'ClassSpellList';
  level: Scalars['Int']['output'];
  spells?: Maybe<Array<Maybe<ClassSpell>>>;
};

export type ClassSpellListInput = {
  level: Scalars['Int']['input'];
  spells?: InputMaybe<Array<InputMaybe<ClassSpellInput>>>;
};

export enum ClassesEnum {
  all = 'all',
  base = 'base',
  prepareLimit = 'prepareLimit',
  resources = 'resources',
  spellcaster = 'spellcaster',
  subclass = 'subclass'
}

export enum ClassesEnumInput {
  all = 'all',
  base = 'base',
  prepareLimit = 'prepareLimit',
  resources = 'resources',
  spellcaster = 'spellcaster',
  subclass = 'subclass'
}

export type Contains = {
  __typename: 'Contains';
  contains?: Maybe<Array<Maybe<Contains>>>;
  currencies?: Maybe<Array<Maybe<Currency>>>;
  equipment: Scalars['ID']['output'];
  quantity: Scalars['Int']['output'];
};

export type ContainsInput = {
  contains?: InputMaybe<Array<InputMaybe<ContainsInput>>>;
  currencies?: InputMaybe<Array<InputMaybe<CurrencyInput>>>;
  equipment: Scalars['ID']['input'];
  quantity: Scalars['Int']['input'];
};

export type Cost = {
  __typename: 'Cost';
  amount?: Maybe<Scalars['Int']['output']>;
  currency: Scalars['ID']['output'];
};

export type CostInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  currency: Scalars['ID']['input'];
};

export type Currency = {
  __typename: 'Currency';
  conversions?: Maybe<CurrencyConversion>;
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type CurrencyConversion = {
  __typename: 'CurrencyConversion';
  copper: Scalars['Float']['output'];
  electrum: Scalars['Float']['output'];
  gold: Scalars['Float']['output'];
  platinum: Scalars['Float']['output'];
  silver: Scalars['Float']['output'];
};

export type CurrencyConversionInput = {
  copper: Scalars['Float']['input'];
  electrum: Scalars['Float']['input'];
  gold: Scalars['Float']['input'];
  platinum: Scalars['Float']['input'];
  silver: Scalars['Float']['input'];
};

export type CurrencyInput = {
  conversions?: InputMaybe<CurrencyConversionInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type Damage = {
  __typename: 'Damage';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  bonus?: Maybe<DamageFields>;
  damageSave?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  diePerLevel?: Maybe<Array<Maybe<DiePerLevel>>>;
  primary?: Maybe<DamageFields>;
  secondary?: Maybe<DamageFields>;
  setPerLevel?: Maybe<Array<Maybe<SetPerLevel>>>;
  versatile?: Maybe<DamageFields>;
};

export enum DamageEnum {
  all = 'all',
  bonus = 'bonus',
  equipment = 'equipment',
  main = 'main',
  pool = 'pool'
}

export enum DamageEnumInput {
  all = 'all',
  bonus = 'bonus',
  equipment = 'equipment',
  main = 'main',
  pool = 'pool'
}

export type DamageFields = {
  __typename: 'DamageFields';
  ability?: Maybe<Scalars['ID']['output']>;
  attribute?: Maybe<Scalars['ID']['output']>;
  dieConfig?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  maxAmount?: Maybe<Scalars['Int']['output']>;
  minAmount?: Maybe<Scalars['Int']['output']>;
  multiplier?: Maybe<Scalars['Int']['output']>;
  pool?: Maybe<DamagePool>;
  setAmount?: Maybe<Scalars['Int']['output']>;
};

export type DamageFieldsInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  attribute?: InputMaybe<Scalars['ID']['input']>;
  dieConfig?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  maxAmount?: InputMaybe<Scalars['Int']['input']>;
  minAmount?: InputMaybe<Scalars['Int']['input']>;
  multiplier?: InputMaybe<Scalars['Int']['input']>;
  pool?: InputMaybe<DamagePoolInput>;
  setAmount?: InputMaybe<Scalars['Int']['input']>;
};

export type DamageInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  bonus?: InputMaybe<DamageFieldsInput>;
  damageSave?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  diePerLevel?: InputMaybe<Array<InputMaybe<DiePerLevelInput>>>;
  primary?: InputMaybe<DamageFieldsInput>;
  secondary?: InputMaybe<DamageFieldsInput>;
  setPerLevel?: InputMaybe<Array<InputMaybe<SetPerLevelInput>>>;
  versatile?: InputMaybe<DamageFieldsInput>;
};

export type DamagePool = {
  __typename: 'DamagePool';
  ability?: Maybe<Scalars['ID']['output']>;
  attribute?: Maybe<Scalars['ID']['output']>;
  maxAmount?: Maybe<Scalars['Int']['output']>;
  minAmount?: Maybe<Scalars['Int']['output']>;
  multiplier?: Maybe<Scalars['Int']['output']>;
  option?: Maybe<Scalars['ID']['output']>;
  setAmount?: Maybe<Scalars['Int']['output']>;
};

export type DamagePoolInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  attribute?: InputMaybe<Scalars['ID']['input']>;
  maxAmount?: InputMaybe<Scalars['Int']['input']>;
  minAmount?: InputMaybe<Scalars['Int']['input']>;
  multiplier?: InputMaybe<Scalars['Int']['input']>;
  option?: InputMaybe<Scalars['ID']['input']>;
  setAmount?: InputMaybe<Scalars['Int']['input']>;
};

export type Detail = {
  __typename: 'Detail';
  desc?: Maybe<Scalars['String']['output']>;
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type DetailInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  label: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type DiePerLevel = {
  __typename: 'DiePerLevel';
  bonus?: Maybe<DamageFields>;
  level?: Maybe<Scalars['String']['output']>;
  primary?: Maybe<DamageFields>;
  secondary?: Maybe<DamageFields>;
};

export type DiePerLevelInput = {
  bonus?: InputMaybe<DamageFieldsInput>;
  level?: InputMaybe<Scalars['String']['input']>;
  primary?: InputMaybe<DamageFieldsInput>;
  secondary?: InputMaybe<DamageFieldsInput>;
};

export type Distributed = {
  __typename: 'Distributed';
  ability?: Maybe<Scalars['ID']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
};

export type DistributedInput = {
  ability: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
};

export type Duration = {
  __typename: 'Duration';
  amount?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
};

export type DurationInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};

export type EquipPrerequisite = {
  __typename: 'EquipPrerequisite';
  category?: Maybe<Scalars['ID']['output']>;
  equipment?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  numberEquipped?: Maybe<Scalars['Int']['output']>;
  properties?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
};

export type EquipPrerequisiteInput = {
  category?: InputMaybe<Scalars['ID']['input']>;
  equipment?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  numberEquipped?: InputMaybe<Scalars['Int']['input']>;
  properties?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type Equipment = {
  __typename: 'Equipment';
  armorClass?: Maybe<Scalars['Int']['output']>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  capacity?: Maybe<Capacity>;
  category: Scalars['ID']['output'];
  contains?: Maybe<Array<Maybe<Contains>>>;
  cost?: Maybe<Cost>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  equipmentRank?: Maybe<Scalars['Int']['output']>;
  features?: Maybe<Array<Maybe<Feature>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  maxBonus?: Maybe<Scalars['Int']['output']>;
  maxStack?: Maybe<Scalars['Int']['output']>;
  optionalAbility?: Maybe<Scalars['ID']['output']>;
  ownerId: Scalars['ID']['output'];
  prerequisities?: Maybe<Prerequisite>;
  primaryAbility?: Maybe<Scalars['ID']['output']>;
  properties?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  quantity?: Maybe<Scalars['Int']['output']>;
  quote?: Maybe<Scalars['String']['output']>;
  range?: Maybe<EquipmentRange>;
  rank?: Maybe<Scalars['Int']['output']>;
  rarity?: Maybe<Scalars['ID']['output']>;
  saveAbility?: Maybe<SaveAbility>;
  secondaryAbility?: Maybe<Scalars['ID']['output']>;
  speed?: Maybe<Speed>;
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
  weight?: Maybe<Weight>;
};

export type EquipmentCategoryProperty = {
  __typename: 'EquipmentCategoryProperty';
  categoryId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  propertyId: Scalars['ID']['output'];
};

export type EquipmentCategoryPropertyInput = {
  categoryId: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
  propertyId: Scalars['ID']['input'];
};

export type EquipmentConnection = {
  __typename: 'EquipmentConnection';
  items?: Maybe<Array<Equipment>>;
  message?: Maybe<Scalars['String']['output']>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export enum EquipmentEnum {
  adventuringGear = 'adventuringGear',
  all = 'all',
  armors = 'armors',
  classes = 'classes',
  shields = 'shields',
  tools = 'tools',
  weapons = 'weapons'
}

export enum EquipmentEnumInput {
  adventuringGear = 'adventuringGear',
  all = 'all',
  armors = 'armors',
  classes = 'classes',
  shields = 'shields',
  tools = 'tools',
  weapons = 'weapons'
}

export type EquipmentGroup = {
  __typename: 'EquipmentGroup';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category?: Maybe<Scalars['ID']['output']>;
  copper?: Maybe<Scalars['Int']['output']>;
  electrum?: Maybe<Scalars['Int']['output']>;
  equipment?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  gold?: Maybe<Scalars['Int']['output']>;
  platinum?: Maybe<Scalars['Int']['output']>;
  properties?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  quantity?: Maybe<Scalars['Int']['output']>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  silver?: Maybe<Scalars['Int']['output']>;
};

export type EquipmentGroupInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  copper?: InputMaybe<Scalars['Int']['input']>;
  electrum?: InputMaybe<Scalars['Int']['input']>;
  equipment?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  gold?: InputMaybe<Scalars['Int']['input']>;
  platinum?: InputMaybe<Scalars['Int']['input']>;
  properties?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  silver?: InputMaybe<Scalars['Int']['input']>;
};

export type EquipmentInput = {
  Rank?: InputMaybe<Scalars['Int']['input']>;
  armorClass?: InputMaybe<Scalars['Int']['input']>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  capacity?: InputMaybe<CapacityInput>;
  category: Scalars['ID']['input'];
  contains?: InputMaybe<Array<InputMaybe<ContainsInput>>>;
  cost?: InputMaybe<CostInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  equipmentRank?: InputMaybe<Scalars['Int']['input']>;
  features?: InputMaybe<Array<InputMaybe<FeatureInput>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  label: Scalars['String']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  maxBonus?: InputMaybe<Scalars['Int']['input']>;
  maxStack?: InputMaybe<Scalars['Int']['input']>;
  optionalAbility?: InputMaybe<Scalars['ID']['input']>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  prerequisities?: InputMaybe<PrerequisiteInput>;
  primaryAbility?: InputMaybe<Scalars['ID']['input']>;
  properties?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  quote?: InputMaybe<Scalars['String']['input']>;
  range?: InputMaybe<EquipmentRangeInput>;
  rarity?: InputMaybe<Scalars['ID']['input']>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  secondaryAbility?: InputMaybe<Scalars['ID']['input']>;
  speed?: InputMaybe<SpeedInput>;
  systemId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
  weight?: InputMaybe<WeightInput>;
};

export type EquipmentRange = {
  __typename: 'EquipmentRange';
  maxRange?: Maybe<Scalars['Int']['output']>;
  minRange?: Maybe<Scalars['Int']['output']>;
  unit: Scalars['ID']['output'];
};

export type EquipmentRangeInput = {
  maxRange?: InputMaybe<Scalars['Int']['input']>;
  minRange?: InputMaybe<Scalars['Int']['input']>;
  unit: Scalars['ID']['input'];
};

export type Feat = {
  __typename: 'Feat';
  actions?: Maybe<ActionGroup>;
  ancestry?: Maybe<Array<Maybe<FeatureAncestry>>>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  bonusDamage?: Maybe<Damage>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<Maybe<FeatureProficiency>>>;
  feats?: Maybe<Array<Maybe<FeatureFeat>>>;
  features?: Maybe<Array<Maybe<Feature>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAvailable?: Maybe<Scalars['String']['output']>;
  masterId?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<Maybe<FeatureModifier>>>;
  options?: Maybe<Array<Maybe<FeatureOption>>>;
  ownerId: Scalars['String']['output'];
  prerequisites?: Maybe<Prerequisite>;
  primaryDamage?: Maybe<Damage>;
  proficiencies?: Maybe<Array<Maybe<FeatureProficiency>>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  secondaryDamage?: Maybe<Damage>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  senses?: Maybe<Array<Maybe<FeatureSense>>>;
  shape?: Maybe<Shape>;
  spellcasting?: Maybe<Array<Maybe<FeatureSpell>>>;
  spells?: Maybe<Array<Maybe<FeatureSpell>>>;
  systemId: Scalars['ID']['output'];
  targets?: Maybe<Scalars['Int']['output']>;
  value: Scalars['String']['output'];
};

export type FeatConnection = {
  __typename: 'FeatConnection';
  items?: Maybe<Array<Feat>>;
  message?: Maybe<Scalars['String']['output']>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatInput = {
  actions?: InputMaybe<ActionGroupInput>;
  ancestry?: InputMaybe<Array<InputMaybe<FeatureAncestryInput>>>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  bonusDamage?: InputMaybe<DamageInput>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<InputMaybe<FeatureProficiencyInput>>>;
  feats?: InputMaybe<Array<InputMaybe<FeatureFeatInput>>>;
  features?: InputMaybe<Array<InputMaybe<FeatureInput>>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<InputMaybe<FeatureModifierInput>>>;
  options?: InputMaybe<Array<InputMaybe<FeatureOptionInput>>>;
  ownerId: Scalars['String']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  primaryDamage?: InputMaybe<DamageInput>;
  proficiencies?: InputMaybe<Array<InputMaybe<FeatureProficiencyInput>>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  secondaryDamage?: InputMaybe<DamageInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  senses?: InputMaybe<Array<InputMaybe<FeatureSenseInput>>>;
  shape?: InputMaybe<ShapeInput>;
  spellcasting?: InputMaybe<Array<InputMaybe<FeatureSpellInput>>>;
  spells?: InputMaybe<Array<InputMaybe<FeatureSpellInput>>>;
  systemId: Scalars['ID']['input'];
  targets?: InputMaybe<Scalars['Int']['input']>;
  value: Scalars['String']['input'];
};

export type Feature = {
  __typename: 'Feature';
  actions?: Maybe<ActionGroup>;
  ancestries?: Maybe<Array<Maybe<FeatureAncestry>>>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<Maybe<FeatureExpertise>>>;
  feats?: Maybe<Array<Maybe<FeatureFeat>>>;
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  levelAvailable?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<Maybe<FeatureModifier>>>;
  options?: Maybe<Array<Maybe<FeatureOption>>>;
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<Maybe<FeatureProficiency>>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  senses?: Maybe<Array<Maybe<FeatureSense>>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<Maybe<FeatureSpell>>>;
  subfeatures?: Maybe<Array<Maybe<FeatureSubfeature>>>;
  targets?: Maybe<Scalars['Int']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type FeatureAncestry = {
  __typename: 'FeatureAncestry';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  id: Scalars['ID']['output'];
  options?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  origin?: Maybe<Scalars['ID']['output']>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureAncestryInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  id: Scalars['ID']['input'];
  options?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  origin?: InputMaybe<Scalars['ID']['input']>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export enum FeatureEnum {
  all = 'all',
  equipment = 'equipment',
  options = 'options',
  saveAbilities = 'saveAbilities'
}

export enum FeatureEnumInput {
  all = 'all',
  equipment = 'equipment',
  options = 'options',
  saveAbilities = 'saveAbilities'
}

export type FeatureExpertise = {
  __typename: 'FeatureExpertise';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category: Scalars['ID']['output'];
  equipment?: Maybe<ProficiencyProperties>;
  id: Scalars['ID']['output'];
  languages?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  prerequisites?: Maybe<Prerequisite>;
  properties?: Maybe<ProficiencyProperties>;
  saveAbilities?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  skills?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureExpertiseInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category: Scalars['ID']['input'];
  equipment?: InputMaybe<ProficiencyPropertiesInput>;
  id: Scalars['ID']['input'];
  languages?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  properties?: InputMaybe<ProficiencyPropertiesInput>;
  saveAbilities?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureFeat = {
  __typename: 'FeatureFeat';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  feats?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  id: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureFeatInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  feats?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  id: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureInput = {
  actions?: InputMaybe<ActionGroupInput>;
  ancestry?: InputMaybe<Array<InputMaybe<FeatureAncestryInput>>>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<InputMaybe<FeatureExpertiseInput>>>;
  feats?: InputMaybe<Array<InputMaybe<FeatureFeatInput>>>;
  id: Scalars['ID']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<InputMaybe<FeatureModifierInput>>>;
  options?: InputMaybe<Array<InputMaybe<FeatureOptionInput>>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<InputMaybe<FeatureProficiencyInput>>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  senses?: InputMaybe<Array<InputMaybe<FeatureSenseInput>>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<InputMaybe<FeatureSpellInput>>>;
  subfeatures?: InputMaybe<Array<InputMaybe<FeatureSubfeatureInput>>>;
  targets?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type FeatureModifier = {
  __typename: 'FeatureModifier';
  abilities?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category?: Maybe<Scalars['ID']['output']>;
  charge?: Maybe<Charge>;
  conditions?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  damageType?: Maybe<Scalars['ID']['output']>;
  damageTypes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  dieConfig?: Maybe<Scalars['String']['output']>;
  diePerLevel?: Maybe<Array<Maybe<ModifierDiePerLevel>>>;
  duration?: Maybe<Scalars['ID']['output']>;
  feature?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  maxAmount?: Maybe<Scalars['Int']['output']>;
  maxRange?: Maybe<Scalars['Int']['output']>;
  method?: Maybe<Scalars['ID']['output']>;
  methodAbility?: Maybe<Scalars['ID']['output']>;
  methodSkill?: Maybe<Scalars['ID']['output']>;
  minAmount?: Maybe<Scalars['Int']['output']>;
  minRange?: Maybe<Scalars['Int']['output']>;
  multiplier?: Maybe<Scalars['Int']['output']>;
  prerequisites?: Maybe<Prerequisite>;
  range?: Maybe<Scalars['ID']['output']>;
  saveAbilities?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  setAmount?: Maybe<Scalars['Int']['output']>;
  setPerLevel?: Maybe<Array<Maybe<ModifierSetPerLevel>>>;
  shape?: Maybe<Scalars['ID']['output']>;
  size?: Maybe<Scalars['Int']['output']>;
  skills?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  speeds?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  spell?: Maybe<Scalars['ID']['output']>;
  spellCategory?: Maybe<Scalars['ID']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
  type?: Maybe<Scalars['ID']['output']>;
  unit?: Maybe<Scalars['ID']['output']>;
};

export type FeatureModifierInput = {
  abilities?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charge?: InputMaybe<ChargeInput>;
  conditions?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  damageType?: InputMaybe<Scalars['ID']['input']>;
  damageTypes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  dieConfig?: InputMaybe<Scalars['String']['input']>;
  diePerLevel?: InputMaybe<Array<InputMaybe<ModifierDiePerLevelInput>>>;
  duration?: InputMaybe<Scalars['ID']['input']>;
  feature?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  maxAmount?: InputMaybe<Scalars['Int']['input']>;
  maxRange?: InputMaybe<Scalars['Int']['input']>;
  method?: InputMaybe<Scalars['ID']['input']>;
  methodAbility?: InputMaybe<Scalars['ID']['input']>;
  methodSkill?: InputMaybe<Scalars['ID']['input']>;
  minAmount?: InputMaybe<Scalars['Int']['input']>;
  minRange?: InputMaybe<Scalars['Int']['input']>;
  multiplier?: InputMaybe<Scalars['Int']['input']>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  range?: InputMaybe<Scalars['ID']['input']>;
  saveAbilities?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  setAmount?: InputMaybe<Scalars['Int']['input']>;
  setPerLevel?: InputMaybe<Array<InputMaybe<ModifierSetPerLevelInput>>>;
  shape?: InputMaybe<Scalars['ID']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  speeds?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  spellCategory?: InputMaybe<Scalars['ID']['input']>;
  spells?: InputMaybe<Scalars['ID']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
  type?: InputMaybe<Scalars['ID']['input']>;
  unit?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureOption = {
  __typename: 'FeatureOption';
  actions?: Maybe<ActionGroup>;
  ancestries?: Maybe<Array<Maybe<FeatureAncestry>>>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<Maybe<FeatureExpertise>>>;
  feats?: Maybe<Array<Maybe<FeatureFeat>>>;
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  levelAvailable?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<Maybe<FeatureModifier>>>;
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<Maybe<FeatureProficiency>>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  senses?: Maybe<Array<Maybe<FeatureSense>>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<Maybe<FeatureSpell>>>;
  subfeatures?: Maybe<Array<Maybe<FeatureSubfeature>>>;
  targets?: Maybe<Scalars['Int']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type FeatureOptionInput = {
  actions?: InputMaybe<ActionGroupInput>;
  ancestry?: InputMaybe<Array<InputMaybe<FeatureAncestryInput>>>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<InputMaybe<FeatureExpertiseInput>>>;
  feats?: InputMaybe<Array<InputMaybe<FeatureFeatInput>>>;
  id: Scalars['ID']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<InputMaybe<FeatureModifierInput>>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<InputMaybe<FeatureProficiencyInput>>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  senses?: InputMaybe<Array<InputMaybe<FeatureSenseInput>>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<InputMaybe<FeatureSpellInput>>>;
  subfeatures?: InputMaybe<Array<InputMaybe<FeatureSubfeatureInput>>>;
  targets?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type FeatureProficiency = {
  __typename: 'FeatureProficiency';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category: Scalars['ID']['output'];
  equipment?: Maybe<ProficiencyProperties>;
  id: Scalars['ID']['output'];
  languages?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  level: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  properties?: Maybe<ProficiencyProperties>;
  rounding?: Maybe<Scalars['ID']['output']>;
  saveAbilities?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  skills?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureProficiencyInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category: Scalars['ID']['input'];
  equipment?: InputMaybe<ProficiencyPropertiesInput>;
  id: Scalars['ID']['input'];
  languages?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  level?: InputMaybe<Scalars['ID']['input']>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  properties?: InputMaybe<ProficiencyPropertiesInput>;
  rounding?: InputMaybe<Scalars['ID']['input']>;
  saveAbilities?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureSense = {
  __typename: 'FeatureSense';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  charges?: Maybe<Charge>;
  id: Scalars['ID']['output'];
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureSenseInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  charges?: InputMaybe<ChargeInput>;
  id: Scalars['ID']['input'];
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureSpell = {
  __typename: 'FeatureSpell';
  ability?: Maybe<Scalars['ID']['output']>;
  attributeLimit?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  charges?: Maybe<Charge>;
  classLimit?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  id: Scalars['ID']['output'];
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  levelLimit?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  spellLevel?: Maybe<Scalars['Int']['output']>;
  spellsByLevel?: Maybe<Array<Maybe<SpellsByLevel>>>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureSpellInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  attributeLimit?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  charges?: InputMaybe<ChargeInput>;
  classLimit?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  levelLimit?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  spellLevel?: InputMaybe<Scalars['Int']['input']>;
  spellsByLevel?: InputMaybe<Array<InputMaybe<SpellsByLevelInput>>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureSubfeature = {
  __typename: 'FeatureSubfeature';
  actions?: Maybe<ActionGroup>;
  ancestries?: Maybe<Array<Maybe<FeatureAncestry>>>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<Maybe<FeatureExpertise>>>;
  feats?: Maybe<Array<Maybe<FeatureFeat>>>;
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  levelAvailable?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<Maybe<FeatureModifier>>>;
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<Maybe<FeatureProficiency>>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  senses?: Maybe<Array<Maybe<FeatureSense>>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<Maybe<FeatureSpell>>>;
  targets?: Maybe<Scalars['Int']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type FeatureSubfeatureInput = {
  actions?: InputMaybe<ActionGroupInput>;
  ancestry?: InputMaybe<Array<InputMaybe<FeatureAncestryInput>>>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<InputMaybe<FeatureExpertiseInput>>>;
  feats?: InputMaybe<Array<InputMaybe<FeatureFeatInput>>>;
  id: Scalars['ID']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<InputMaybe<FeatureModifierInput>>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<InputMaybe<FeatureProficiencyInput>>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  senses?: InputMaybe<Array<InputMaybe<FeatureSenseInput>>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<InputMaybe<FeatureSpellInput>>>;
  targets?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type GenerateOption = {
  __typename: 'GenerateOption';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  reduce?: Maybe<Scalars['Int']['output']>;
  value: Scalars['String']['output'];
};

export type GenerateOptionInput = {
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  reduce?: InputMaybe<Scalars['Int']['input']>;
  value: Scalars['String']['input'];
};

export type GenericType = {
  __typename: 'GenericType';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  short?: Maybe<Scalars['String']['output']>;
  tooltip?: Maybe<Scalars['String']['output']>;
  value: Scalars['String']['output'];
};

export type GenericTypeInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  short?: InputMaybe<Scalars['String']['input']>;
  tooltip?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['String']['input'];
};

export type Hitpoint = {
  __typename: 'Hitpoint';
  ability?: Maybe<Scalars['ID']['output']>;
  dieConfig?: Maybe<Scalars['String']['output']>;
};

export type HitpointInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  dieConfig?: InputMaybe<Scalars['String']['input']>;
};

export type Imperial = {
  __typename: 'Imperial';
  length?: Maybe<Array<Maybe<GenericType>>>;
  volume?: Maybe<Array<Maybe<GenericType>>>;
  weight?: Maybe<Array<Maybe<GenericType>>>;
};

export type ImperialInput = {
  length?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  volume?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  weight?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
};

export type LevelAttribute = {
  __typename: 'LevelAttribute';
  cantripsKnownLimit?: Maybe<Scalars['Int']['output']>;
  level?: Maybe<Scalars['Int']['output']>;
  resourcePoints?: Maybe<Scalars['Int']['output']>;
  spellSlots?: Maybe<Array<Maybe<SpellSlot>>>;
  spellsKnownLimit?: Maybe<Scalars['Int']['output']>;
};

export type LevelAttributeInput = {
  cantripsKnownLimit?: InputMaybe<Scalars['Int']['input']>;
  level?: InputMaybe<Scalars['Int']['input']>;
  resourcePoints?: InputMaybe<Scalars['Int']['input']>;
  spellSlots?: InputMaybe<Array<InputMaybe<SpellSlotInput>>>;
  spellsKnownLimit?: InputMaybe<Scalars['Int']['input']>;
};

export type LineageInput = {
  id?: InputMaybe<Scalars['ID']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type Manual = {
  __typename: 'Manual';
  ability?: Maybe<Scalars['ID']['output']>;
  score?: Maybe<Scalars['Int']['output']>;
};

export type ManualInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  score?: InputMaybe<Scalars['Int']['input']>;
};

export type ManualRolled = {
  __typename: 'ManualRolled';
  configuration: Scalars['String']['output'];
  manual?: Maybe<Array<Maybe<Manual>>>;
  rollGroups?: Maybe<Array<Maybe<RollGroup>>>;
};

export type ManualRolledInput = {
  configuration: Scalars['String']['input'];
  manual?: InputMaybe<Array<InputMaybe<ManualInput>>>;
  rollGroups?: InputMaybe<Array<InputMaybe<RollGroupInput>>>;
};

export type ModifierCategoryType = {
  __typename: 'ModifierCategoryType';
  categoryId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  typeId: Scalars['String']['output'];
};

export type ModifierCategoryTypeInput = {
  categoryId: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  typeId: Scalars['String']['input'];
};

export type ModifierCategoryTypeMethod = {
  __typename: 'ModifierCategoryTypeMethod';
  categoryId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  methodId: Scalars['String']['output'];
  typeId: Scalars['String']['output'];
};

export type ModifierCategoryTypeMethodInput = {
  categoryId: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  methodId: Scalars['String']['input'];
  typeId: Scalars['String']['input'];
};

export type ModifierDiePerLevel = {
  __typename: 'ModifierDiePerLevel';
  dieConfig?: Maybe<Scalars['String']['output']>;
  level?: Maybe<Scalars['String']['output']>;
};

export type ModifierDiePerLevelInput = {
  dieConfig?: InputMaybe<Scalars['String']['input']>;
  level?: InputMaybe<Scalars['String']['input']>;
};

export type ModifierSetPerLevel = {
  __typename: 'ModifierSetPerLevel';
  level?: Maybe<Scalars['String']['output']>;
  setAmount?: Maybe<Scalars['Int']['output']>;
};

export type ModifierSetPerLevelInput = {
  level?: InputMaybe<Scalars['String']['input']>;
  setAmount?: InputMaybe<Scalars['Int']['input']>;
};

export type ModifierTypeMethod = {
  __typename: 'ModifierTypeMethod';
  id: Scalars['ID']['output'];
  methodId: Scalars['String']['output'];
  typeId: Scalars['String']['output'];
};

export type ModifierTypeMethodInput = {
  id: Scalars['ID']['input'];
  methodId: Scalars['String']['input'];
  typeId: Scalars['String']['input'];
};

export type Multiclass = {
  __typename: 'Multiclass';
  optionalAbility?: Maybe<MulticlassAbility>;
  primaryAbility?: Maybe<MulticlassAbility>;
  secondaryAbility?: Maybe<MulticlassAbility>;
};

export type MulticlassAbility = {
  __typename: 'MulticlassAbility';
  id?: Maybe<Scalars['ID']['output']>;
  minAmount?: Maybe<Scalars['Int']['output']>;
};

export type MulticlassAbilityInput = {
  id?: InputMaybe<Scalars['ID']['input']>;
  minAmount?: InputMaybe<Scalars['Int']['input']>;
};

export type MulticlassInput = {
  optionalAbility?: InputMaybe<MulticlassAbilityInput>;
  primaryAbility?: InputMaybe<MulticlassAbilityInput>;
  secondaryAbility?: InputMaybe<MulticlassAbilityInput>;
};

export type Mutation = {
  __typename: 'Mutation';
  batchCreateBackgrounds: Array<Background>;
  batchCreateClasses: Array<Class>;
  batchCreateEquipment: Array<Equipment>;
  batchCreateFeats: Array<Feat>;
  batchCreateRaces: Array<Race>;
  batchCreateSpells: Array<Spell>;
  batchCreateSystems: Array<System>;
  createBackground: Background;
  createCharacter: Character;
  createClass: Class;
  createEquipment: Equipment;
  createFeat: Feat;
  createRace: Race;
  createSpell: Spell;
  createSystem: System;
  deleteBackground: Scalars['ID']['output'];
  deleteCharacter: Scalars['ID']['output'];
  deleteClass: Scalars['ID']['output'];
  deleteEquipment: Scalars['ID']['output'];
  deleteFeat: Scalars['ID']['output'];
  deleteRace: Scalars['ID']['output'];
  deleteSpell: Scalars['ID']['output'];
  deleteSystem: Scalars['ID']['output'];
  updateBackground: Background;
  updateCharacter: Character;
  updateClass: Class;
  updateEquipment: Equipment;
  updateFeat: Feat;
  updateRace: Race;
  updateSpell: Spell;
  updateSystem: System;
};


export type MutationBatchCreateBackgroundsArgs = {
  input: Array<BatchBackgroundsInput>;
};


export type MutationBatchCreateClassesArgs = {
  input: Array<BatchClassesInput>;
};


export type MutationBatchCreateEquipmentArgs = {
  input: Array<BatchEquipmentInput>;
};


export type MutationBatchCreateFeatsArgs = {
  input: Array<BatchFeatInput>;
};


export type MutationBatchCreateRacesArgs = {
  input: Array<BatchRacesInput>;
};


export type MutationBatchCreateSpellsArgs = {
  input: Array<InputMaybe<BatchSpellsInput>>;
};


export type MutationBatchCreateSystemsArgs = {
  input: Array<BatchSystemsInput>;
};


export type MutationCreateBackgroundArgs = {
  input: BackgroundInput;
};


export type MutationCreateCharacterArgs = {
  input: CharacterInput;
};


export type MutationCreateClassArgs = {
  input: ClassInput;
};


export type MutationCreateEquipmentArgs = {
  input: EquipmentInput;
};


export type MutationCreateFeatArgs = {
  input: FeatInput;
};


export type MutationCreateRaceArgs = {
  input: RaceInput;
};


export type MutationCreateSpellArgs = {
  input: SpellInput;
};


export type MutationCreateSystemArgs = {
  input: SystemInput;
};


export type MutationDeleteBackgroundArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteCharacterArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteClassArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteEquipmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFeatArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRaceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteSpellArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteSystemArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateBackgroundArgs = {
  input: BackgroundInput;
};


export type MutationUpdateCharacterArgs = {
  input: CharacterInput;
};


export type MutationUpdateClassArgs = {
  input: ClassInput;
};


export type MutationUpdateEquipmentArgs = {
  input: EquipmentInput;
};


export type MutationUpdateFeatArgs = {
  input: FeatInput;
};


export type MutationUpdateRaceArgs = {
  input: RaceInput;
};


export type MutationUpdateSpellArgs = {
  input: SpellInput;
};


export type MutationUpdateSystemArgs = {
  input: SystemInput;
};

export type PointBuy = {
  __typename: 'PointBuy';
  distributed?: Maybe<Array<Maybe<Distributed>>>;
  pointsLeft?: Maybe<Scalars['Int']['output']>;
};

export type PointBuyInput = {
  distributed?: InputMaybe<Array<InputMaybe<DistributedInput>>>;
  pointsLeft?: InputMaybe<Scalars['Int']['input']>;
};

export type PrepareLimit = {
  __typename: 'PrepareLimit';
  level?: Maybe<PrepareLimitLevel>;
  methods?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
};

export type PrepareLimitInput = {
  level?: InputMaybe<PrepareLimitLevelInput>;
  methods?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type PrepareLimitLevel = {
  __typename: 'PrepareLimitLevel';
  measurement?: Maybe<Scalars['ID']['output']>;
  rounding?: Maybe<Scalars['ID']['output']>;
};

export type PrepareLimitLevelInput = {
  measurement?: InputMaybe<Scalars['ID']['input']>;
  rounding?: InputMaybe<Scalars['ID']['input']>;
};

export type Prerequisite = {
  __typename: 'Prerequisite';
  abilityScore?: Maybe<AbilityScore>;
  equipmentProficiencies?: Maybe<Array<Maybe<EquipPrerequisite>>>;
  equipped?: Maybe<Array<Maybe<EquipPrerequisite>>>;
  featuresObtained?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  notEquipped?: Maybe<Array<Maybe<EquipPrerequisite>>>;
  options?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  optionsObtained?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  size?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  skillProficiencies?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  spellsObtained?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
};

export type PrerequisiteInput = {
  abilityScore?: InputMaybe<AbilityScoreInput>;
  equipmentProficiencies?: InputMaybe<Array<InputMaybe<EquipPrerequisiteInput>>>;
  equipped?: InputMaybe<Array<InputMaybe<EquipPrerequisiteInput>>>;
  featuresObtained?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  notEquipped?: InputMaybe<Array<InputMaybe<EquipPrerequisiteInput>>>;
  options?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  optionsObtained?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  size?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  skillProficiencies?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  spellsObtained?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type ProficiencyLevel = {
  __typename: 'ProficiencyLevel';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  multiplier?: Maybe<Scalars['Float']['output']>;
  value: Scalars['String']['output'];
};

export type ProficiencyLevelInput = {
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  multiplier?: InputMaybe<Scalars['Float']['input']>;
  value: Scalars['String']['input'];
};

export type ProficiencyProperties = {
  __typename: 'ProficiencyProperties';
  category?: Maybe<Scalars['ID']['output']>;
  ids?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  properties?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
};

export type ProficiencyPropertiesInput = {
  category?: InputMaybe<Scalars['ID']['input']>;
  ids?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  properties?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type Query = {
  __typename: 'Query';
  getBackground?: Maybe<Background>;
  getCharacter?: Maybe<Character>;
  getClass?: Maybe<Class>;
  getEquipment?: Maybe<Equipment>;
  getFeat?: Maybe<Feat>;
  getRace?: Maybe<Race>;
  getSpell?: Maybe<Spell>;
  getSystem?: Maybe<System>;
  listBackgrounds: BackgroundConnection;
  listCharacters: CharacterConnection;
  listClasses: ClassConnection;
  listEquipment: EquipmentConnection;
  listFeats: FeatConnection;
  listMasterBackgrounds?: Maybe<Array<Background>>;
  listMasterClasses?: Maybe<Array<Class>>;
  listMasterEquipment?: Maybe<Array<Equipment>>;
  listMasterFeats?: Maybe<Array<Feat>>;
  listMasterRaces?: Maybe<Array<Race>>;
  listMasterSpells?: Maybe<Array<Spell>>;
  listMasterSystems?: Maybe<Array<System>>;
  listRaces: RaceConnection;
  listSpells: SpellConnection;
  listSystems: SystemConnection;
};


export type QueryGetBackgroundArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetCharacterArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetClassArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetEquipmentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFeatArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetRaceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetSpellArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetSystemArgs = {
  id: Scalars['ID']['input'];
};


export type QueryListBackgroundsArgs = {
  systemId: Scalars['String']['input'];
};


export type QueryListCharactersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['String']['input'];
};


export type QueryListClassesArgs = {
  systemId: Scalars['String']['input'];
};


export type QueryListEquipmentArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['String']['input'];
};


export type QueryListFeatsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['String']['input'];
};


export type QueryListRacesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['String']['input'];
};


export type QueryListSpellsArgs = {
  systemId: Scalars['String']['input'];
};


export type QueryListSystemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};

export type Race = {
  __typename: 'Race';
  ancestry?: Maybe<Ancestry>;
  category: Scalars['ID']['output'];
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Maybe<Detail>>>;
  features?: Maybe<Array<Maybe<Feature>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  lineages?: Maybe<Array<Scalars['ID']['output']>>;
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  playable?: Maybe<Scalars['String']['output']>;
  quote?: Maybe<Scalars['String']['output']>;
  systemId: Scalars['ID']['output'];
  traits?: Maybe<Traits>;
  value: Scalars['String']['output'];
};

export type RaceConnection = {
  __typename: 'RaceConnection';
  items?: Maybe<Array<Race>>;
  message?: Maybe<Scalars['String']['output']>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type RaceInput = {
  ancestry?: InputMaybe<AncestryInput>;
  category: Scalars['ID']['input'];
  desc?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<Array<InputMaybe<DetailInput>>>;
  features?: InputMaybe<Array<InputMaybe<FeatureInput>>>;
  id?: InputMaybe<Scalars['ID']['input']>;
  label: Scalars['String']['input'];
  lineages?: InputMaybe<Array<Scalars['ID']['input']>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId?: InputMaybe<Scalars['ID']['input']>;
  playable: Scalars['String']['input'];
  quote?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
  traits?: InputMaybe<TraitsInput>;
  value: Scalars['String']['input'];
};

export type RaceSpeed = {
  __typename: 'RaceSpeed';
  climbing?: Maybe<Scalars['Int']['output']>;
  flying?: Maybe<Scalars['Int']['output']>;
  swimming?: Maybe<Scalars['Int']['output']>;
  walking?: Maybe<Scalars['Int']['output']>;
};

export type RaceSpeedInput = {
  climbing?: InputMaybe<Scalars['Int']['input']>;
  flying?: InputMaybe<Scalars['Int']['input']>;
  swimming?: InputMaybe<Scalars['Int']['input']>;
  walking?: InputMaybe<Scalars['Int']['input']>;
};

export type Range = {
  __typename: 'Range';
  distance?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  maxRange?: Maybe<Scalars['Int']['output']>;
  minRange?: Maybe<Scalars['Int']['output']>;
  unit?: Maybe<Scalars['ID']['output']>;
};

export type RangeInput = {
  distance?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  maxRange?: InputMaybe<Scalars['Int']['input']>;
  minRange?: InputMaybe<Scalars['Int']['input']>;
  unit?: InputMaybe<Scalars['ID']['input']>;
};

export type Resource = {
  __typename: 'Resource';
  charges?: Maybe<Charge>;
  desc?: Maybe<Scalars['String']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  levelAvailable?: Maybe<Scalars['Int']['output']>;
  method?: Maybe<Scalars['ID']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type ResourceInput = {
  charges?: InputMaybe<ChargeInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  levelAvailable?: InputMaybe<Scalars['Int']['input']>;
  method?: InputMaybe<Scalars['ID']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type Roll = {
  __typename: 'Roll';
  die: Scalars['Int']['output'];
  id?: Maybe<Scalars['String']['output']>;
  value: Scalars['Int']['output'];
};

export type RollGroup = {
  __typename: 'RollGroup';
  rolls?: Maybe<Array<Maybe<RollType>>>;
};

export type RollGroupInput = {
  rolls?: InputMaybe<Array<InputMaybe<RollTypeInput>>>;
};

export type RollInput = {
  die: Scalars['Int']['input'];
  id?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['Int']['input'];
};

export type RollType = {
  __typename: 'RollType';
  ability: Scalars['ID']['output'];
  applied: Scalars['Boolean']['output'];
  kept: Array<Maybe<Roll>>;
  rolled: Array<Maybe<Roll>>;
  rolling: Scalars['Boolean']['output'];
  score: Scalars['Int']['output'];
};

export type RollTypeInput = {
  ability: Scalars['ID']['input'];
  applied: Scalars['Boolean']['input'];
  kept: Array<InputMaybe<RollInput>>;
  rolled: Array<InputMaybe<RollInput>>;
  rolling: Scalars['Boolean']['input'];
  score: Scalars['Int']['input'];
};

export type SaveAbility = {
  __typename: 'SaveAbility';
  abilityModifier?: Maybe<Scalars['ID']['output']>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  id: Scalars['ID']['output'];
  minAmount?: Maybe<Scalars['Int']['output']>;
};

export type SaveAbilityInput = {
  abilityModifier?: InputMaybe<Scalars['ID']['input']>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  id: Scalars['ID']['input'];
  minAmount?: InputMaybe<Scalars['Int']['input']>;
};

export type Scores = {
  __typename: 'Scores';
  ability: Scalars['ID']['output'];
  baseScore?: Maybe<Scalars['Int']['output']>;
  calculatedScore?: Maybe<Scalars['Int']['output']>;
  classScore?: Maybe<Scalars['Int']['output']>;
  modifierScore?: Maybe<Scalars['Int']['output']>;
  raceScore?: Maybe<Scalars['Int']['output']>;
};

export type ScoresInput = {
  ModifierScore?: InputMaybe<Scalars['Int']['input']>;
  ability: Scalars['ID']['input'];
  baseScore?: InputMaybe<Scalars['Int']['input']>;
  calculatedScore?: InputMaybe<Scalars['Int']['input']>;
  classScore?: InputMaybe<Scalars['Int']['input']>;
  raceScore?: InputMaybe<Scalars['Int']['input']>;
};

export enum SectionEnum {
  all = 'all',
  spells = 'spells',
  subclasses = 'subclasses'
}

export enum SectionEnumInput {
  all = 'all',
  spells = 'spells',
  subclasses = 'subclasses'
}

export type SetPerLevel = {
  __typename: 'SetPerLevel';
  bonus?: Maybe<Scalars['Int']['output']>;
  level?: Maybe<Scalars['String']['output']>;
  primary?: Maybe<Scalars['Int']['output']>;
  secondary?: Maybe<Scalars['Int']['output']>;
};

export type SetPerLevelInput = {
  bonus?: InputMaybe<Scalars['Int']['input']>;
  level?: InputMaybe<Scalars['String']['input']>;
  primary?: InputMaybe<Scalars['Int']['input']>;
  secondary?: InputMaybe<Scalars['Int']['input']>;
};

export type Shape = {
  __typename: 'Shape';
  id: Scalars['ID']['output'];
  size?: Maybe<Scalars['Float']['output']>;
  unit?: Maybe<Scalars['ID']['output']>;
};

export type ShapeInput = {
  id: Scalars['ID']['input'];
  size?: InputMaybe<Scalars['Float']['input']>;
  unit?: InputMaybe<Scalars['ID']['input']>;
};

export type Speed = {
  __typename: 'Speed';
  amount?: Maybe<Scalars['Int']['output']>;
  unit: Scalars['ID']['output'];
};

export type SpeedInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  unit: Scalars['ID']['input'];
};

export type Spell = {
  __typename: 'Spell';
  actions?: Maybe<ActionGroup>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  classes: Array<Maybe<Scalars['ID']['output']>>;
  conditions?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  duration: Duration;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  level?: Maybe<Scalars['Int']['output']>;
  masterId?: Maybe<Scalars['String']['output']>;
  materialDesc?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  range: Range;
  requirements?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  saveAbility?: Maybe<SaveAbility>;
  school: Scalars['ID']['output'];
  shape?: Maybe<Shape>;
  systemId: Scalars['ID']['output'];
  targets?: Maybe<Scalars['Int']['output']>;
  upcast?: Maybe<Upcast>;
  value: Scalars['String']['output'];
};

export type SpellConnection = {
  __typename: 'SpellConnection';
  items?: Maybe<Array<Spell>>;
  message?: Maybe<Scalars['String']['output']>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export enum SpellEnum {
  all = 'all',
  damage = 'damage',
  upcast = 'upcast'
}

export enum SpellEnumInput {
  all = 'all',
  damage = 'damage',
  upcast = 'upcast'
}

export type SpellInput = {
  actions?: InputMaybe<ActionGroupInput>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  classes: Array<InputMaybe<Scalars['ID']['input']>>;
  conditions?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  duration: DurationInput;
  id?: InputMaybe<Scalars['ID']['input']>;
  label: Scalars['String']['input'];
  level?: InputMaybe<Scalars['Int']['input']>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  materialDesc?: InputMaybe<Scalars['String']['input']>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  range: RangeInput;
  requirements?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  school: Scalars['ID']['input'];
  shape?: InputMaybe<ShapeInput>;
  systemId: Scalars['ID']['input'];
  targets?: InputMaybe<Scalars['Int']['input']>;
  upcast?: InputMaybe<UpcastInput>;
  value: Scalars['String']['input'];
};

export type SpellSlot = {
  __typename: 'SpellSlot';
  slotCount?: Maybe<Scalars['Int']['output']>;
};

export type SpellSlotInput = {
  slotCount?: InputMaybe<Scalars['Int']['input']>;
};

export type Spellcasting = {
  __typename: 'Spellcasting';
  ability?: Maybe<Scalars['ID']['output']>;
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  charges?: Maybe<Charge>;
  magicName?: Maybe<Scalars['String']['output']>;
  maxSpellLevel?: Maybe<Scalars['Int']['output']>;
  prepareLimit?: Maybe<PrepareLimit>;
};

export type SpellcastingInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  charges?: InputMaybe<ChargeInput>;
  magicName?: InputMaybe<Scalars['String']['input']>;
  maxSpellLevel?: InputMaybe<Scalars['Int']['input']>;
  prepareLimit?: InputMaybe<PrepareLimitInput>;
};

export type SpellsByLevel = {
  __typename: 'SpellsByLevel';
  level?: Maybe<Scalars['Int']['output']>;
  spellLevel?: Maybe<Scalars['Int']['output']>;
  spells?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
};

export type SpellsByLevelInput = {
  id: Scalars['ID']['input'];
  level?: InputMaybe<Scalars['Int']['input']>;
  spellLevel?: InputMaybe<Scalars['Int']['input']>;
  spells?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
};

export type StandardArray = {
  __typename: 'StandardArray';
  ability?: Maybe<Scalars['ID']['output']>;
  score?: Maybe<Scalars['ID']['output']>;
};

export type StandardArrayInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  score?: InputMaybe<Scalars['ID']['input']>;
};

export type StartingGold = {
  __typename: 'StartingGold';
  currency: Scalars['ID']['output'];
  dieConfig?: Maybe<Scalars['String']['output']>;
  multiplier: Scalars['Int']['output'];
};

export type StartingGoldInput = {
  currency: Scalars['ID']['input'];
  dieConfig?: InputMaybe<Scalars['String']['input']>;
  multiplier: Scalars['Int']['input'];
};

export type Subclass = {
  __typename: 'Subclass';
  id?: Maybe<Scalars['ID']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type SubclassInput = {
  id?: InputMaybe<Scalars['ID']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type Subtype = {
  __typename: 'Subtype';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type SubtypeInput = {
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type System = {
  __typename: 'System';
  abilities?: Maybe<Array<Maybe<GenericType>>>;
  actions?: Maybe<Array<Maybe<SystemAction>>>;
  alignments?: Maybe<Array<Maybe<GenericType>>>;
  attributes?: Maybe<Array<Maybe<SystemAttribute>>>;
  categories?: Maybe<Array<Maybe<SystemCategory>>>;
  characters?: Maybe<CharacterSetting>;
  charges?: Maybe<SystemCharges>;
  conditions?: Maybe<Array<Maybe<GenericType>>>;
  currencies?: Maybe<Array<Maybe<Currency>>>;
  damageTypes?: Maybe<Array<Maybe<GenericType>>>;
  desc?: Maybe<Scalars['String']['output']>;
  equipment?: Maybe<SystemEquipment>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  languages?: Maybe<Array<Maybe<GenericType>>>;
  masterId?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<SystemModifiers>;
  ownerId: Scalars['String']['output'];
  passives?: Maybe<Array<Maybe<GenericType>>>;
  prerequisites?: Maybe<Array<Maybe<SystemPrerequisite>>>;
  proficiencies?: Maybe<SystemProficiency>;
  rules?: Maybe<SystemRules>;
  senses?: Maybe<Array<Maybe<SystemSense>>>;
  sizes?: Maybe<Array<Maybe<GenericType>>>;
  skills?: Maybe<Array<Maybe<SystemSkill>>>;
  speeds?: Maybe<Array<Maybe<GenericType>>>;
  spells?: Maybe<SystemSpell>;
  terrains?: Maybe<Array<Maybe<GenericType>>>;
  value: Scalars['String']['output'];
};

export type SystemAction = {
  __typename: 'SystemAction';
  classes: Scalars['Boolean']['output'];
  damage: Scalars['Boolean']['output'];
  equipment: Scalars['Boolean']['output'];
  feats: Scalars['Boolean']['output'];
  features: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  sections: Scalars['Boolean']['output'];
  spells: Scalars['Boolean']['output'];
  value: Scalars['String']['output'];
};

export type SystemActionInput = {
  classes: Scalars['Boolean']['input'];
  damage: Scalars['Boolean']['input'];
  equipment: Scalars['Boolean']['input'];
  feats: Scalars['Boolean']['input'];
  features: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections: Scalars['Boolean']['input'];
  spells: Scalars['Boolean']['input'];
  value: Scalars['String']['input'];
};

export type SystemAttribute = {
  __typename: 'SystemAttribute';
  classes?: Maybe<Array<Maybe<ClassesEnum>>>;
  damage?: Maybe<Array<Maybe<DamageEnum>>>;
  equipment?: Maybe<Array<Maybe<EquipmentEnum>>>;
  feats?: Maybe<Array<Maybe<AllEnum>>>;
  features?: Maybe<Array<Maybe<FeatureEnum>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  sections?: Maybe<Array<Maybe<SectionEnum>>>;
  spells?: Maybe<Array<Maybe<SpellEnum>>>;
  value: Scalars['String']['output'];
};

export type SystemAttributeInput = {
  classes?: InputMaybe<Array<InputMaybe<ClassesEnumInput>>>;
  damage?: InputMaybe<Array<InputMaybe<DamageEnumInput>>>;
  equipment?: InputMaybe<Array<InputMaybe<EquipmentEnumInput>>>;
  feats?: InputMaybe<Array<InputMaybe<AllEnumInput>>>;
  features?: InputMaybe<Array<InputMaybe<FeatureEnumInput>>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<InputMaybe<SectionEnumInput>>>;
  spells?: InputMaybe<Array<InputMaybe<SpellEnumInput>>>;
  value: Scalars['String']['input'];
};

export type SystemCategory = {
  __typename: 'SystemCategory';
  classes: Scalars['Boolean']['output'];
  features: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  races: Scalars['Boolean']['output'];
  value: Scalars['String']['output'];
};

export type SystemCategoryInput = {
  classes: Scalars['Boolean']['input'];
  features: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  races: Scalars['Boolean']['input'];
  value: Scalars['String']['input'];
};

export type SystemCharges = {
  __typename: 'SystemCharges';
  limits?: Maybe<Array<Maybe<ChargeOption>>>;
  resets?: Maybe<Array<Maybe<ChargeOption>>>;
};

export type SystemChargesInput = {
  limits?: InputMaybe<Array<InputMaybe<ChargeOptionInput>>>;
  resets?: InputMaybe<Array<InputMaybe<ChargeOptionInput>>>;
};

export type SystemConnection = {
  __typename: 'SystemConnection';
  items: Array<System>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type SystemEquipment = {
  __typename: 'SystemEquipment';
  categories?: Maybe<Array<Maybe<GenericType>>>;
  categoryProperties?: Maybe<Array<Maybe<EquipmentCategoryProperty>>>;
  properties?: Maybe<Array<Maybe<GenericType>>>;
  rarities?: Maybe<Array<Maybe<GenericType>>>;
};

export type SystemEquipmentInput = {
  categories?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  categoryProperties?: InputMaybe<Array<InputMaybe<EquipmentCategoryPropertyInput>>>;
  properties?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  rarities?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
};

export type SystemInput = {
  abilities?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  actions?: InputMaybe<Array<InputMaybe<SystemActionInput>>>;
  alignments?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  attributes?: InputMaybe<Array<InputMaybe<SystemAttributeInput>>>;
  categories?: InputMaybe<Array<InputMaybe<SystemCategoryInput>>>;
  characters?: InputMaybe<CharacterSettingInput>;
  charges?: InputMaybe<SystemChargesInput>;
  conditions?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  currencies?: InputMaybe<Array<InputMaybe<CurrencyInput>>>;
  damageTypes?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  desc?: InputMaybe<Scalars['String']['input']>;
  equipment?: InputMaybe<SystemEquipmentInput>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  languages?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<SystemModifiersInput>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  passives?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  prerequisites?: InputMaybe<Array<InputMaybe<SystemPrerequisiteInput>>>;
  proficiencies?: InputMaybe<SystemProficiencyInput>;
  rules?: InputMaybe<SystemRulesInput>;
  senses?: InputMaybe<Array<InputMaybe<SystemSenseInput>>>;
  sizes?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  skills?: InputMaybe<Array<InputMaybe<SystemSkillInput>>>;
  speeds?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  spells?: InputMaybe<SystemSpellInput>;
  terrains?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  value: Scalars['String']['input'];
};

export type SystemMeasurement = {
  __typename: 'SystemMeasurement';
  amount?: Maybe<Array<Maybe<GenericType>>>;
  imperial?: Maybe<Imperial>;
  rounding?: Maybe<Array<Maybe<GenericType>>>;
};

export type SystemMeasurementInput = {
  amount?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  imperial?: InputMaybe<ImperialInput>;
  rounding?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
};

export type SystemModifiers = {
  __typename: 'SystemModifiers';
  categories?: Maybe<Array<Maybe<GenericType>>>;
  categoryMethods?: Maybe<Array<Maybe<ModifierCategoryTypeMethod>>>;
  categoryTypes?: Maybe<Array<Maybe<ModifierCategoryType>>>;
  methods?: Maybe<Array<Maybe<GenericType>>>;
  spellCategories?: Maybe<Array<Maybe<GenericType>>>;
  typeMethods?: Maybe<Array<Maybe<ModifierTypeMethod>>>;
  types?: Maybe<Array<Maybe<GenericType>>>;
};

export type SystemModifiersInput = {
  categories?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  categoryMethods?: InputMaybe<Array<InputMaybe<ModifierCategoryTypeMethodInput>>>;
  categoryTypes?: InputMaybe<Array<InputMaybe<ModifierCategoryTypeInput>>>;
  methods?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  spellCategories?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  typeMethods?: InputMaybe<Array<InputMaybe<ModifierTypeMethodInput>>>;
  types?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
};

export type SystemPrerequisite = {
  __typename: 'SystemPrerequisite';
  classes?: Maybe<Array<Maybe<ClassesEnum>>>;
  damage?: Maybe<Array<Maybe<DamageEnum>>>;
  equipment?: Maybe<Array<Maybe<EquipmentEnum>>>;
  feats?: Maybe<Array<Maybe<AllEnum>>>;
  features?: Maybe<Array<Maybe<FeatureEnum>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  sections?: Maybe<Array<Maybe<SectionEnum>>>;
  spells?: Maybe<Array<Maybe<SpellEnum>>>;
  value: Scalars['String']['output'];
};

export type SystemPrerequisiteInput = {
  classes?: InputMaybe<Array<InputMaybe<ClassesEnumInput>>>;
  damage?: InputMaybe<Array<InputMaybe<DamageEnumInput>>>;
  equipment?: InputMaybe<Array<InputMaybe<EquipmentEnumInput>>>;
  feats?: InputMaybe<Array<InputMaybe<AllEnumInput>>>;
  features?: InputMaybe<Array<InputMaybe<FeatureEnumInput>>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<InputMaybe<SectionEnumInput>>>;
  spells?: InputMaybe<Array<InputMaybe<SpellEnumInput>>>;
  value: Scalars['String']['input'];
};

export type SystemProficiency = {
  __typename: 'SystemProficiency';
  categories?: Maybe<Array<Maybe<GenericType>>>;
  levels?: Maybe<Array<Maybe<ProficiencyLevel>>>;
};

export type SystemProficiencyInput = {
  categories?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  levels?: InputMaybe<Array<InputMaybe<ProficiencyLevelInput>>>;
};

export type SystemRules = {
  __typename: 'SystemRules';
  abilityGenerateMethod?: Maybe<Array<Maybe<AbilityGenerateMethod>>>;
  measurements?: Maybe<SystemMeasurement>;
};

export type SystemRulesInput = {
  abilityGenerateMethod?: InputMaybe<Array<InputMaybe<AbilityGenerateMethodInput>>>;
  measurements?: InputMaybe<SystemMeasurementInput>;
};

export type SystemSense = {
  __typename: 'SystemSense';
  creatureDesc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  monsterDesc?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  value: Scalars['String']['output'];
};

export type SystemSenseInput = {
  creatureDesc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  monsterDesc?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  value: Scalars['String']['input'];
};

export type SystemSkill = {
  __typename: 'SystemSkill';
  abilityId: Scalars['ID']['output'];
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type SystemSkillInput = {
  abilityId: Scalars['ID']['input'];
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type SystemSpell = {
  __typename: 'SystemSpell';
  categories?: Maybe<Array<Maybe<GenericType>>>;
  durations?: Maybe<Array<Maybe<GenericType>>>;
  ranges?: Maybe<Array<Maybe<GenericType>>>;
  requirements?: Maybe<Array<Maybe<GenericType>>>;
  schools?: Maybe<Array<Maybe<GenericType>>>;
  shapes?: Maybe<Array<Maybe<GenericType>>>;
};

export type SystemSpellInput = {
  categories?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  durations?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  ranges?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  requirements?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  schools?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
  shapes?: InputMaybe<Array<InputMaybe<GenericTypeInput>>>;
};

export type Traits = {
  __typename: 'Traits';
  details?: Maybe<Array<Maybe<Detail>>>;
  size?: Maybe<Scalars['ID']['output']>;
  speeds?: Maybe<RaceSpeed>;
};

export type TraitsInput = {
  details?: InputMaybe<Array<InputMaybe<DetailInput>>>;
  size?: InputMaybe<Scalars['ID']['input']>;
  speeds?: InputMaybe<RaceSpeedInput>;
};

export type Upcast = {
  __typename: 'Upcast';
  attributes?: Maybe<Array<Maybe<Scalars['ID']['output']>>>;
  levels?: Maybe<Array<Maybe<UpcastLevel>>>;
};

export type UpcastFields = {
  __typename: 'UpcastFields';
  amount?: Maybe<Scalars['Int']['output']>;
  distance?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
  maxRange?: Maybe<Scalars['Int']['output']>;
  minRange?: Maybe<Scalars['Int']['output']>;
  size?: Maybe<Scalars['Float']['output']>;
  unit?: Maybe<Scalars['ID']['output']>;
};

export type UpcastFieldsInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  distance?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  maxRange?: InputMaybe<Scalars['Int']['input']>;
  minRange?: InputMaybe<Scalars['Int']['input']>;
  size?: InputMaybe<Scalars['Float']['input']>;
  unit?: InputMaybe<Scalars['ID']['input']>;
};

export type UpcastInput = {
  attributes?: InputMaybe<Array<InputMaybe<Scalars['ID']['input']>>>;
  levels?: InputMaybe<Array<InputMaybe<UpcastLevelInput>>>;
};

export type UpcastLevel = {
  __typename: 'UpcastLevel';
  damage?: Maybe<Damage>;
  duration?: Maybe<UpcastFields>;
  level?: Maybe<Scalars['Int']['output']>;
  range?: Maybe<UpcastFields>;
  shape?: Maybe<UpcastFields>;
  targets?: Maybe<Scalars['Int']['output']>;
};

export type UpcastLevelInput = {
  damage?: InputMaybe<DamageInput>;
  duration?: InputMaybe<UpcastFieldsInput>;
  level?: InputMaybe<Scalars['Int']['input']>;
  range?: InputMaybe<UpcastFieldsInput>;
  shape?: InputMaybe<UpcastFieldsInput>;
  targets?: InputMaybe<Scalars['Int']['input']>;
};

export type UsesPerLevel = {
  __typename: 'UsesPerLevel';
  level?: Maybe<Scalars['Int']['output']>;
  uses?: Maybe<Scalars['Int']['output']>;
};

export type UsesPerLevelInput = {
  level?: InputMaybe<Scalars['Int']['input']>;
  uses?: InputMaybe<Scalars['Int']['input']>;
};

export type Weight = {
  __typename: 'Weight';
  amount?: Maybe<Scalars['Float']['output']>;
  unit: Scalars['ID']['output'];
};

export type WeightInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  unit: Scalars['ID']['input'];
};


