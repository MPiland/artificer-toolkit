export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
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
  options?: Maybe<Array<GenerateOption>>;
  total?: Maybe<Scalars['Int']['output']>;
};

export type AbilityGenerateMethodInput = {
  __kind: 'AbilityGenerateMethodInput';
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  options?: InputMaybe<Array<GenerateOptionInput>>;
  total?: InputMaybe<Scalars['Int']['input']>;
};

export type AbilityScore = {
  __typename: 'AbilityScore';
  abilities?: Maybe<Array<Scalars['ID']['output']>>;
  score?: Maybe<Scalars['Int']['output']>;
};

export type AbilityScoreInput = {
  __kind: 'AbilityScoreInput';
  abilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  score?: InputMaybe<Scalars['Int']['input']>;
};

export type ActionGroup = {
  __typename: 'ActionGroup';
  primary?: Maybe<ActionProperty>;
  secondary?: Maybe<ActionProperty>;
};

export type ActionGroupInput = {
  __kind: 'ActionGroupInput';
  primary?: InputMaybe<ActionPropertyInput>;
  secondary?: InputMaybe<ActionPropertyInput>;
};

export type ActionProperty = {
  __typename: 'ActionProperty';
  amount?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['ID']['output']>;
};

export type ActionPropertyInput = {
  __kind: 'ActionPropertyInput';
  amount?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
};

export type Ancestry = {
  __typename: 'Ancestry';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  options: Array<AncestryOption>;
};

export type AncestryInput = {
  __kind: 'AncestryInput';
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  options: Array<AncestryOptionInput>;
};

export type AncestryOption = {
  __typename: 'AncestryOption';
  desc?: Maybe<Scalars['String']['output']>;
  features?: Maybe<Array<Feature>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  systemId: Scalars['ID']['output'];
};

export type AncestryOptionConnection = {
  __typename: 'AncestryOptionConnection';
  items: Array<AncestryOption>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type AncestryOptionInput = {
  __kind: 'AncestryOptionInput';
  desc?: InputMaybe<Scalars['String']['input']>;
  features?: InputMaybe<Array<FeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId: Scalars['ID']['input'];
  systemId: Scalars['ID']['input'];
};

export type Background = {
  __typename: 'Background';
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Detail>>;
  equipment?: Maybe<Array<Array<Array<EquipmentOptionItem>>>>;
  features?: Maybe<Array<Feature>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  systemId: Scalars['ID']['output'];
};

export type BackgroundConnection = {
  __typename: 'BackgroundConnection';
  items: Array<BackgroundListItem>;
  metaData: BackgroundMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type BackgroundInput = {
  __kind: 'BackgroundInput';
  desc?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<Array<DetailInput>>;
  equipment?: InputMaybe<Array<Array<Array<EquipmentOptionItemInput>>>>;
  features?: InputMaybe<Array<FeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId: Scalars['ID']['input'];
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  systemId: Scalars['ID']['input'];
};

export type BackgroundListItem = {
  __typename: 'BackgroundListItem';
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Detail>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  systemId: Scalars['ID']['output'];
};

export type BackgroundMeta = {
  __typename: 'BackgroundMeta';
  features: Array<BackgroundMetaObject>;
};

export type BackgroundMetaObject = {
  __typename: 'BackgroundMetaObject';
  backgroundIds: Array<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

export type BackgroundStartingEquipment = {
  __typename: 'BackgroundStartingEquipment';
  addedToCharacter?: Maybe<Scalars['Boolean']['output']>;
  equipmentGroups?: Maybe<Array<StartingEquipmentGroup>>;
};

export type BackgroundStartingEquipmentInput = {
  __kind: 'BackgroundStartingEquipmentInput';
  addedToCharacter?: InputMaybe<Scalars['Boolean']['input']>;
  equipmentGroups?: InputMaybe<Array<StartingEquipmentGroupInput>>;
};

export type BatchAncestryOptionsInput = {
  __kind: 'BatchAncestryOptionsInput';
  data: AncestryOptionInput;
  tableName: Scalars['String']['input'];
};

export type BatchBackgroundsInput = {
  __kind: 'BatchBackgroundsInput';
  data: BackgroundInput;
  tableName: Scalars['String']['input'];
};

export type BatchClassesInput = {
  __kind: 'BatchClassesInput';
  data: ClassInput;
  tableName: Scalars['String']['input'];
};

export type BatchEquipmentInput = {
  __kind: 'BatchEquipmentInput';
  data: EquipmentInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatInput = {
  __kind: 'BatchFeatInput';
  data: FeatInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatureExpertisesInput = {
  __kind: 'BatchFeatureExpertisesInput';
  data: FeatureExpertiseInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatureFeatsInput = {
  __kind: 'BatchFeatureFeatsInput';
  data: FeatureFeatInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatureModifiersInput = {
  __kind: 'BatchFeatureModifiersInput';
  data: FeatureModifierInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatureOptionsInput = {
  __kind: 'BatchFeatureOptionsInput';
  data: FeatureOptionInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatureProficienciesInput = {
  __kind: 'BatchFeatureProficienciesInput';
  data: FeatureProficiencyInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatureSensesInput = {
  __kind: 'BatchFeatureSensesInput';
  data: FeatureSenseInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeatureSpellsInput = {
  __kind: 'BatchFeatureSpellsInput';
  data: FeatureSpellInput;
  tableName: Scalars['String']['input'];
};

export type BatchFeaturesInput = {
  __kind: 'BatchFeaturesInput';
  data: FeatureInput;
  tableName: Scalars['String']['input'];
};

export type BatchRacesInput = {
  __kind: 'BatchRacesInput';
  data: RaceInput;
  tableName: Scalars['String']['input'];
};

export type BatchSpellsInput = {
  __kind: 'BatchSpellsInput';
  data: SpellInput;
  tableName: Scalars['String']['input'];
};

export type BatchSystemsInput = {
  __kind: 'BatchSystemsInput';
  data: SystemInput;
  tableName: Scalars['String']['input'];
};

export type Capacity = {
  __typename: 'Capacity';
  amount?: Maybe<Scalars['Float']['output']>;
  unit: Scalars['ID']['output'];
};

export type CapacityInput = {
  __kind: 'CapacityInput';
  amount?: InputMaybe<Scalars['Float']['input']>;
  unit: Scalars['ID']['input'];
};

export type Character = {
  __typename: 'Character';
  abilities?: Maybe<CharacterAbilities>;
  advancement?: Maybe<Scalars['ID']['output']>;
  ancestry?: Maybe<CharacterAncestry>;
  background?: Maybe<Scalars['ID']['output']>;
  backgroundEquipment?: Maybe<BackgroundStartingEquipment>;
  classEquipment?: Maybe<ClassStartingEquipment>;
  classes?: Maybe<Array<CharacterClass>>;
  currencyGroups?: Maybe<Array<CurrencyGroup>>;
  desc?: Maybe<Scalars['String']['output']>;
  equipment?: Maybe<CharacterEquipment>;
  exp?: Maybe<Scalars['ID']['output']>;
  expertise?: Maybe<Array<CharacterExpertise>>;
  feats?: Maybe<Array<CharacterFeat>>;
  features?: Maybe<Array<CharacterFeature>>;
  hitpoint?: Maybe<CharacterHitpoint>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  modifiers?: Maybe<Array<CharacterModifier>>;
  ownerId: Scalars['ID']['output'];
  proficiencies?: Maybe<Array<CharacterProficiency>>;
  race?: Maybe<Scalars['ID']['output']>;
  senses?: Maybe<Array<CharacterSense>>;
  spellcasting?: Maybe<CharacterSpellcasting>;
  systemId: Scalars['String']['output'];
};

export type CharacterAbilities = {
  __typename: 'CharacterAbilities';
  manualRolled?: Maybe<ManualRolled>;
  pointBuy?: Maybe<PointBuy>;
  scores?: Maybe<Array<Scores>>;
  selectedSystem?: Maybe<Scalars['ID']['output']>;
  standardArray?: Maybe<Array<StandardArray>>;
};

export type CharacterAbilitiesInput = {
  __kind: 'CharacterAbilitiesInput';
  manualRolled?: InputMaybe<ManualRolledInput>;
  pointBuy?: InputMaybe<PointBuyInput>;
  scores?: InputMaybe<Array<ScoresInput>>;
  selectedSystem?: InputMaybe<Scalars['ID']['input']>;
  standardArray?: InputMaybe<Array<StandardArrayInput>>;
};

export type CharacterAncestry = {
  __typename: 'CharacterAncestry';
  id: Scalars['ID']['output'];
  lineages?: Maybe<Array<Scalars['ID']['output']>>;
  raceId: Scalars['ID']['output'];
};

export type CharacterAncestryInput = {
  __kind: 'CharacterAncestryInput';
  id: Scalars['ID']['input'];
  lineage?: InputMaybe<Array<LineageInput>>;
  raceId: Scalars['ID']['input'];
};

export type CharacterClass = {
  __typename: 'CharacterClass';
  id: Scalars['ID']['output'];
  level: Scalars['Int']['output'];
  subclass?: Maybe<Subclass>;
};

export type CharacterClassInput = {
  __kind: 'CharacterClassInput';
  id: Scalars['ID']['input'];
  level: Scalars['Int']['input'];
  subclass?: InputMaybe<SubclassInput>;
};

export type CharacterConnection = {
  __typename: 'CharacterConnection';
  items: Array<Character>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type CharacterCurrency = {
  __typename: 'CharacterCurrency';
  amount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
};

export type CharacterCurrencyInput = {
  __kind: 'CharacterCurrencyInput';
  amount: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
};

export type CharacterEquipment = {
  __typename: 'CharacterEquipment';
  attuned?: Maybe<Array<Scalars['ID']['output']>>;
  equipped?: Maybe<Array<Scalars['ID']['output']>>;
  inventory?: Maybe<Array<CharacterEquipmentObject>>;
};

export type CharacterEquipmentInput = {
  __kind: 'CharacterEquipmentInput';
  attuned?: InputMaybe<Array<Scalars['ID']['input']>>;
  equipped?: InputMaybe<Array<Scalars['ID']['input']>>;
  inventory?: InputMaybe<Array<CharacterEquipmentObjectInput>>;
};

export type CharacterEquipmentObject = {
  __typename: 'CharacterEquipmentObject';
  containerId?: Maybe<Scalars['ID']['output']>;
  containerPath?: Maybe<Scalars['String']['output']>;
  customName?: Maybe<Scalars['String']['output']>;
  equipmentId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  quantity: Scalars['Int']['output'];
};

export type CharacterEquipmentObjectInput = {
  __kind: 'CharacterEquipmentObjectInput';
  containerId?: InputMaybe<Scalars['ID']['input']>;
  containerPath?: InputMaybe<Scalars['String']['input']>;
  customName?: InputMaybe<Scalars['String']['input']>;
  equipmentId: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
  notes?: InputMaybe<Scalars['String']['input']>;
  quantity: Scalars['Int']['input'];
};

export type CharacterExpertise = {
  __typename: 'CharacterExpertise';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipment?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  language?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  property?: Maybe<Scalars['ID']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  saveAbility?: Maybe<Scalars['ID']['output']>;
  skill?: Maybe<Scalars['ID']['output']>;
};

export type CharacterExpertiseInput = {
  __kind: 'CharacterExpertiseInput';
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipment?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  language?: InputMaybe<Scalars['ID']['input']>;
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  property?: InputMaybe<Scalars['ID']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
  saveAbility?: InputMaybe<Scalars['ID']['input']>;
  skill?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterFeat = {
  __typename: 'CharacterFeat';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId: Scalars['ID']['output'];
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterFeatInput = {
  __kind: 'CharacterFeatInput';
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
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
  id: Scalars['ID']['output'];
  level?: Maybe<Scalars['Int']['output']>;
  options?: Maybe<Array<CharacterFeatureOption>>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterFeatureInput = {
  __kind: 'CharacterFeatureInput';
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  level?: InputMaybe<Scalars['Int']['input']>;
  options?: InputMaybe<Array<CharacterFeatureOptionInput>>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterFeatureOption = {
  __typename: 'CharacterFeatureOption';
  featureLevel: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  optionIndex: Scalars['String']['output'];
};

export type CharacterFeatureOptionInput = {
  __kind: 'CharacterFeatureOptionInput';
  featureLevel?: Scalars['Int']['input'];
  id: Scalars['ID']['input'];
  optionIndex: Scalars['String']['input'];
};

export type CharacterHitpoint = {
  __typename: 'CharacterHitpoint';
  bonus?: Maybe<Scalars['Int']['output']>;
  fixed?: Maybe<HitpointFixed>;
  maxHitpoints?: Maybe<Scalars['Int']['output']>;
  maxOverride?: Maybe<Scalars['Int']['output']>;
  method: Scalars['ID']['output'];
  rolled?: Maybe<HitpointRoll>;
  temp?: Maybe<Scalars['Int']['output']>;
};

export type CharacterHitpointInput = {
  __kind: 'CharacterHitpointInput';
  bonus?: InputMaybe<Scalars['Int']['input']>;
  fixed?: InputMaybe<HitpointFixedInput>;
  maxHitpoints?: InputMaybe<Scalars['Int']['input']>;
  maxOverride?: InputMaybe<Scalars['Int']['input']>;
  method: Scalars['ID']['input'];
  rolled?: InputMaybe<HitpointRollInput>;
  temp?: InputMaybe<Scalars['Int']['input']>;
};

export type CharacterInput = {
  __kind: 'CharacterInput';
  abilities?: InputMaybe<CharacterAbilitiesInput>;
  advancement?: InputMaybe<Scalars['ID']['input']>;
  ancestry?: InputMaybe<CharacterAncestryInput>;
  background?: InputMaybe<Scalars['ID']['input']>;
  backgroundEquipment?: InputMaybe<BackgroundStartingEquipmentInput>;
  classEquipment?: InputMaybe<ClassStartingEquipmentInput>;
  classes?: InputMaybe<Array<CharacterClassInput>>;
  currencyGroups?: InputMaybe<Array<CurrencyGroupInput>>;
  desc?: InputMaybe<Scalars['String']['input']>;
  equipment?: InputMaybe<CharacterEquipmentInput>;
  exp?: InputMaybe<Scalars['Int']['input']>;
  expertise?: InputMaybe<Array<CharacterExpertiseInput>>;
  feats?: InputMaybe<Array<CharacterFeatInput>>;
  features?: InputMaybe<Array<CharacterFeatureInput>>;
  hitpoint?: InputMaybe<CharacterHitpointInput>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  modifiers?: InputMaybe<Array<CharacterModifierInput>>;
  ownerId: Scalars['ID']['input'];
  proficiencies?: InputMaybe<Array<CharacterProficiencyInput>>;
  race?: InputMaybe<Scalars['ID']['input']>;
  senses?: InputMaybe<Array<CharacterSenseInput>>;
  spellcasting?: InputMaybe<CharacterSpellcastingInput>;
  systemId: Scalars['String']['input'];
};

export type CharacterModifier = {
  __typename: 'CharacterModifier';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterModifierInput = {
  __kind: 'CharacterModifierInput';
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterProficiency = {
  __typename: 'CharacterProficiency';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipment?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  language?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  property?: Maybe<Scalars['ID']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  saveAbility?: Maybe<Scalars['ID']['output']>;
  skill?: Maybe<Scalars['ID']['output']>;
};

export type CharacterProficiencyInput = {
  __kind: 'CharacterProficiencyInput';
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipment?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  language?: InputMaybe<Scalars['ID']['input']>;
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  property?: InputMaybe<Scalars['ID']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
  saveAbility?: InputMaybe<Scalars['ID']['input']>;
  skill?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterSense = {
  __typename: 'CharacterSense';
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  senseId: Scalars['ID']['output'];
};

export type CharacterSenseInput = {
  __kind: 'CharacterSenseInput';
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
  senseId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterSetting = {
  __typename: 'CharacterSetting';
  advancementMethods: Array<GenericType>;
  hitpointCalcMethods: Array<GenericType>;
  spellPointCalcMethods: Array<GenericType>;
  startingEquipmentOptions: Array<GenericType>;
};

export type CharacterSettingInput = {
  __kind: 'CharacterSettingInput';
  advancementMethods: Array<GenericTypeInput>;
  hitpointCalcMethods: Array<GenericTypeInput>;
  spellPointCalcMethods: Array<GenericTypeInput>;
  startingEquipmentOptions: Array<GenericTypeInput>;
};

export type CharacterSpell = {
  __typename: 'CharacterSpell';
  alwaysPrepared?: Maybe<Scalars['Boolean']['output']>;
  ancestryId?: Maybe<Scalars['ID']['output']>;
  backgroundId?: Maybe<Scalars['ID']['output']>;
  castAtLevel?: Maybe<Scalars['Boolean']['output']>;
  classId?: Maybe<Scalars['ID']['output']>;
  countAsKnown?: Maybe<Scalars['Boolean']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  isRitual?: Maybe<Scalars['Boolean']['output']>;
  level: Scalars['Int']['output'];
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  optionalAbility?: Maybe<Scalars['Boolean']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  requiresConcentration?: Maybe<Scalars['Boolean']['output']>;
  saveAbility?: Maybe<Scalars['ID']['output']>;
  usesSlot?: Maybe<Scalars['Boolean']['output']>;
};

export type CharacterSpellInput = {
  __kind: 'CharacterSpellInput';
  alwaysPrepared?: InputMaybe<Scalars['Boolean']['input']>;
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  castAtLevel?: InputMaybe<Scalars['Boolean']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  countAsKnown?: InputMaybe<Scalars['Boolean']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  isRitual?: InputMaybe<Scalars['Boolean']['input']>;
  level?: Scalars['Int']['input'];
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  optionalAbility?: InputMaybe<Scalars['Boolean']['input']>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
  requiresConcentration?: InputMaybe<Scalars['Boolean']['input']>;
  saveAbility?: InputMaybe<Scalars['ID']['input']>;
  usesSlot?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CharacterSpellSlots = {
  __typename: 'CharacterSpellSlots';
  classId: Scalars['ID']['output'];
  level: Scalars['Int']['output'];
  used: Scalars['Int']['output'];
};

export type CharacterSpellSlotsInput = {
  __kind: 'CharacterSpellSlotsInput';
  classId: Scalars['ID']['input'];
  level: Scalars['Int']['input'];
  used: Scalars['Int']['input'];
};

export type CharacterSpellcasting = {
  __typename: 'CharacterSpellcasting';
  additional?: Maybe<Array<CharacterSpell>>;
  known?: Maybe<Array<ClassSpellList>>;
  prepared?: Maybe<Array<ClassSpellList>>;
  spellSlots?: Maybe<Array<CharacterSpellSlots>>;
};

export type CharacterSpellcastingInput = {
  __kind: 'CharacterSpellcastingInput';
  additional?: InputMaybe<Array<CharacterSpellInput>>;
  known?: InputMaybe<Array<ClassSpellListInput>>;
  prepared?: InputMaybe<Array<ClassSpellListInput>>;
  spellSlots?: InputMaybe<Array<CharacterSpellSlotsInput>>;
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
  usesPerLevel?: Maybe<Array<UsesPerLevel>>;
};

export type ChargeInput = {
  __kind: 'ChargeInput';
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
  classes?: Maybe<Array<ClassesEnum>>;
  damage?: Maybe<Array<DamageEnum>>;
  equipment?: Maybe<Array<EquipmentEnum>>;
  feats?: Maybe<Array<FeatEnum>>;
  features?: Maybe<Array<FeatureEnum>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  sections?: Maybe<Array<SectionEnum>>;
  spells?: Maybe<Array<SpellEnum>>;
};

export type ChargeOptionInput = {
  __kind: 'ChargeOptionInput';
  classes?: InputMaybe<Array<ClassesEnumInput>>;
  damage?: InputMaybe<Array<DamageEnumInput>>;
  equipment?: InputMaybe<Array<EquipmentEnumInput>>;
  feats?: InputMaybe<Array<FeatEnumInput>>;
  features?: InputMaybe<Array<FeatureEnumInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<SectionEnumInput>>;
  spells?: InputMaybe<Array<SpellEnumInput>>;
};

export type Class = {
  __typename: 'Class';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category: Scalars['ID']['output'];
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Detail>>;
  equipment?: Maybe<Array<Array<Array<EquipmentOptionItem>>>>;
  features?: Maybe<Array<Feature>>;
  hitpoint?: Maybe<Hitpoint>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAttributes?: Maybe<Array<LevelAttribute>>;
  masterId?: Maybe<Scalars['String']['output']>;
  multiclass?: Maybe<Multiclass>;
  ownerId: Scalars['ID']['output'];
  parentClass?: Maybe<Scalars['ID']['output']>;
  proficiencies?: Maybe<Array<ClassProficiency>>;
  resource?: Maybe<Resource>;
  spellcasting?: Maybe<Spellcasting>;
  startingGold?: Maybe<StartingGold>;
  subtypes?: Maybe<Array<Subtype>>;
  systemId: Scalars['ID']['output'];
};

export type ClassConnection = {
  __typename: 'ClassConnection';
  items: Array<ClassListItem>;
  metaData: ClassMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type ClassFilter = {
  __typename: 'ClassFilter';
  count: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
};

export type ClassInput = {
  __kind: 'ClassInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category: Scalars['ID']['input'];
  desc?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<Array<DetailInput>>;
  equipment?: InputMaybe<Array<Array<Array<EquipmentOptionItemInput>>>>;
  features?: InputMaybe<Array<FeatureInput>>;
  hitpoint?: InputMaybe<HitpointInput>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  levelAttributes?: InputMaybe<Array<LevelAttributeInput>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  multiclass?: InputMaybe<MulticlassInput>;
  ownerId: Scalars['ID']['input'];
  parentClass?: InputMaybe<Scalars['ID']['input']>;
  proficiencies?: InputMaybe<Array<ClassProficiencyInput>>;
  resource?: InputMaybe<ResourceInput>;
  spellcasting?: InputMaybe<SpellcastingInput>;
  startingGold?: InputMaybe<StartingGoldInput>;
  subtypes?: InputMaybe<Array<SubtypeInput>>;
  systemId: Scalars['ID']['input'];
};

export type ClassListItem = {
  __typename: 'ClassListItem';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  systemId: Scalars['ID']['output'];
};

export type ClassMeta = {
  __typename: 'ClassMeta';
  categories: Array<ClassMetaObject>;
  features: Array<ClassMetaObject>;
  optionalAbilities: Array<ClassMultiClassMetaObject>;
  parentClasses: Array<ClassMetaObject>;
  primaryAbilities: Array<ClassMultiClassMetaObject>;
  secondaryAbilities: Array<ClassMultiClassMetaObject>;
};

export type ClassMetaObject = {
  __typename: 'ClassMetaObject';
  classIds: Array<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

export type ClassMultiClassMetaObject = {
  __typename: 'ClassMultiClassMetaObject';
  amount?: Maybe<Scalars['Int']['output']>;
  classIds: Array<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

export type ClassProficiency = {
  __typename: 'ClassProficiency';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category: Scalars['ID']['output'];
  equipment?: Maybe<ProficiencyProperties>;
  id: Scalars['ID']['output'];
  languages?: Maybe<Array<Scalars['ID']['output']>>;
  level: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  properties?: Maybe<ProficiencyProperties>;
  rounding?: Maybe<Scalars['ID']['output']>;
  saveAbilities?: Maybe<Array<Scalars['ID']['output']>>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  skills?: Maybe<Array<Scalars['ID']['output']>>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type ClassProficiencyInput = {
  __kind: 'ClassProficiencyInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category: Scalars['ID']['input'];
  equipment?: InputMaybe<ProficiencyPropertiesInput>;
  id: Scalars['ID']['input'];
  languages?: InputMaybe<Array<Scalars['ID']['input']>>;
  level: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  properties?: InputMaybe<ProficiencyPropertiesInput>;
  rounding?: InputMaybe<Scalars['ID']['input']>;
  saveAbilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<Scalars['ID']['input']>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
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
  __kind: 'ClassSpellInput';
  ability?: InputMaybe<Scalars['ID']['input']>;
  alwaysPrepared?: InputMaybe<Scalars['Boolean']['input']>;
  castAtLevel?: InputMaybe<Scalars['Boolean']['input']>;
  classId: Scalars['ID']['input'];
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
  spells?: Maybe<Array<ClassSpell>>;
};

export type ClassSpellListInput = {
  __kind: 'ClassSpellListInput';
  level: Scalars['Int']['input'];
  spells?: InputMaybe<Array<ClassSpellInput>>;
};

export type ClassStartingEquipment = {
  __typename: 'ClassStartingEquipment';
  addedToCharacter?: Maybe<Scalars['Boolean']['output']>;
  equipmentGroups?: Maybe<Array<StartingEquipmentGroup>>;
  goldOption?: Maybe<Scalars['ID']['output']>;
  option: Scalars['ID']['output'];
  totalGold?: Maybe<Scalars['Int']['output']>;
};

export type ClassStartingEquipmentInput = {
  __kind: 'ClassStartingEquipmentInput';
  addedToCharacter?: InputMaybe<Scalars['Boolean']['input']>;
  equipmentGroups?: InputMaybe<Array<StartingEquipmentGroupInput>>;
  goldOption?: InputMaybe<Scalars['ID']['input']>;
  option: Scalars['ID']['input'];
  totalGold?: InputMaybe<Scalars['Int']['input']>;
};

export enum ClassesEnum {
  ALL = 'ALL',
  BASE = 'BASE',
  PREPARE_LIMIT = 'PREPARE_LIMIT',
  RESOURCE = 'RESOURCE',
  SPELLCASTER = 'SPELLCASTER',
  SUBCLASS = 'SUBCLASS'
}

export enum ClassesEnumInput {
  ALL = 'ALL',
  BASE = 'BASE',
  PREPARE_LIMIT = 'PREPARE_LIMIT',
  RESOURCE = 'RESOURCE',
  SPELLCASTER = 'SPELLCASTER',
  SUBCLASS = 'SUBCLASS'
}

export type Contains = {
  __typename: 'Contains';
  id: Scalars['ID']['output'];
  quantity: Scalars['Int']['output'];
};

export type ContainsInput = {
  __kind: 'ContainsInput';
  id: Scalars['ID']['input'];
  quantity: Scalars['Int']['input'];
};

export type Cost = {
  __typename: 'Cost';
  amount?: Maybe<Scalars['Int']['output']>;
  currency: Scalars['ID']['output'];
};

export type CostInput = {
  __kind: 'CostInput';
  amount?: InputMaybe<Scalars['Int']['input']>;
  currency: Scalars['ID']['input'];
};

export type Currency = {
  __typename: 'Currency';
  abbreviation: Scalars['String']['output'];
  conversions: CurrencyConversion;
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
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
  __kind: 'CurrencyConversionInput';
  copper?: Scalars['Float']['input'];
  electrum?: Scalars['Float']['input'];
  gold?: Scalars['Float']['input'];
  platinum?: Scalars['Float']['input'];
  silver?: Scalars['Float']['input'];
};

export type CurrencyGroup = {
  __typename: 'CurrencyGroup';
  container?: Maybe<Scalars['ID']['output']>;
  currencies?: Maybe<Array<CharacterCurrency>>;
};

export type CurrencyGroupInput = {
  __kind: 'CurrencyGroupInput';
  container?: InputMaybe<Scalars['ID']['input']>;
  currencies?: InputMaybe<Array<CharacterCurrencyInput>>;
};

export type CurrencyInput = {
  __kind: 'CurrencyInput';
  abbreviation: Scalars['String']['input'];
  conversions: CurrencyConversionInput;
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
};

export type Damage = {
  __typename: 'Damage';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  bonus?: Maybe<DamageFields>;
  damageSave?: Maybe<Array<Scalars['ID']['output']>>;
  diePerLevel?: Maybe<Array<DiePerLevel>>;
  primary?: Maybe<DamageFields>;
  secondary?: Maybe<DamageFields>;
  setPerLevel?: Maybe<Array<SetPerLevel>>;
  versatile?: Maybe<DamageFields>;
};

export enum DamageEnum {
  ALL = 'ALL',
  BONUS = 'BONUS',
  EQUIPMENT = 'EQUIPMENT',
  MAIN = 'MAIN',
  POOL = 'POOL'
}

export enum DamageEnumInput {
  ALL = 'ALL',
  BONUS = 'BONUS',
  EQUIPMENT = 'EQUIPMENT',
  MAIN = 'MAIN',
  POOL = 'POOL'
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
  __kind: 'DamageFieldsInput';
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
  __kind: 'DamageInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  bonus?: InputMaybe<DamageFieldsInput>;
  damageSave?: InputMaybe<Array<Scalars['ID']['input']>>;
  diePerLevel?: InputMaybe<Array<DiePerLevelInput>>;
  primary?: InputMaybe<DamageFieldsInput>;
  secondary?: InputMaybe<DamageFieldsInput>;
  setPerLevel?: InputMaybe<Array<SetPerLevelInput>>;
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
  __kind: 'DamagePoolInput';
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
};

export type DetailInput = {
  __kind: 'DetailInput';
  desc?: InputMaybe<Scalars['String']['input']>;
  label: Scalars['String']['input'];
};

export type DiePerLevel = {
  __typename: 'DiePerLevel';
  bonus?: Maybe<DamageFields>;
  level?: Maybe<Scalars['String']['output']>;
  primary?: Maybe<DamageFields>;
  secondary?: Maybe<DamageFields>;
};

export type DiePerLevelInput = {
  __kind: 'DiePerLevelInput';
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
  __kind: 'DistributedInput';
  ability: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
};

export type Duration = {
  __typename: 'Duration';
  amount?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
};

export type DurationInput = {
  __kind: 'DurationInput';
  amount?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};

export type EquipPrerequisite = {
  __typename: 'EquipPrerequisite';
  category?: Maybe<Scalars['ID']['output']>;
  equipment?: Maybe<Array<Scalars['ID']['output']>>;
  numberEquipped?: Maybe<Scalars['Int']['output']>;
  properties?: Maybe<Array<Scalars['ID']['output']>>;
};

export type EquipPrerequisiteInput = {
  __kind: 'EquipPrerequisiteInput';
  category?: InputMaybe<Scalars['ID']['input']>;
  equipment?: InputMaybe<Array<Scalars['ID']['input']>>;
  numberEquipped?: InputMaybe<Scalars['Int']['input']>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type EquipementCostMeta = {
  __typename: 'EquipementCostMeta';
  amount?: Maybe<Scalars['Int']['output']>;
  equipmentIds: Array<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

export type Equipment = {
  __typename: 'Equipment';
  armorClass?: Maybe<Scalars['Int']['output']>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  capacity?: Maybe<Capacity>;
  category: Scalars['ID']['output'];
  contains?: Maybe<Array<Contains>>;
  cost?: Maybe<Cost>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  features?: Maybe<Array<Feature>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  maxBonus?: Maybe<Scalars['Int']['output']>;
  maxStack?: Maybe<Scalars['Int']['output']>;
  optionalAbility?: Maybe<Scalars['ID']['output']>;
  ownerId: Scalars['ID']['output'];
  prerequisities?: Maybe<Prerequisite>;
  primaryAbility?: Maybe<Scalars['ID']['output']>;
  properties?: Maybe<Array<Scalars['ID']['output']>>;
  quantity: Scalars['Int']['output'];
  quote?: Maybe<Scalars['String']['output']>;
  range?: Maybe<EquipmentRange>;
  rank?: Maybe<Scalars['Int']['output']>;
  rarity: Scalars['ID']['output'];
  saveAbility?: Maybe<SaveAbility>;
  secondaryAbility?: Maybe<Scalars['ID']['output']>;
  speed?: Maybe<Speed>;
  systemId: Scalars['ID']['output'];
  weight?: Maybe<Weight>;
};

export type EquipmentCategoryProperty = {
  __typename: 'EquipmentCategoryProperty';
  categoryId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  propertyId: Scalars['ID']['output'];
};

export type EquipmentCategoryPropertyInput = {
  __kind: 'EquipmentCategoryPropertyInput';
  categoryId: Scalars['ID']['input'];
  id: Scalars['ID']['input'];
  propertyId: Scalars['ID']['input'];
};

export type EquipmentConnection = {
  __typename: 'EquipmentConnection';
  items: Array<EquipmentListItem>;
  metaData: EquipmentMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type EquipmentCurrency = {
  __typename: 'EquipmentCurrency';
  amount?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
};

export type EquipmentCurrencyInput = {
  __kind: 'EquipmentCurrencyInput';
  amount?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};

export enum EquipmentEnum {
  ADVENTURING_GEAR = 'ADVENTURING_GEAR',
  ALL = 'ALL',
  ARMOR = 'ARMOR',
  BACKGROUND = 'BACKGROUND',
  CLASS = 'CLASS',
  SHIELD = 'SHIELD',
  TOOL = 'TOOL',
  WEAPON = 'WEAPON'
}

export enum EquipmentEnumInput {
  ADVENTURING_GEAR = 'ADVENTURING_GEAR',
  ALL = 'ALL',
  ARMOR = 'ARMOR',
  BACKGROUND = 'BACKGROUND',
  CLASS = 'CLASS',
  SHIELD = 'SHIELD',
  TOOL = 'TOOL',
  WEAPON = 'WEAPON'
}

export type EquipmentInput = {
  __kind: 'EquipmentInput';
  armorClass?: InputMaybe<Scalars['Int']['input']>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  capacity?: InputMaybe<CapacityInput>;
  category: Scalars['ID']['input'];
  contains?: InputMaybe<Array<ContainsInput>>;
  cost: CostInput;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  features?: InputMaybe<Array<FeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  maxBonus?: InputMaybe<Scalars['Int']['input']>;
  maxStack?: InputMaybe<Scalars['Int']['input']>;
  optionalAbility?: InputMaybe<Scalars['ID']['input']>;
  ownerId: Scalars['ID']['input'];
  prerequisities?: InputMaybe<PrerequisiteInput>;
  primaryAbility?: InputMaybe<Scalars['ID']['input']>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
  quantity: Scalars['Int']['input'];
  quote?: InputMaybe<Scalars['String']['input']>;
  range?: InputMaybe<EquipmentRangeInput>;
  rank?: InputMaybe<Scalars['Int']['input']>;
  rarity: Scalars['ID']['input'];
  saveAbility?: InputMaybe<SaveAbilityInput>;
  secondaryAbility?: InputMaybe<Scalars['ID']['input']>;
  speed?: InputMaybe<SpeedInput>;
  systemId: Scalars['ID']['input'];
  weight: WeightInput;
};

export type EquipmentListItem = {
  __typename: 'EquipmentListItem';
  cost?: Maybe<Cost>;
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  quote?: Maybe<Scalars['String']['output']>;
  rank?: Maybe<Scalars['Int']['output']>;
  systemId: Scalars['ID']['output'];
  weight?: Maybe<Weight>;
};

export type EquipmentMeta = {
  __typename: 'EquipmentMeta';
  armorClasses: Array<EquipmentMetaObject>;
  categories: Array<EquipmentMetaObject>;
  cost: Array<EquipementCostMeta>;
  features: Array<EquipmentMetaObject>;
  primaryDamages: Array<EquipmentMetaObject>;
  properties: Array<EquipmentMetaObject>;
  secondaryDamages: Array<EquipmentMetaObject>;
  versatileDamages: Array<EquipmentMetaObject>;
  weight: Array<EquipmentWeightMeta>;
};

export type EquipmentMetaObject = {
  __typename: 'EquipmentMetaObject';
  equipmentIds: Array<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

export type EquipmentOptionItem = {
  __typename: 'EquipmentOptionItem';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category?: Maybe<Scalars['ID']['output']>;
  currencies?: Maybe<Array<EquipmentCurrency>>;
  equipment?: Maybe<Array<Scalars['ID']['output']>>;
  properties?: Maybe<Array<Scalars['ID']['output']>>;
  quantity?: Maybe<Scalars['Int']['output']>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
};

export type EquipmentOptionItemInput = {
  __kind: 'EquipmentOptionItemInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  currencies?: InputMaybe<Array<EquipmentCurrencyInput>>;
  equipment?: InputMaybe<Array<Scalars['ID']['input']>>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
};

export type EquipmentRange = {
  __typename: 'EquipmentRange';
  maxRange?: Maybe<Scalars['Int']['output']>;
  minRange?: Maybe<Scalars['Int']['output']>;
  unit: Scalars['ID']['output'];
};

export type EquipmentRangeInput = {
  __kind: 'EquipmentRangeInput';
  maxRange?: InputMaybe<Scalars['Int']['input']>;
  minRange?: InputMaybe<Scalars['Int']['input']>;
  unit: Scalars['ID']['input'];
};

export type EquipmentWeightMeta = {
  __typename: 'EquipmentWeightMeta';
  amount?: Maybe<Scalars['Float']['output']>;
  equipmentIds: Array<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

export type Feat = {
  __typename: 'Feat';
  actions?: Maybe<ActionGroup>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<FeatureExpertise>>;
  features?: Maybe<Array<Feature>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAvailable?: Maybe<Scalars['String']['output']>;
  masterId?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<FeatureModifier>>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  senses?: Maybe<Array<FeatureSense>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<FeatureSpell>>;
  systemId: Scalars['ID']['output'];
  targets?: Maybe<Scalars['Int']['output']>;
};

export type FeatConnection = {
  __typename: 'FeatConnection';
  items: Array<FeatListItem>;
  metaData: FeatMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export enum FeatEnum {
  ALL = 'ALL'
}

export enum FeatEnumInput {
  ALL = 'ALL'
}

export type FeatInput = {
  __kind: 'FeatInput';
  actions?: InputMaybe<ActionGroupInput>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<FeatureExpertiseInput>>;
  features?: InputMaybe<Array<FeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<FeatureModifierInput>>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  senses?: InputMaybe<Array<FeatureSenseInput>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<FeatureSpellInput>>;
  systemId: Scalars['ID']['input'];
  targets?: InputMaybe<Scalars['Int']['input']>;
};

export type FeatListItem = {
  __typename: 'FeatListItem';
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  systemId: Scalars['ID']['output'];
};

export type FeatMeta = {
  __typename: 'FeatMeta';
  features: Array<FeatMetaObject>;
};

export type FeatMetaObject = {
  __typename: 'FeatMetaObject';
  featIds: Array<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
};

export type Feature = {
  __typename: 'Feature';
  actions?: Maybe<ActionGroup>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<FeatureExpertise>>;
  feats?: Maybe<Array<FeatureFeat>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAvailable?: Maybe<Scalars['String']['output']>;
  masterId?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<FeatureModifier>>;
  options?: Maybe<Array<FeatureOption>>;
  optionsByLevel?: Maybe<Array<OptionsByLevel>>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  senses?: Maybe<Array<FeatureSense>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<FeatureSpell>>;
  systemId: Scalars['ID']['output'];
  targets?: Maybe<Scalars['Int']['output']>;
};

export type FeatureConnection = {
  __typename: 'FeatureConnection';
  items: Array<FeatureListItem>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export enum FeatureEnum {
  ALL = 'ALL',
  EQUIPMENT = 'EQUIPMENT',
  FEATURE = 'FEATURE',
  OPTION = 'OPTION',
  SAVE_ABILITY = 'SAVE_ABILITY'
}

export enum FeatureEnumInput {
  ALL = 'ALL',
  EQUIPMENT = 'EQUIPMENT',
  FEATURE = 'FEATURE',
  OPTION = 'OPTION',
  SAVE_ABILITY = 'SAVE_ABILITY'
}

export type FeatureExpertise = {
  __typename: 'FeatureExpertise';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category: Scalars['ID']['output'];
  equipment?: Maybe<ProficiencyProperties>;
  id: Scalars['ID']['output'];
  languages?: Maybe<Array<Scalars['ID']['output']>>;
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  properties?: Maybe<ProficiencyProperties>;
  saveAbilities?: Maybe<Array<Scalars['ID']['output']>>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  skills?: Maybe<Array<Scalars['ID']['output']>>;
  subtype?: Maybe<Scalars['ID']['output']>;
  systemId: Scalars['ID']['output'];
};

export type FeatureExpertiseConnection = {
  __typename: 'FeatureExpertiseConnection';
  items: Array<FeatureExpertise>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureExpertiseInput = {
  __kind: 'FeatureExpertiseInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category: Scalars['ID']['input'];
  equipment?: InputMaybe<ProficiencyPropertiesInput>;
  id: Scalars['ID']['input'];
  languages?: InputMaybe<Array<Scalars['ID']['input']>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  properties?: InputMaybe<ProficiencyPropertiesInput>;
  saveAbilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<Scalars['ID']['input']>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
  systemId: Scalars['ID']['input'];
};

export type FeatureFeat = {
  __typename: 'FeatureFeat';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  feats?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
  systemId: Scalars['ID']['output'];
};

export type FeatureFeatConnection = {
  __typename: 'FeatureFeatConnection';
  items: Array<FeatureFeat>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureFeatInput = {
  __kind: 'FeatureFeatInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  feats?: InputMaybe<Array<Scalars['ID']['input']>>;
  id: Scalars['ID']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
  systemId: Scalars['ID']['input'];
};

export type FeatureInput = {
  __kind: 'FeatureInput';
  actions?: InputMaybe<ActionGroupInput>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<FeatureExpertiseInput>>;
  feats?: InputMaybe<Array<FeatureFeatInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<FeatureModifierInput>>;
  options?: InputMaybe<Array<FeatureOptionInput>>;
  optionsByLevel?: InputMaybe<Array<OptionsByLevelInput>>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  senses?: InputMaybe<Array<FeatureSenseInput>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<FeatureSpellInput>>;
  systemId: Scalars['ID']['input'];
  targets?: InputMaybe<Scalars['Int']['input']>;
};

export type FeatureListItem = {
  __typename: 'FeatureListItem';
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  systemId: Scalars['ID']['output'];
};

export type FeatureModifier = {
  __typename: 'FeatureModifier';
  abilities?: Maybe<Array<Scalars['ID']['output']>>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  conditions?: Maybe<Array<Scalars['ID']['output']>>;
  damageType?: Maybe<Scalars['ID']['output']>;
  damageTypes?: Maybe<Array<Scalars['ID']['output']>>;
  dieConfig?: Maybe<Scalars['String']['output']>;
  diePerLevel?: Maybe<Array<ModifierDiePerLevel>>;
  duration?: Maybe<Scalars['ID']['output']>;
  feature?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  maxAmount?: Maybe<Scalars['Int']['output']>;
  maxRange?: Maybe<Scalars['Int']['output']>;
  method?: Maybe<Scalars['ID']['output']>;
  methodAbility?: Maybe<Scalars['ID']['output']>;
  methodSkill?: Maybe<Scalars['ID']['output']>;
  minAmount?: Maybe<Scalars['Int']['output']>;
  minRange?: Maybe<Scalars['Int']['output']>;
  multiplier?: Maybe<Scalars['Int']['output']>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  range?: Maybe<Scalars['ID']['output']>;
  saveAbilities?: Maybe<Array<Scalars['ID']['output']>>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  setAmount?: Maybe<Scalars['Int']['output']>;
  setPerLevel?: Maybe<Array<ModifierSetPerLevel>>;
  shape?: Maybe<Scalars['ID']['output']>;
  size?: Maybe<Scalars['Int']['output']>;
  skills?: Maybe<Array<Scalars['ID']['output']>>;
  speeds?: Maybe<Array<Scalars['ID']['output']>>;
  spell?: Maybe<Scalars['ID']['output']>;
  spellCategory?: Maybe<Scalars['ID']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
  systemId: Scalars['ID']['output'];
  type?: Maybe<Scalars['ID']['output']>;
  unit?: Maybe<Scalars['ID']['output']>;
};

export type FeatureModifierConnection = {
  __typename: 'FeatureModifierConnection';
  items: Array<FeatureModifier>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureModifierInput = {
  __kind: 'FeatureModifierInput';
  abilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  conditions?: InputMaybe<Array<Scalars['ID']['input']>>;
  damageType?: InputMaybe<Scalars['ID']['input']>;
  damageTypes?: InputMaybe<Array<Scalars['ID']['input']>>;
  dieConfig?: InputMaybe<Scalars['String']['input']>;
  diePerLevel?: InputMaybe<Array<ModifierDiePerLevelInput>>;
  duration?: InputMaybe<Scalars['ID']['input']>;
  feature?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  maxAmount?: InputMaybe<Scalars['Int']['input']>;
  maxRange?: InputMaybe<Scalars['Int']['input']>;
  method?: InputMaybe<Scalars['ID']['input']>;
  methodAbility?: InputMaybe<Scalars['ID']['input']>;
  methodSkill?: InputMaybe<Scalars['ID']['input']>;
  minAmount?: InputMaybe<Scalars['Int']['input']>;
  minRange?: InputMaybe<Scalars['Int']['input']>;
  multiplier?: InputMaybe<Scalars['Int']['input']>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  range?: InputMaybe<Scalars['ID']['input']>;
  saveAbilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  setAmount?: InputMaybe<Scalars['Int']['input']>;
  setPerLevel?: InputMaybe<Array<ModifierSetPerLevelInput>>;
  shape?: InputMaybe<Scalars['ID']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<Scalars['ID']['input']>>;
  speeds?: InputMaybe<Array<Scalars['ID']['input']>>;
  spellCategory?: InputMaybe<Scalars['ID']['input']>;
  spells?: InputMaybe<Scalars['ID']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
  systemId: Scalars['ID']['input'];
  type?: InputMaybe<Scalars['ID']['input']>;
  unit?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureOption = {
  __typename: 'FeatureOption';
  actions?: Maybe<ActionGroup>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<FeatureExpertise>>;
  feats?: Maybe<Array<FeatureFeat>>;
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  levelAvailable?: Maybe<Scalars['String']['output']>;
  masterId?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<FeatureModifier>>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  senses?: Maybe<Array<FeatureSense>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<FeatureSpell>>;
  systemId: Scalars['ID']['output'];
  targets?: Maybe<Scalars['Int']['output']>;
};

export type FeatureOptionConnection = {
  __typename: 'FeatureOptionConnection';
  items: Array<FeatureOption>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureOptionInput = {
  __kind: 'FeatureOptionInput';
  actions?: InputMaybe<ActionGroupInput>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<FeatureExpertiseInput>>;
  feats?: InputMaybe<Array<FeatureFeatInput>>;
  id: Scalars['ID']['input'];
  label?: InputMaybe<Scalars['String']['input']>;
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<FeatureModifierInput>>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  senses?: InputMaybe<Array<FeatureSenseInput>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<FeatureSpellInput>>;
  systemId: Scalars['ID']['input'];
  targets?: InputMaybe<Scalars['Int']['input']>;
};

export type FeatureProficiency = {
  __typename: 'FeatureProficiency';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category: Scalars['ID']['output'];
  equipment?: Maybe<ProficiencyProperties>;
  id: Scalars['ID']['output'];
  languages?: Maybe<Array<Scalars['ID']['output']>>;
  level: Scalars['ID']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  properties?: Maybe<ProficiencyProperties>;
  rounding?: Maybe<Scalars['ID']['output']>;
  saveAbilities?: Maybe<Array<Scalars['ID']['output']>>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  skills?: Maybe<Array<Scalars['ID']['output']>>;
  subtype?: Maybe<Scalars['ID']['output']>;
  systemId: Scalars['ID']['output'];
};

export type FeatureProficiencyConnection = {
  __typename: 'FeatureProficiencyConnection';
  items: Array<FeatureProficiency>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureProficiencyInput = {
  __kind: 'FeatureProficiencyInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category: Scalars['ID']['input'];
  equipment?: InputMaybe<ProficiencyPropertiesInput>;
  id: Scalars['ID']['input'];
  languages?: InputMaybe<Array<Scalars['ID']['input']>>;
  level?: InputMaybe<Scalars['ID']['input']>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  properties?: InputMaybe<ProficiencyPropertiesInput>;
  rounding?: InputMaybe<Scalars['ID']['input']>;
  saveAbilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<Scalars['ID']['input']>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
  systemId: Scalars['ID']['input'];
};

export type FeatureSense = {
  __typename: 'FeatureSense';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
  systemId: Scalars['ID']['output'];
};

export type FeatureSenseConnection = {
  __typename: 'FeatureSenseConnection';
  items: Array<FeatureSense>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureSenseInput = {
  __kind: 'FeatureSenseInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  charges?: InputMaybe<ChargeInput>;
  id: Scalars['ID']['input'];
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
  systemId: Scalars['ID']['input'];
};

export type FeatureSpell = {
  __typename: 'FeatureSpell';
  ability?: Maybe<Scalars['ID']['output']>;
  attributeLimit?: Maybe<Array<Scalars['ID']['output']>>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  charges?: Maybe<Charge>;
  classLimit?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  levelLimit?: Maybe<Array<Scalars['String']['output']>>;
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  spellLevel?: Maybe<Scalars['Int']['output']>;
  spellsByLevel?: Maybe<Array<SpellsByLevel>>;
  subtype?: Maybe<Scalars['ID']['output']>;
  systemId: Scalars['ID']['output'];
};

export type FeatureSpellConnection = {
  __typename: 'FeatureSpellConnection';
  items: Array<FeatureSpell>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type FeatureSpellInput = {
  __kind: 'FeatureSpellInput';
  ability?: InputMaybe<Scalars['ID']['input']>;
  attributeLimit?: InputMaybe<Array<Scalars['ID']['input']>>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  charges?: InputMaybe<ChargeInput>;
  classLimit?: InputMaybe<Array<Scalars['ID']['input']>>;
  id: Scalars['ID']['input'];
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  levelLimit?: InputMaybe<Array<Scalars['String']['input']>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  spellLevel?: InputMaybe<Scalars['Int']['input']>;
  spellsByLevel?: InputMaybe<Array<SpellsByLevelInput>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
  systemId: Scalars['ID']['input'];
};

export type GenerateOption = {
  __typename: 'GenerateOption';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  reduce?: Maybe<Scalars['Int']['output']>;
};

export type GenerateOptionInput = {
  __kind: 'GenerateOptionInput';
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  reduce?: InputMaybe<Scalars['Int']['input']>;
};

export type GenericType = {
  __typename: 'GenericType';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  short?: Maybe<Scalars['String']['output']>;
  tooltip?: Maybe<Scalars['String']['output']>;
};

export type GenericTypeInput = {
  __kind: 'GenericTypeInput';
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  short?: InputMaybe<Scalars['String']['input']>;
  tooltip?: InputMaybe<Scalars['String']['input']>;
};

export type Hitpoint = {
  __typename: 'Hitpoint';
  ability?: Maybe<Scalars['ID']['output']>;
  dieConfig?: Maybe<Scalars['String']['output']>;
};

export type HitpointFixed = {
  __typename: 'HitpointFixed';
  current?: Maybe<Scalars['Int']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
};

export type HitpointFixedInput = {
  __kind: 'HitpointFixedInput';
  current?: InputMaybe<Scalars['Int']['input']>;
  total?: InputMaybe<Scalars['Int']['input']>;
};

export type HitpointInput = {
  __kind: 'HitpointInput';
  ability: Scalars['ID']['input'];
  dieConfig?: InputMaybe<Scalars['String']['input']>;
};

export type HitpointRoll = {
  __typename: 'HitpointRoll';
  current?: Maybe<Scalars['Int']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
  values?: Maybe<Array<HitpointRollValues>>;
};

export type HitpointRollInput = {
  __kind: 'HitpointRollInput';
  current?: InputMaybe<Scalars['Int']['input']>;
  total?: InputMaybe<Scalars['Int']['input']>;
  values?: InputMaybe<Array<HitpointRollValuesInput>>;
};

export type HitpointRollValues = {
  __typename: 'HitpointRollValues';
  level: Scalars['Int']['output'];
  value: Scalars['Int']['output'];
};

export type HitpointRollValuesInput = {
  __kind: 'HitpointRollValuesInput';
  level: Scalars['Int']['input'];
  value: Scalars['Int']['input'];
};

export type Imperial = {
  __typename: 'Imperial';
  length: Array<GenericType>;
  volume: Array<GenericType>;
  weight: Array<GenericType>;
};

export type ImperialInput = {
  __kind: 'ImperialInput';
  length: Array<GenericTypeInput>;
  volume: Array<GenericTypeInput>;
  weight: Array<GenericTypeInput>;
};

export type LevelAttribute = {
  __typename: 'LevelAttribute';
  cantripsKnownLimit?: Maybe<Scalars['Int']['output']>;
  level?: Maybe<Scalars['Int']['output']>;
  resourcePoints?: Maybe<Scalars['Int']['output']>;
  spellSlots?: Maybe<Array<SpellSlot>>;
  spellsKnownLimit?: Maybe<Scalars['Int']['output']>;
};

export type LevelAttributeInput = {
  __kind: 'LevelAttributeInput';
  cantripsKnownLimit?: InputMaybe<Scalars['Int']['input']>;
  level?: InputMaybe<Scalars['Int']['input']>;
  resourcePoints?: InputMaybe<Scalars['Int']['input']>;
  spellSlots?: InputMaybe<Array<SpellSlotInput>>;
  spellsKnownLimit?: InputMaybe<Scalars['Int']['input']>;
};

export type LineageInput = {
  __kind: 'LineageInput';
  id: Scalars['ID']['input'];
  raceId: Scalars['ID']['input'];
};

export type Manual = {
  __typename: 'Manual';
  ability?: Maybe<Scalars['ID']['output']>;
  score?: Maybe<Scalars['Int']['output']>;
};

export type ManualInput = {
  __kind: 'ManualInput';
  ability?: InputMaybe<Scalars['ID']['input']>;
  score?: InputMaybe<Scalars['Int']['input']>;
};

export type ManualRolled = {
  __typename: 'ManualRolled';
  configuration: Scalars['String']['output'];
  manual?: Maybe<Array<Manual>>;
  rollGroups?: Maybe<Array<Array<RollType>>>;
};

export type ManualRolledInput = {
  __kind: 'ManualRolledInput';
  configuration: Scalars['String']['input'];
  manual?: InputMaybe<Array<ManualInput>>;
  rollGroups?: InputMaybe<Array<Array<RollTypeInput>>>;
};

export type ModifierCategoryType = {
  __typename: 'ModifierCategoryType';
  categoryId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  typeId: Scalars['String']['output'];
};

export type ModifierCategoryTypeInput = {
  __kind: 'ModifierCategoryTypeInput';
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
  __kind: 'ModifierCategoryTypeMethodInput';
  categoryId: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  methodId: Scalars['String']['input'];
  typeId: Scalars['String']['input'];
};

export type ModifierDiePerLevel = {
  __typename: 'ModifierDiePerLevel';
  dieConfig: Scalars['String']['output'];
  level: Scalars['Int']['output'];
};

export type ModifierDiePerLevelInput = {
  __kind: 'ModifierDiePerLevelInput';
  dieConfig: Scalars['String']['input'];
  level: Scalars['Int']['input'];
};

export type ModifierSetPerLevel = {
  __typename: 'ModifierSetPerLevel';
  level: Scalars['Int']['output'];
  setAmount: Scalars['Int']['output'];
};

export type ModifierSetPerLevelInput = {
  __kind: 'ModifierSetPerLevelInput';
  level: Scalars['Int']['input'];
  setAmount: Scalars['Int']['input'];
};

export type ModifierTypeMethod = {
  __typename: 'ModifierTypeMethod';
  id: Scalars['ID']['output'];
  methodId: Scalars['String']['output'];
  typeId: Scalars['String']['output'];
};

export type ModifierTypeMethodInput = {
  __kind: 'ModifierTypeMethodInput';
  id: Scalars['ID']['input'];
  methodId: Scalars['String']['input'];
  typeId: Scalars['String']['input'];
};

export type Multiclass = {
  __typename: 'Multiclass';
  optionalAbility?: Maybe<MulticlassAbility>;
  primaryAbility?: Maybe<MulticlassAbility>;
  proficiencies?: Maybe<Array<ClassProficiency>>;
  secondaryAbility?: Maybe<MulticlassAbility>;
};

export type MulticlassAbility = {
  __typename: 'MulticlassAbility';
  id?: Maybe<Scalars['ID']['output']>;
  minAmount?: Maybe<Scalars['Int']['output']>;
};

export type MulticlassAbilityInput = {
  __kind: 'MulticlassAbilityInput';
  id?: InputMaybe<Scalars['ID']['input']>;
  minAmount?: InputMaybe<Scalars['Int']['input']>;
};

export type MulticlassInput = {
  __kind: 'MulticlassInput';
  optionalAbility?: InputMaybe<MulticlassAbilityInput>;
  primaryAbility?: InputMaybe<MulticlassAbilityInput>;
  proficiencies?: InputMaybe<Array<ClassProficiencyInput>>;
  secondaryAbility?: InputMaybe<MulticlassAbilityInput>;
};

export type Mutation = {
  __typename: 'Mutation';
  batchCreateAncestryOptions: Array<AncestryOption>;
  batchCreateBackgrounds: Array<Background>;
  batchCreateClasses: Array<Class>;
  batchCreateEquipment: Array<Equipment>;
  batchCreateFeats: Array<Feat>;
  batchCreateFeatureExpertises: Array<FeatureExpertise>;
  batchCreateFeatureFeats: Array<FeatureFeat>;
  batchCreateFeatureModifiers: Array<FeatureModifier>;
  batchCreateFeatureOptions: Array<FeatureOption>;
  batchCreateFeatureProficiencies: Array<FeatureProficiency>;
  batchCreateFeatureSenses: Array<FeatureSense>;
  batchCreateFeatureSpells: Array<FeatureSpell>;
  batchCreateFeatures: Array<Feature>;
  batchCreateMasterAncestryOptions: Array<AncestryOption>;
  batchCreateMasterBackgrounds: Array<Background>;
  batchCreateMasterClasses: Array<Class>;
  batchCreateMasterEquipment: Array<Equipment>;
  batchCreateMasterFeats: Array<Feat>;
  batchCreateMasterFeatureExpertises: Array<FeatureExpertise>;
  batchCreateMasterFeatureFeats: Array<FeatureFeat>;
  batchCreateMasterFeatureModifiers: Array<FeatureModifier>;
  batchCreateMasterFeatureOptions: Array<FeatureOption>;
  batchCreateMasterFeatureProficiencies: Array<FeatureProficiency>;
  batchCreateMasterFeatureSenses: Array<FeatureSense>;
  batchCreateMasterFeatureSpells: Array<FeatureSpell>;
  batchCreateMasterFeatures: Array<Feature>;
  batchCreateMasterRaces: Array<Race>;
  batchCreateMasterSpells: Array<Spell>;
  batchCreateMasterSystems: Array<System>;
  batchCreateRaces: Array<Race>;
  batchCreateSpells: Array<Spell>;
  batchCreateSystems: Array<System>;
  createAncestryOption: AncestryOption;
  createBackground: Background;
  createCharacter: Character;
  createClass: Class;
  createEquipment: Equipment;
  createFeat: Feat;
  createFeature: Feature;
  createFeatureExpertise: FeatureExpertise;
  createFeatureFeat: FeatureFeat;
  createFeatureModifier: FeatureModifier;
  createFeatureOption: FeatureOption;
  createFeatureProficiency: FeatureProficiency;
  createFeatureSense: FeatureSense;
  createFeatureSpell: FeatureSpell;
  createMasterAncestryOption: AncestryOption;
  createMasterBackground: Background;
  createMasterClass: Class;
  createMasterEquipment: Equipment;
  createMasterFeat: Feat;
  createMasterFeature: Feature;
  createMasterFeatureExpertise: FeatureExpertise;
  createMasterFeatureFeat: FeatureFeat;
  createMasterFeatureModifier: FeatureModifier;
  createMasterFeatureOption: FeatureOption;
  createMasterFeatureProficiency: FeatureProficiency;
  createMasterFeatureSense: FeatureSense;
  createMasterFeatureSpell: FeatureSpell;
  createMasterRace: Race;
  createMasterSpell: Spell;
  createMasterSystem: System;
  createRace: Race;
  createSpell: Spell;
  createSystem: System;
  deleteAncestryOption: Scalars['ID']['output'];
  deleteBackground: Scalars['ID']['output'];
  deleteCharacter: Scalars['ID']['output'];
  deleteClass: Scalars['ID']['output'];
  deleteEquipment: Scalars['ID']['output'];
  deleteFeat: Scalars['ID']['output'];
  deleteFeature: Scalars['ID']['output'];
  deleteFeatureExpertise: Scalars['ID']['output'];
  deleteFeatureFeat: Scalars['ID']['output'];
  deleteFeatureModifier: Scalars['ID']['output'];
  deleteFeatureOption: Scalars['ID']['output'];
  deleteFeatureProficiency: Scalars['ID']['output'];
  deleteFeatureSense: Scalars['ID']['output'];
  deleteFeatureSpell: Scalars['ID']['output'];
  deleteMasterAncestryOption: Scalars['ID']['output'];
  deleteMasterBackground: Scalars['ID']['output'];
  deleteMasterClass: Scalars['ID']['output'];
  deleteMasterEquipment: Scalars['ID']['output'];
  deleteMasterFeat: Scalars['ID']['output'];
  deleteMasterFeature: Scalars['ID']['output'];
  deleteMasterFeatureExpertise: Scalars['ID']['output'];
  deleteMasterFeatureFeat: Scalars['ID']['output'];
  deleteMasterFeatureModifier: Scalars['ID']['output'];
  deleteMasterFeatureOption: Scalars['ID']['output'];
  deleteMasterFeatureProficiency: Scalars['ID']['output'];
  deleteMasterFeatureSense: Scalars['ID']['output'];
  deleteMasterFeatureSpell: Scalars['ID']['output'];
  deleteMasterRace: Scalars['ID']['output'];
  deleteMasterSpell: Scalars['ID']['output'];
  deleteMasterSystem: Scalars['ID']['output'];
  deleteRace: Scalars['ID']['output'];
  deleteSpell: Scalars['ID']['output'];
  deleteSystem: Scalars['ID']['output'];
  updateAncestryOption: AncestryOption;
  updateBackground: Background;
  updateCharacter: Character;
  updateClass: Class;
  updateEquipment: Equipment;
  updateFeat: Feat;
  updateFeature: Feature;
  updateFeatureExpertise: FeatureExpertise;
  updateFeatureFeat: FeatureFeat;
  updateFeatureModifier: FeatureModifier;
  updateFeatureOption: FeatureOption;
  updateFeatureProficiency: FeatureProficiency;
  updateFeatureSense: FeatureSense;
  updateFeatureSpell: FeatureSpell;
  updateMasterAncestryOption: AncestryOption;
  updateMasterBackground: Background;
  updateMasterClass: Class;
  updateMasterEquipment: Equipment;
  updateMasterFeat: Feat;
  updateMasterFeature: Feature;
  updateMasterFeatureExpertise: FeatureExpertise;
  updateMasterFeatureFeat: FeatureFeat;
  updateMasterFeatureModifier: FeatureModifier;
  updateMasterFeatureOption: FeatureOption;
  updateMasterFeatureProficiency: FeatureProficiency;
  updateMasterFeatureSense: FeatureSense;
  updateMasterFeatureSpell: FeatureSpell;
  updateMasterRace: Race;
  updateMasterSpell: Spell;
  updateMasterSystem: System;
  updateRace: Race;
  updateSpell: Spell;
  updateSystem: System;
};


export type MutationBatchCreateAncestryOptionsArgs = {
  input: Array<BatchAncestryOptionsInput>;
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


export type MutationBatchCreateFeatureExpertisesArgs = {
  input: Array<BatchFeatureExpertisesInput>;
};


export type MutationBatchCreateFeatureFeatsArgs = {
  input: Array<BatchFeatureFeatsInput>;
};


export type MutationBatchCreateFeatureModifiersArgs = {
  input: Array<BatchFeatureModifiersInput>;
};


export type MutationBatchCreateFeatureOptionsArgs = {
  input: Array<BatchFeatureOptionsInput>;
};


export type MutationBatchCreateFeatureProficienciesArgs = {
  input: Array<BatchFeatureProficienciesInput>;
};


export type MutationBatchCreateFeatureSensesArgs = {
  input: Array<BatchFeatureSensesInput>;
};


export type MutationBatchCreateFeatureSpellsArgs = {
  input: Array<BatchFeatureSpellsInput>;
};


export type MutationBatchCreateFeaturesArgs = {
  input: Array<BatchFeaturesInput>;
};


export type MutationBatchCreateMasterAncestryOptionsArgs = {
  input: Array<BatchAncestryOptionsInput>;
};


export type MutationBatchCreateMasterBackgroundsArgs = {
  input: Array<BatchBackgroundsInput>;
};


export type MutationBatchCreateMasterClassesArgs = {
  input: Array<BatchClassesInput>;
};


export type MutationBatchCreateMasterEquipmentArgs = {
  input: Array<BatchEquipmentInput>;
};


export type MutationBatchCreateMasterFeatsArgs = {
  input: Array<BatchFeatInput>;
};


export type MutationBatchCreateMasterFeatureExpertisesArgs = {
  input: Array<BatchFeatureExpertisesInput>;
};


export type MutationBatchCreateMasterFeatureFeatsArgs = {
  input: Array<BatchFeatureFeatsInput>;
};


export type MutationBatchCreateMasterFeatureModifiersArgs = {
  input: Array<BatchFeatureModifiersInput>;
};


export type MutationBatchCreateMasterFeatureOptionsArgs = {
  input: Array<BatchFeatureOptionsInput>;
};


export type MutationBatchCreateMasterFeatureProficienciesArgs = {
  input: Array<BatchFeatureProficienciesInput>;
};


export type MutationBatchCreateMasterFeatureSensesArgs = {
  input: Array<BatchFeatureSensesInput>;
};


export type MutationBatchCreateMasterFeatureSpellsArgs = {
  input: Array<BatchFeatureSpellsInput>;
};


export type MutationBatchCreateMasterFeaturesArgs = {
  input: Array<BatchFeaturesInput>;
};


export type MutationBatchCreateMasterRacesArgs = {
  input: Array<BatchRacesInput>;
};


export type MutationBatchCreateMasterSpellsArgs = {
  input: Array<InputMaybe<BatchSpellsInput>>;
};


export type MutationBatchCreateMasterSystemsArgs = {
  input: Array<BatchSystemsInput>;
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


export type MutationCreateAncestryOptionArgs = {
  input: AncestryOptionInput;
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


export type MutationCreateFeatureArgs = {
  input: FeatureInput;
};


export type MutationCreateFeatureExpertiseArgs = {
  input: FeatureExpertiseInput;
};


export type MutationCreateFeatureFeatArgs = {
  input: FeatureFeatInput;
};


export type MutationCreateFeatureModifierArgs = {
  input: FeatureModifierInput;
};


export type MutationCreateFeatureOptionArgs = {
  input: FeatureOptionInput;
};


export type MutationCreateFeatureProficiencyArgs = {
  input: FeatureProficiencyInput;
};


export type MutationCreateFeatureSenseArgs = {
  input: FeatureSenseInput;
};


export type MutationCreateFeatureSpellArgs = {
  input: FeatureSpellInput;
};


export type MutationCreateMasterAncestryOptionArgs = {
  input: AncestryOptionInput;
};


export type MutationCreateMasterBackgroundArgs = {
  input: BackgroundInput;
};


export type MutationCreateMasterClassArgs = {
  input: ClassInput;
};


export type MutationCreateMasterEquipmentArgs = {
  input: EquipmentInput;
};


export type MutationCreateMasterFeatArgs = {
  input: FeatInput;
};


export type MutationCreateMasterFeatureArgs = {
  input: FeatureInput;
};


export type MutationCreateMasterFeatureExpertiseArgs = {
  input: FeatureExpertiseInput;
};


export type MutationCreateMasterFeatureFeatArgs = {
  input: FeatureFeatInput;
};


export type MutationCreateMasterFeatureModifierArgs = {
  input: FeatureModifierInput;
};


export type MutationCreateMasterFeatureOptionArgs = {
  input: FeatureOptionInput;
};


export type MutationCreateMasterFeatureProficiencyArgs = {
  input: FeatureProficiencyInput;
};


export type MutationCreateMasterFeatureSenseArgs = {
  input: FeatureSenseInput;
};


export type MutationCreateMasterFeatureSpellArgs = {
  input: FeatureSpellInput;
};


export type MutationCreateMasterRaceArgs = {
  input: RaceInput;
};


export type MutationCreateMasterSpellArgs = {
  input: SpellInput;
};


export type MutationCreateMasterSystemArgs = {
  input: SystemInput;
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


export type MutationDeleteAncestryOptionArgs = {
  id: Scalars['ID']['input'];
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


export type MutationDeleteFeatureArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFeatureExpertiseArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFeatureFeatArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFeatureModifierArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFeatureOptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFeatureProficiencyArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFeatureSenseArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFeatureSpellArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterAncestryOptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterBackgroundArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterClassArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterEquipmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatureArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatureExpertiseArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatureFeatArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatureModifierArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatureOptionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatureProficiencyArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatureSenseArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterFeatureSpellArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterRaceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterSpellArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMasterSystemArgs = {
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


export type MutationUpdateAncestryOptionArgs = {
  input: AncestryOptionInput;
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


export type MutationUpdateFeatureArgs = {
  input: FeatureInput;
};


export type MutationUpdateFeatureExpertiseArgs = {
  input: FeatureExpertiseInput;
};


export type MutationUpdateFeatureFeatArgs = {
  input: FeatureFeatInput;
};


export type MutationUpdateFeatureModifierArgs = {
  input: FeatureModifierInput;
};


export type MutationUpdateFeatureOptionArgs = {
  input: FeatureOptionInput;
};


export type MutationUpdateFeatureProficiencyArgs = {
  input: FeatureProficiencyInput;
};


export type MutationUpdateFeatureSenseArgs = {
  input: FeatureSenseInput;
};


export type MutationUpdateFeatureSpellArgs = {
  input: FeatureSpellInput;
};


export type MutationUpdateMasterAncestryOptionArgs = {
  input: AncestryOptionInput;
};


export type MutationUpdateMasterBackgroundArgs = {
  input: BackgroundInput;
};


export type MutationUpdateMasterClassArgs = {
  input: ClassInput;
};


export type MutationUpdateMasterEquipmentArgs = {
  input: EquipmentInput;
};


export type MutationUpdateMasterFeatArgs = {
  input: FeatInput;
};


export type MutationUpdateMasterFeatureArgs = {
  input: FeatureInput;
};


export type MutationUpdateMasterFeatureExpertiseArgs = {
  input: FeatureExpertiseInput;
};


export type MutationUpdateMasterFeatureFeatArgs = {
  input: FeatureFeatInput;
};


export type MutationUpdateMasterFeatureModifierArgs = {
  input: FeatureModifierInput;
};


export type MutationUpdateMasterFeatureOptionArgs = {
  input: FeatureOptionInput;
};


export type MutationUpdateMasterFeatureProficiencyArgs = {
  input: FeatureProficiencyInput;
};


export type MutationUpdateMasterFeatureSenseArgs = {
  input: FeatureSenseInput;
};


export type MutationUpdateMasterFeatureSpellArgs = {
  input: FeatureSpellInput;
};


export type MutationUpdateMasterRaceArgs = {
  input: RaceInput;
};


export type MutationUpdateMasterSpellArgs = {
  input: SpellInput;
};


export type MutationUpdateMasterSystemArgs = {
  input: SystemInput;
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

export type OptionsByLevel = {
  __typename: 'OptionsByLevel';
  count?: Maybe<Scalars['Int']['output']>;
  level?: Maybe<Scalars['Int']['output']>;
  replaceCount?: Maybe<Scalars['Int']['output']>;
};

export type OptionsByLevelInput = {
  __kind: 'OptionsByLevelInput';
  count?: InputMaybe<Scalars['Int']['input']>;
  level?: InputMaybe<Scalars['Int']['input']>;
  replaceCount?: InputMaybe<Scalars['Int']['input']>;
};

export type PointBuy = {
  __typename: 'PointBuy';
  distributed?: Maybe<Array<Distributed>>;
  pointsLeft?: Maybe<Scalars['Int']['output']>;
};

export type PointBuyInput = {
  __kind: 'PointBuyInput';
  distributed?: InputMaybe<Array<DistributedInput>>;
  pointsLeft?: InputMaybe<Scalars['Int']['input']>;
};

export type Possessions = {
  __typename: 'Possessions';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
};

export type PossessionsInput = {
  __kind: 'PossessionsInput';
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
};

export type PrepareLimit = {
  __typename: 'PrepareLimit';
  level?: Maybe<PrepareLimitLevel>;
  methods?: Maybe<Array<Scalars['ID']['output']>>;
};

export type PrepareLimitInput = {
  __kind: 'PrepareLimitInput';
  level?: InputMaybe<PrepareLimitLevelInput>;
  methods?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type PrepareLimitLevel = {
  __typename: 'PrepareLimitLevel';
  measurement?: Maybe<Scalars['ID']['output']>;
  rounding?: Maybe<Scalars['ID']['output']>;
};

export type PrepareLimitLevelInput = {
  __kind: 'PrepareLimitLevelInput';
  measurement?: InputMaybe<Scalars['ID']['input']>;
  rounding?: InputMaybe<Scalars['ID']['input']>;
};

export type Prerequisite = {
  __typename: 'Prerequisite';
  abilityScore?: Maybe<AbilityScore>;
  equipmentProficiencies?: Maybe<Array<EquipPrerequisite>>;
  equipped?: Maybe<Array<EquipPrerequisite>>;
  featuresObtained?: Maybe<Array<Scalars['ID']['output']>>;
  notEquipped?: Maybe<Array<EquipPrerequisite>>;
  options?: Maybe<Array<Scalars['ID']['output']>>;
  optionsObtained?: Maybe<Array<Scalars['ID']['output']>>;
  size?: Maybe<Array<Scalars['ID']['output']>>;
  skillProficiencies?: Maybe<Array<Scalars['ID']['output']>>;
  spellsObtained?: Maybe<Array<Scalars['ID']['output']>>;
};

export type PrerequisiteInput = {
  __kind: 'PrerequisiteInput';
  abilityScore?: InputMaybe<AbilityScoreInput>;
  equipmentProficiencies?: InputMaybe<Array<EquipPrerequisiteInput>>;
  equipped?: InputMaybe<Array<EquipPrerequisiteInput>>;
  featuresObtained?: InputMaybe<Array<Scalars['ID']['input']>>;
  notEquipped?: InputMaybe<Array<EquipPrerequisiteInput>>;
  options?: InputMaybe<Array<Scalars['ID']['input']>>;
  optionsObtained?: InputMaybe<Array<Scalars['ID']['input']>>;
  size?: InputMaybe<Array<Scalars['ID']['input']>>;
  skillProficiencies?: InputMaybe<Array<Scalars['ID']['input']>>;
  spellsObtained?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type ProficiencyLevel = {
  __typename: 'ProficiencyLevel';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  multiplier?: Maybe<Scalars['Float']['output']>;
};

export type ProficiencyLevelInput = {
  __kind: 'ProficiencyLevelInput';
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  multiplier?: InputMaybe<Scalars['Float']['input']>;
};

export type ProficiencyProperties = {
  __typename: 'ProficiencyProperties';
  category?: Maybe<Scalars['ID']['output']>;
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  properties?: Maybe<Array<Scalars['ID']['output']>>;
};

export type ProficiencyPropertiesInput = {
  __kind: 'ProficiencyPropertiesInput';
  category?: InputMaybe<Scalars['ID']['input']>;
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type Query = {
  __typename: 'Query';
  getAncestryOption?: Maybe<AncestryOption>;
  getBackground?: Maybe<Background>;
  getCharacter?: Maybe<Character>;
  getClass?: Maybe<Class>;
  getEquipment?: Maybe<Equipment>;
  getFeat?: Maybe<Feat>;
  getFeature?: Maybe<Feature>;
  getFeatureExpertise?: Maybe<FeatureExpertise>;
  getFeatureFeat?: Maybe<FeatureFeat>;
  getFeatureModifier?: Maybe<FeatureModifier>;
  getFeatureOption?: Maybe<FeatureOption>;
  getFeatureProficiency?: Maybe<FeatureProficiency>;
  getFeatureSense?: Maybe<FeatureSense>;
  getFeatureSpell?: Maybe<FeatureSpell>;
  getMasterAncestryOption?: Maybe<AncestryOption>;
  getMasterBackground?: Maybe<Background>;
  getMasterClass?: Maybe<Class>;
  getMasterEquipment?: Maybe<Equipment>;
  getMasterFeat?: Maybe<Feat>;
  getMasterFeature?: Maybe<Feature>;
  getMasterFeatureExpertise?: Maybe<FeatureExpertise>;
  getMasterFeatureFeat?: Maybe<FeatureFeat>;
  getMasterFeatureModifier?: Maybe<FeatureModifier>;
  getMasterFeatureOption?: Maybe<FeatureOption>;
  getMasterFeatureProficiency?: Maybe<FeatureProficiency>;
  getMasterFeatureSense?: Maybe<FeatureSense>;
  getMasterFeatureSpell?: Maybe<FeatureSpell>;
  getMasterRace?: Maybe<Race>;
  getMasterSpell?: Maybe<Spell>;
  getMasterSystem?: Maybe<System>;
  getRace?: Maybe<Race>;
  getSpell?: Maybe<Spell>;
  getSystem?: Maybe<System>;
  listAncestryOptions: AncestryOptionConnection;
  listBackgrounds: BackgroundConnection;
  listCharacters: CharacterConnection;
  listClasses: ClassConnection;
  listEquipment: EquipmentConnection;
  listFeats: FeatConnection;
  listFeatureExpertises: FeatureExpertiseConnection;
  listFeatureFeats: FeatureFeatConnection;
  listFeatureModifiers: FeatureModifierConnection;
  listFeatureOptions: FeatureOptionConnection;
  listFeatureProficiencies: FeatureProficiencyConnection;
  listFeatureSenses: FeatureSenseConnection;
  listFeatureSpells: FeatureSpellConnection;
  listFeatures: FeatureConnection;
  listMasterAncestryOptions: AncestryOptionConnection;
  listMasterBackgrounds: BackgroundConnection;
  listMasterClasses: ClassConnection;
  listMasterEquipment: EquipmentConnection;
  listMasterFeats: FeatConnection;
  listMasterFeatureExpertises: FeatureExpertiseConnection;
  listMasterFeatureFeats: FeatureFeatConnection;
  listMasterFeatureModifiers: FeatureModifierConnection;
  listMasterFeatureOptions: FeatureOptionConnection;
  listMasterFeatureProficiencies: FeatureProficiencyConnection;
  listMasterFeatureSenses: FeatureSenseConnection;
  listMasterFeatureSpells: FeatureSpellConnection;
  listMasterFeatures: FeatureConnection;
  listMasterRaces: RaceConnection;
  listMasterSpells: SpellConnection;
  listMasterSystems: SystemConnection;
  listRaces: RaceConnection;
  listSpells: SpellConnection;
  listSystems: SystemConnection;
};


export type QueryGetAncestryOptionArgs = {
  id: Scalars['ID']['input'];
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


export type QueryGetFeatureArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFeatureExpertiseArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFeatureFeatArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFeatureModifierArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFeatureOptionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFeatureProficiencyArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFeatureSenseArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetFeatureSpellArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterAncestryOptionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterBackgroundArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterClassArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterEquipmentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatureArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatureExpertiseArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatureFeatArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatureModifierArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatureOptionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatureProficiencyArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatureSenseArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterFeatureSpellArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterRaceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterSpellArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetMasterSystemArgs = {
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


export type QueryListAncestryOptionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListBackgroundsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListCharactersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListClassesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListEquipmentArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeatsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeatureExpertisesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeatureFeatsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeatureModifiersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeatureOptionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeatureProficienciesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeatureSensesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeatureSpellsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListFeaturesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListMasterAncestryOptionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterBackgroundsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterClassesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterEquipmentArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeatsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeatureExpertisesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeatureFeatsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeatureModifiersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeatureOptionsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeatureProficienciesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeatureSensesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeatureSpellsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterFeaturesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterRacesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterSpellsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListMasterSystemsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
};


export type QueryListRacesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
};


export type QueryListSpellsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
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
  details?: Maybe<Array<Detail>>;
  features?: Maybe<Array<Feature>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  lineages?: Maybe<Array<Scalars['ID']['output']>>;
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  playable?: Maybe<Scalars['String']['output']>;
  quote?: Maybe<Scalars['String']['output']>;
  systemId: Scalars['ID']['output'];
  traits?: Maybe<Traits>;
};

export type RaceConnection = {
  __typename: 'RaceConnection';
  items: Array<RaceListItem>;
  metaData: RaceMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type RaceInput = {
  __kind: 'RaceInput';
  ancestry?: InputMaybe<AncestryInput>;
  category: Scalars['ID']['input'];
  desc?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<Array<DetailInput>>;
  features?: InputMaybe<Array<FeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  lineages?: InputMaybe<Array<Scalars['ID']['input']>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId?: InputMaybe<Scalars['ID']['input']>;
  playable?: InputMaybe<Scalars['String']['input']>;
  quote?: InputMaybe<Scalars['String']['input']>;
  systemId: Scalars['ID']['input'];
  traits?: InputMaybe<TraitsInput>;
};

export type RaceListItem = {
  __typename: 'RaceListItem';
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Detail>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  quote?: Maybe<Scalars['String']['output']>;
  systemId: Scalars['ID']['output'];
};

export type RaceMeta = {
  __typename: 'RaceMeta';
  categories: Array<RaceMetaObject>;
  features: Array<RaceMetaObject>;
  lineages: Array<RaceMetaObject>;
  playable: Array<RaceMetaObject>;
};

export type RaceMetaObject = {
  __typename: 'RaceMetaObject';
  id: Scalars['ID']['output'];
  raceIds: Array<Scalars['ID']['output']>;
};

export type RaceSpeed = {
  __typename: 'RaceSpeed';
  climbing?: Maybe<Scalars['Int']['output']>;
  flying?: Maybe<Scalars['Int']['output']>;
  swimming?: Maybe<Scalars['Int']['output']>;
  walking?: Maybe<Scalars['Int']['output']>;
};

export type RaceSpeedInput = {
  __kind: 'RaceSpeedInput';
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
  __kind: 'RangeInput';
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
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAvailable?: Maybe<Scalars['Int']['output']>;
  method?: Maybe<Scalars['ID']['output']>;
};

export type ResourceInput = {
  __kind: 'ResourceInput';
  charges?: InputMaybe<ChargeInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  levelAvailable?: InputMaybe<Scalars['Int']['input']>;
  method?: InputMaybe<Scalars['ID']['input']>;
};

export type Roll = {
  __typename: 'Roll';
  die: Scalars['Int']['output'];
  id?: Maybe<Scalars['String']['output']>;
  value: Scalars['Int']['output'];
};

export type RollInput = {
  __kind: 'RollInput';
  die?: Scalars['Int']['input'];
  id?: InputMaybe<Scalars['String']['input']>;
  value?: Scalars['Int']['input'];
};

export type RollType = {
  __typename: 'RollType';
  ability: Scalars['ID']['output'];
  applied: Scalars['Boolean']['output'];
  kept?: Maybe<Array<Roll>>;
  rolled: Array<Roll>;
  rolling: Scalars['Boolean']['output'];
  score: Scalars['Int']['output'];
};

export type RollTypeInput = {
  __kind: 'RollTypeInput';
  ability: Scalars['ID']['input'];
  applied?: Scalars['Boolean']['input'];
  kept?: InputMaybe<Array<RollInput>>;
  rolled: Array<RollInput>;
  rolling?: Scalars['Boolean']['input'];
  score?: Scalars['Int']['input'];
};

export type SaveAbility = {
  __typename: 'SaveAbility';
  abilityModifier?: Maybe<Scalars['ID']['output']>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  minAmount?: Maybe<Scalars['Int']['output']>;
};

export type SaveAbilityInput = {
  __kind: 'SaveAbilityInput';
  abilityModifier?: InputMaybe<Scalars['ID']['input']>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
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
  __kind: 'ScoresInput';
  ability: Scalars['ID']['input'];
  baseScore?: InputMaybe<Scalars['Int']['input']>;
  calculatedScore?: InputMaybe<Scalars['Int']['input']>;
  classScore?: InputMaybe<Scalars['Int']['input']>;
  modifierScore?: InputMaybe<Scalars['Int']['input']>;
  raceScore?: InputMaybe<Scalars['Int']['input']>;
};

export enum SectionEnum {
  ALL = 'ALL',
  SPELL = 'SPELL',
  SUBCLASS = 'SUBCLASS'
}

export enum SectionEnumInput {
  ALL = 'ALL',
  SPELL = 'SPELL',
  SUBCLASS = 'SUBCLASS'
}

export type SetPerLevel = {
  __typename: 'SetPerLevel';
  bonus?: Maybe<Scalars['Int']['output']>;
  level?: Maybe<Scalars['String']['output']>;
  primary?: Maybe<Scalars['Int']['output']>;
  secondary?: Maybe<Scalars['Int']['output']>;
};

export type SetPerLevelInput = {
  __kind: 'SetPerLevelInput';
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
  __kind: 'ShapeInput';
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
  __kind: 'SpeedInput';
  amount?: InputMaybe<Scalars['Int']['input']>;
  unit: Scalars['ID']['input'];
};

export type Spell = {
  __typename: 'Spell';
  actions?: Maybe<ActionGroup>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  classes: Array<Scalars['ID']['output']>;
  conditions?: Maybe<Array<Scalars['ID']['output']>>;
  damage?: Maybe<Damage>;
  desc?: Maybe<Scalars['String']['output']>;
  duration: Duration;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  level: Scalars['Int']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  materialDesc?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  range: Range;
  requirements?: Maybe<Array<Scalars['ID']['output']>>;
  saveAbility?: Maybe<SaveAbility>;
  school: Scalars['ID']['output'];
  shape?: Maybe<Shape>;
  systemId: Scalars['ID']['output'];
  targets?: Maybe<Scalars['Int']['output']>;
  upcast?: Maybe<Upcast>;
};

export type SpellActionMetaObject = {
  __typename: 'SpellActionMetaObject';
  amount?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  spellIds?: Maybe<Array<Scalars['ID']['output']>>;
};

export type SpellConnection = {
  __typename: 'SpellConnection';
  items: Array<SpellListItem>;
  metaData: SpellMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type SpellDurationMetaObject = {
  __typename: 'SpellDurationMetaObject';
  amount?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  spellIds?: Maybe<Array<Scalars['ID']['output']>>;
};

export enum SpellEnum {
  ALL = 'ALL',
  DAMAGE = 'DAMAGE',
  UPCAST = 'UPCAST'
}

export enum SpellEnumInput {
  ALL = 'ALL',
  DAMAGE = 'DAMAGE',
  UPCAST = 'UPCAST'
}

export type SpellInput = {
  __kind: 'SpellInput';
  actions?: InputMaybe<ActionGroupInput>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  classes: Array<Scalars['ID']['input']>;
  conditions?: InputMaybe<Array<Scalars['ID']['input']>>;
  damage?: InputMaybe<DamageInput>;
  desc: Scalars['String']['input'];
  duration: DurationInput;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  level: Scalars['Int']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  materialDesc?: InputMaybe<Scalars['String']['input']>;
  ownerId?: InputMaybe<Scalars['ID']['input']>;
  range: RangeInput;
  requirements?: InputMaybe<Array<Scalars['ID']['input']>>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  school: Scalars['ID']['input'];
  shape: ShapeInput;
  systemId: Scalars['ID']['input'];
  targets?: InputMaybe<Scalars['Int']['input']>;
  upcast?: InputMaybe<UpcastInput>;
};

export type SpellLevelObject = {
  __typename: 'SpellLevelObject';
  id: Scalars['Int']['output'];
  spellIds?: Maybe<Array<Scalars['ID']['output']>>;
};

export type SpellListItem = {
  __typename: 'SpellListItem';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  materialDesc?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  requirements?: Maybe<Array<Scalars['ID']['output']>>;
  systemId: Scalars['ID']['output'];
};

export type SpellMeta = {
  __typename: 'SpellMeta';
  attributes: Array<SpellMetaObject>;
  classes: Array<SpellMetaObject>;
  conditions: Array<SpellMetaObject>;
  durations: Array<SpellDurationMetaObject>;
  levels: Array<SpellLevelObject>;
  primaryActions: Array<SpellActionMetaObject>;
  primaryDamages: Array<SpellMetaObject>;
  ranges: Array<SpellRangeMetaObject>;
  requirements: Array<SpellMetaObject>;
  saveAbilities: Array<SpellMetaObject>;
  schools: Array<SpellMetaObject>;
  secondaryActions: Array<SpellActionMetaObject>;
  secondaryDamages: Array<SpellMetaObject>;
  shapes: Array<SpellShapeMetaObject>;
};

export type SpellMetaObject = {
  __typename: 'SpellMetaObject';
  id: Scalars['ID']['output'];
  spellIds?: Maybe<Array<Scalars['ID']['output']>>;
};

export type SpellRangeMetaObject = {
  __typename: 'SpellRangeMetaObject';
  distance?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  maxRange?: Maybe<Scalars['Int']['output']>;
  minRange?: Maybe<Scalars['Int']['output']>;
  spellIds?: Maybe<Array<Scalars['ID']['output']>>;
  unit?: Maybe<Scalars['ID']['output']>;
};

export type SpellShapeMetaObject = {
  __typename: 'SpellShapeMetaObject';
  id: Scalars['ID']['output'];
  size?: Maybe<Scalars['Float']['output']>;
  spellIds?: Maybe<Array<Scalars['ID']['output']>>;
  unit?: Maybe<Scalars['ID']['output']>;
};

export type SpellSlot = {
  __typename: 'SpellSlot';
  slotCount?: Maybe<Scalars['Int']['output']>;
};

export type SpellSlotInput = {
  __kind: 'SpellSlotInput';
  slotCount?: InputMaybe<Scalars['Int']['input']>;
};

export type Spellcasting = {
  __typename: 'Spellcasting';
  ability?: Maybe<Scalars['ID']['output']>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  charges?: Maybe<Charge>;
  magicName?: Maybe<Scalars['String']['output']>;
  maxSpellLevel?: Maybe<Scalars['Int']['output']>;
  prepareLimit?: Maybe<PrepareLimit>;
};

export type SpellcastingInput = {
  __kind: 'SpellcastingInput';
  ability?: InputMaybe<Scalars['ID']['input']>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  charges?: InputMaybe<ChargeInput>;
  magicName?: InputMaybe<Scalars['String']['input']>;
  maxSpellLevel?: InputMaybe<Scalars['Int']['input']>;
  prepareLimit?: InputMaybe<PrepareLimitInput>;
};

export type SpellsByLevel = {
  __typename: 'SpellsByLevel';
  id: Scalars['ID']['output'];
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  level?: Maybe<Scalars['Int']['output']>;
  spellLevel?: Maybe<Scalars['Int']['output']>;
};

export type SpellsByLevelInput = {
  __kind: 'SpellsByLevelInput';
  id: Scalars['ID']['input'];
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  level?: InputMaybe<Scalars['Int']['input']>;
  spellLevel?: InputMaybe<Scalars['Int']['input']>;
};

export type StandardArray = {
  __typename: 'StandardArray';
  ability?: Maybe<Scalars['ID']['output']>;
  score?: Maybe<Scalars['ID']['output']>;
};

export type StandardArrayInput = {
  __kind: 'StandardArrayInput';
  ability?: InputMaybe<Scalars['ID']['input']>;
  score?: InputMaybe<Scalars['ID']['input']>;
};

export type StartingEquipment = {
  __typename: 'StartingEquipment';
  id: Scalars['ID']['output'];
  quantity: Scalars['Int']['output'];
  selectionId?: Maybe<Scalars['ID']['output']>;
};

export type StartingEquipmentGroup = {
  __typename: 'StartingEquipmentGroup';
  equipment?: Maybe<Array<StartingEquipment>>;
  groupId: Scalars['ID']['output'];
  optionId: Scalars['ID']['output'];
};

export type StartingEquipmentGroupInput = {
  __kind: 'StartingEquipmentGroupInput';
  equipment?: InputMaybe<Array<StartingEquipmentInput>>;
  groupId: Scalars['ID']['input'];
  optionId: Scalars['ID']['input'];
};

export type StartingEquipmentInput = {
  __kind: 'StartingEquipmentInput';
  id: Scalars['ID']['input'];
  quantity: Scalars['Int']['input'];
  selectionId?: InputMaybe<Scalars['ID']['input']>;
};

export type StartingGold = {
  __typename: 'StartingGold';
  currency: Scalars['ID']['output'];
  dieConfig?: Maybe<Scalars['String']['output']>;
  multiplier: Scalars['Int']['output'];
};

export type StartingGoldInput = {
  __kind: 'StartingGoldInput';
  currency: Scalars['ID']['input'];
  dieConfig?: InputMaybe<Scalars['String']['input']>;
  multiplier: Scalars['Int']['input'];
};

export type Subclass = {
  __typename: 'Subclass';
  id: Scalars['ID']['output'];
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type SubclassInput = {
  __kind: 'SubclassInput';
  id: Scalars['ID']['input'];
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type Subtype = {
  __typename: 'Subtype';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
};

export type SubtypeInput = {
  __kind: 'SubtypeInput';
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
};

export type System = {
  __typename: 'System';
  abilities: Array<GenericType>;
  actions: Array<SystemAction>;
  alignments: Array<GenericType>;
  attributes: Array<SystemAttribute>;
  categories: Array<SystemCategory>;
  characters: CharacterSetting;
  charges: SystemCharges;
  conditions: Array<GenericType>;
  currencies: Array<Currency>;
  damageTypes: Array<GenericType>;
  desc?: Maybe<Scalars['String']['output']>;
  equipment: SystemEquipment;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  languages: Array<GenericType>;
  masterId?: Maybe<Scalars['String']['output']>;
  modifiers: SystemModifiers;
  ownerId: Scalars['ID']['output'];
  passives: Array<GenericType>;
  prerequisites: Array<SystemPrerequisite>;
  proficiencies: SystemProficiency;
  rules: SystemRules;
  senses: Array<SystemSense>;
  sizes: Array<GenericType>;
  skills: Array<SystemSkill>;
  speeds: Array<GenericType>;
  spells: SystemSpell;
  terrains: Array<GenericType>;
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
};

export type SystemActionInput = {
  __kind: 'SystemActionInput';
  classes?: Scalars['Boolean']['input'];
  damage?: Scalars['Boolean']['input'];
  equipment?: Scalars['Boolean']['input'];
  feats?: Scalars['Boolean']['input'];
  features?: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: Scalars['Boolean']['input'];
  spells?: Scalars['Boolean']['input'];
};

export type SystemAttribute = {
  __typename: 'SystemAttribute';
  classes?: Maybe<Array<ClassesEnum>>;
  damage?: Maybe<Array<DamageEnum>>;
  equipment?: Maybe<Array<EquipmentEnum>>;
  feats?: Maybe<Array<FeatEnum>>;
  features?: Maybe<Array<FeatureEnum>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  sections?: Maybe<Array<SectionEnum>>;
  spells?: Maybe<Array<SpellEnum>>;
};

export type SystemAttributeInput = {
  __kind: 'SystemAttributeInput';
  classes?: InputMaybe<Array<ClassesEnumInput>>;
  damage?: InputMaybe<Array<DamageEnumInput>>;
  equipment?: InputMaybe<Array<EquipmentEnumInput>>;
  feats?: InputMaybe<Array<FeatEnumInput>>;
  features?: InputMaybe<Array<FeatureEnumInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<SectionEnumInput>>;
  spells?: InputMaybe<Array<SpellEnumInput>>;
};

export type SystemCategory = {
  __typename: 'SystemCategory';
  classes: Scalars['Boolean']['output'];
  features: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  races: Scalars['Boolean']['output'];
};

export type SystemCategoryInput = {
  __kind: 'SystemCategoryInput';
  classes?: Scalars['Boolean']['input'];
  features?: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  races?: Scalars['Boolean']['input'];
};

export type SystemCharges = {
  __typename: 'SystemCharges';
  limits: Array<ChargeOption>;
  resets: Array<ChargeOption>;
};

export type SystemChargesInput = {
  __kind: 'SystemChargesInput';
  limits: Array<ChargeOptionInput>;
  resets: Array<ChargeOptionInput>;
};

export type SystemConnection = {
  __typename: 'SystemConnection';
  items: Array<SystemListItem>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type SystemEquipment = {
  __typename: 'SystemEquipment';
  categories: Array<GenericType>;
  categoryProperties: Array<EquipmentCategoryProperty>;
  properties: Array<GenericType>;
  rarities: Array<GenericType>;
};

export type SystemEquipmentInput = {
  __kind: 'SystemEquipmentInput';
  categories: Array<GenericTypeInput>;
  categoryProperties: Array<EquipmentCategoryPropertyInput>;
  properties: Array<GenericTypeInput>;
  rarities: Array<GenericTypeInput>;
};

export type SystemInput = {
  __kind: 'SystemInput';
  abilities: Array<GenericTypeInput>;
  actions: Array<SystemActionInput>;
  alignments: Array<GenericTypeInput>;
  attributes: Array<SystemAttributeInput>;
  categories: Array<SystemCategoryInput>;
  characters: CharacterSettingInput;
  charges: SystemChargesInput;
  conditions: Array<GenericTypeInput>;
  currencies: Array<CurrencyInput>;
  damageTypes: Array<GenericTypeInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  equipment: SystemEquipmentInput;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  languages: Array<GenericTypeInput>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  modifiers: SystemModifiersInput;
  ownerId: Scalars['ID']['input'];
  passives: Array<GenericTypeInput>;
  prerequisites: Array<SystemPrerequisiteInput>;
  proficiencies: SystemProficiencyInput;
  rules: SystemRulesInput;
  senses: Array<SystemSenseInput>;
  sizes: Array<GenericTypeInput>;
  skills: Array<SystemSkillInput>;
  speeds: Array<GenericTypeInput>;
  spells: SystemSpellInput;
  terrains: Array<GenericTypeInput>;
};

export type SystemListItem = {
  __typename: 'SystemListItem';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
};

export type SystemMeasurement = {
  __typename: 'SystemMeasurement';
  amount: Array<GenericType>;
  imperial: Imperial;
  rounding: Array<GenericType>;
};

export type SystemMeasurementInput = {
  __kind: 'SystemMeasurementInput';
  amount: Array<GenericTypeInput>;
  imperial: ImperialInput;
  rounding: Array<GenericTypeInput>;
};

export type SystemModifiers = {
  __typename: 'SystemModifiers';
  categories: Array<GenericType>;
  categoryMethods: Array<ModifierCategoryTypeMethod>;
  categoryTypes: Array<ModifierCategoryType>;
  methods: Array<GenericType>;
  spellCategories: Array<GenericType>;
  typeMethods: Array<ModifierTypeMethod>;
  types: Array<GenericType>;
};

export type SystemModifiersInput = {
  __kind: 'SystemModifiersInput';
  categories: Array<GenericTypeInput>;
  categoryMethods: Array<ModifierCategoryTypeMethodInput>;
  categoryTypes: Array<ModifierCategoryTypeInput>;
  methods: Array<GenericTypeInput>;
  spellCategories: Array<GenericTypeInput>;
  typeMethods: Array<ModifierTypeMethodInput>;
  types: Array<GenericTypeInput>;
};

export type SystemPrerequisite = {
  __typename: 'SystemPrerequisite';
  classes?: Maybe<Array<Maybe<ClassesEnum>>>;
  damage?: Maybe<Array<Maybe<DamageEnum>>>;
  equipment?: Maybe<Array<Maybe<EquipmentEnum>>>;
  feats?: Maybe<Array<Maybe<FeatEnum>>>;
  features?: Maybe<Array<Maybe<FeatureEnum>>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  sections?: Maybe<Array<Maybe<SectionEnum>>>;
  spells?: Maybe<Array<Maybe<SpellEnum>>>;
};

export type SystemPrerequisiteInput = {
  __kind: 'SystemPrerequisiteInput';
  classes?: InputMaybe<Array<ClassesEnumInput>>;
  damage?: InputMaybe<Array<DamageEnumInput>>;
  equipment?: InputMaybe<Array<EquipmentEnumInput>>;
  feats?: InputMaybe<Array<FeatEnumInput>>;
  features?: InputMaybe<Array<FeatureEnumInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<SectionEnumInput>>;
  spells?: InputMaybe<Array<SpellEnumInput>>;
};

export type SystemProficiency = {
  __typename: 'SystemProficiency';
  categories: Array<GenericType>;
  levels: Array<ProficiencyLevel>;
};

export type SystemProficiencyInput = {
  __kind: 'SystemProficiencyInput';
  categories: Array<GenericTypeInput>;
  levels: Array<ProficiencyLevelInput>;
};

export type SystemRules = {
  __typename: 'SystemRules';
  abilityGenerateMethod: Array<AbilityGenerateMethod>;
  measurements: SystemMeasurement;
};

export type SystemRulesInput = {
  __kind: 'SystemRulesInput';
  abilityGenerateMethod: Array<AbilityGenerateMethodInput>;
  measurements: SystemMeasurementInput;
};

export type SystemSense = {
  __typename: 'SystemSense';
  creatureDesc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  monsterDesc?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

export type SystemSenseInput = {
  __kind: 'SystemSenseInput';
  creatureDesc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  monsterDesc?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type SystemSkill = {
  __typename: 'SystemSkill';
  abilityId: Scalars['ID']['output'];
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
};

export type SystemSkillInput = {
  __kind: 'SystemSkillInput';
  abilityId: Scalars['ID']['input'];
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
};

export type SystemSpell = {
  __typename: 'SystemSpell';
  categories: Array<GenericType>;
  durations: Array<GenericType>;
  ranges: Array<GenericType>;
  requirements: Array<GenericType>;
  schools: Array<GenericType>;
  shapes: Array<GenericType>;
};

export type SystemSpellInput = {
  __kind: 'SystemSpellInput';
  categories: Array<GenericTypeInput>;
  durations: Array<GenericTypeInput>;
  ranges: Array<GenericTypeInput>;
  requirements: Array<GenericTypeInput>;
  schools: Array<GenericTypeInput>;
  shapes: Array<GenericTypeInput>;
};

export type Traits = {
  __typename: 'Traits';
  details?: Maybe<Array<Detail>>;
  size?: Maybe<Scalars['ID']['output']>;
  speeds?: Maybe<RaceSpeed>;
};

export type TraitsInput = {
  __kind: 'TraitsInput';
  details?: InputMaybe<Array<DetailInput>>;
  size?: InputMaybe<Scalars['ID']['input']>;
  speeds?: InputMaybe<RaceSpeedInput>;
};

export type Upcast = {
  __typename: 'Upcast';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
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
  __kind: 'UpcastFieldsInput';
  amount?: InputMaybe<Scalars['Int']['input']>;
  distance?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  maxRange?: InputMaybe<Scalars['Int']['input']>;
  minRange?: InputMaybe<Scalars['Int']['input']>;
  size?: InputMaybe<Scalars['Float']['input']>;
  unit?: InputMaybe<Scalars['ID']['input']>;
};

export type UpcastInput = {
  __kind: 'UpcastInput';
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
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
  __kind: 'UpcastLevelInput';
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
  __kind: 'UsesPerLevelInput';
  level?: InputMaybe<Scalars['Int']['input']>;
  uses?: InputMaybe<Scalars['Int']['input']>;
};

export type Weight = {
  __typename: 'Weight';
  amount?: Maybe<Scalars['Float']['output']>;
  unit: Scalars['ID']['output'];
};

export type WeightInput = {
  __kind: 'WeightInput';
  amount?: InputMaybe<Scalars['Float']['input']>;
  unit: Scalars['ID']['input'];
};

export const CLASSES_ENUM: ClassesEnum[] = [ClassesEnum.ALL, ClassesEnum.BASE, ClassesEnum.PREPARE_LIMIT, ClassesEnum.RESOURCE, ClassesEnum.SPELLCASTER, ClassesEnum.SUBCLASS];
export const CLASSES_ENUM_INPUT: ClassesEnumInput[] = [ClassesEnumInput.ALL, ClassesEnumInput.BASE, ClassesEnumInput.PREPARE_LIMIT, ClassesEnumInput.RESOURCE, ClassesEnumInput.SPELLCASTER, ClassesEnumInput.SUBCLASS];
export const DAMAGE_ENUM: DamageEnum[] = [DamageEnum.ALL, DamageEnum.BONUS, DamageEnum.EQUIPMENT, DamageEnum.MAIN, DamageEnum.POOL];
export const DAMAGE_ENUM_INPUT: DamageEnumInput[] = [DamageEnumInput.ALL, DamageEnumInput.BONUS, DamageEnumInput.EQUIPMENT, DamageEnumInput.MAIN, DamageEnumInput.POOL];
export const EQUIPMENT_ENUM: EquipmentEnum[] = [EquipmentEnum.ADVENTURING_GEAR, EquipmentEnum.ALL, EquipmentEnum.ARMOR, EquipmentEnum.BACKGROUND, EquipmentEnum.CLASS, EquipmentEnum.SHIELD, EquipmentEnum.TOOL, EquipmentEnum.WEAPON];
export const EQUIPMENT_ENUM_INPUT: EquipmentEnumInput[] = [EquipmentEnumInput.ADVENTURING_GEAR, EquipmentEnumInput.ALL, EquipmentEnumInput.ARMOR, EquipmentEnumInput.BACKGROUND, EquipmentEnumInput.CLASS, EquipmentEnumInput.SHIELD, EquipmentEnumInput.TOOL, EquipmentEnumInput.WEAPON];
export const FEAT_ENUM: FeatEnum[] = [FeatEnum.ALL];
export const FEAT_ENUM_INPUT: FeatEnumInput[] = [FeatEnumInput.ALL];
export const FEATURE_ENUM: FeatureEnum[] = [FeatureEnum.ALL, FeatureEnum.EQUIPMENT, FeatureEnum.FEATURE, FeatureEnum.OPTION, FeatureEnum.SAVE_ABILITY];
export const FEATURE_ENUM_INPUT: FeatureEnumInput[] = [FeatureEnumInput.ALL, FeatureEnumInput.EQUIPMENT, FeatureEnumInput.FEATURE, FeatureEnumInput.OPTION, FeatureEnumInput.SAVE_ABILITY];
export const SECTION_ENUM: SectionEnum[] = [SectionEnum.ALL, SectionEnum.SPELL, SectionEnum.SUBCLASS];
export const SECTION_ENUM_INPUT: SectionEnumInput[] = [SectionEnumInput.ALL, SectionEnumInput.SPELL, SectionEnumInput.SUBCLASS];
export const SPELL_ENUM: SpellEnum[] = [SpellEnum.ALL, SpellEnum.DAMAGE, SpellEnum.UPCAST];
export const SPELL_ENUM_INPUT: SpellEnumInput[] = [SpellEnumInput.ALL, SpellEnumInput.DAMAGE, SpellEnumInput.UPCAST];