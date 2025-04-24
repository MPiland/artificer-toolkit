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
  options?: Maybe<Array<GenerateOption>>;
  total?: Maybe<Scalars['Int']['output']>;
  value: Scalars['String']['output'];
};

export type AbilityGenerateMethodInput = {
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  options?: InputMaybe<Array<GenerateOptionInput>>;
  total?: InputMaybe<Scalars['Int']['input']>;
  value: Scalars['String']['input'];
};

export type AbilityScore = {
  __typename: 'AbilityScore';
  abilities?: Maybe<Array<Scalars['ID']['output']>>;
  score?: Maybe<Scalars['Int']['output']>;
};

export type AbilityScoreInput = {
  abilities?: InputMaybe<Array<Scalars['ID']['input']>>;
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

export type Ancestry = {
  __typename: 'Ancestry';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  options: Array<AncestryOption>;
  value: Scalars['String']['output'];
};

export type AncestryFeature = {
  __typename: 'AncestryFeature';
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
  modifiers?: Maybe<Array<FeatureModifier>>;
  options?: Maybe<Array<FeatureOption>>;
  optionsByLevel?: Maybe<Array<OptionsByLevel>>;
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  senses?: Maybe<Array<FeatureSense>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<FeatureSpell>>;
  targets?: Maybe<Scalars['Int']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type AncestryFeatureInput = {
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
  modifiers?: InputMaybe<Array<FeatureModifierInput>>;
  options?: InputMaybe<Array<FeatureOptionInput>>;
  optionsByLevel?: InputMaybe<Array<OptionsByLevelInput>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  senses?: InputMaybe<Array<FeatureSenseInput>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<FeatureSpellInput>>;
  targets?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type AncestryInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  options: Array<AncestryOptionInput>;
  value: Scalars['String']['input'];
};

export type AncestryOption = {
  __typename: 'AncestryOption';
  desc?: Maybe<Scalars['String']['output']>;
  features?: Maybe<Array<AncestryFeature>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type AncestryOptionInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  features?: InputMaybe<Array<AncestryFeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type Background = {
  __typename: 'Background';
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Detail>>;
  equipment?: Maybe<Array<Array<Array<BackgroundEquipment>>>>;
  features?: Maybe<Array<Feature>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type BackgroundConnection = {
  __typename: 'BackgroundConnection';
  items: Array<BackgroundListItem>;
  metaData: BackgroundMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type BackgroundCurrency = {
  __typename: 'BackgroundCurrency';
  amount?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
};

export type BackgroundCurrencyInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};

export type BackgroundEquipment = {
  __typename: 'BackgroundEquipment';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category?: Maybe<Scalars['ID']['output']>;
  currencies?: Maybe<Array<BackgroundCurrency>>;
  equipment?: Maybe<Array<Scalars['ID']['output']>>;
  properties?: Maybe<Array<Scalars['ID']['output']>>;
  quantity?: Maybe<Scalars['Int']['output']>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
};

export type BackgroundEquipmentInput = {
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  currencies?: InputMaybe<Array<InputMaybe<BackgroundCurrencyInput>>>;
  equipment?: InputMaybe<Array<Scalars['ID']['input']>>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
};

export type BackgroundFeatureMetaObject = {
  __typename: 'BackgroundFeatureMetaObject';
  backgroundIds?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
};

export type BackgroundInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<Array<DetailInput>>;
  equipment?: InputMaybe<Array<Array<Array<BackgroundEquipmentInput>>>>;
  features?: InputMaybe<Array<FeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  systemId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
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
  value: Scalars['String']['output'];
};

export type BackgroundMeta = {
  __typename: 'BackgroundMeta';
  features: Array<BackgroundFeatureMetaObject>;
};

export type BackgroundStartingEquipment = {
  __typename: 'BackgroundStartingEquipment';
  addedToCharacter?: Maybe<Scalars['Boolean']['output']>;
  equipmentGroups?: Maybe<Array<StartingEquipmentGroup>>;
};

export type BackgroundStartingEquipmentInput = {
  addedToCharacter?: InputMaybe<Scalars['Boolean']['input']>;
  equipmentGroups?: InputMaybe<Array<StartingEquipmentGroupInput>>;
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
  ownerId: Scalars['String']['output'];
  proficiencies?: Maybe<Array<CharacterProficiency>>;
  race?: Maybe<Scalars['ID']['output']>;
  senses?: Maybe<Array<CharacterSense>>;
  spellcasting?: Maybe<CharacterSpellcasting>;
  systemId: Scalars['String']['output'];
  value: Scalars['String']['output'];
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
  manualRolled?: InputMaybe<ManualRolledInput>;
  pointBuy?: InputMaybe<PointBuyInput>;
  scores?: InputMaybe<Array<ScoresInput>>;
  selectedSystem?: InputMaybe<Scalars['ID']['input']>;
  standardArray?: InputMaybe<Array<StandardArrayInput>>;
};

export type CharacterAncestry = {
  __typename: 'CharacterAncestry';
  id?: Maybe<Scalars['ID']['output']>;
  lineages?: Maybe<Array<Scalars['ID']['output']>>;
  raceId?: Maybe<Scalars['ID']['output']>;
};

export type CharacterAncestryInput = {
  id?: InputMaybe<Scalars['ID']['input']>;
  lineage?: InputMaybe<Array<LineageInput>>;
  raceId?: InputMaybe<Scalars['ID']['input']>;
};

export type CharacterClass = {
  __typename: 'CharacterClass';
  id: Scalars['ID']['output'];
  level: Scalars['Int']['output'];
  subclass?: Maybe<Subclass>;
};

export type CharacterClassInput = {
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
  expertiseId: Scalars['ID']['output'];
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
  language?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  property?: Maybe<Scalars['ID']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  saveAbility?: Maybe<Scalars['ID']['output']>;
  skill?: Maybe<Scalars['ID']['output']>;
};

export type CharacterExpertiseInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipment?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  expertiseId: Scalars['ID']['input'];
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
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
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
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
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
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
  options?: Maybe<Array<CharacterFeatureOption>>;
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
  featureLevel: Scalars['Int']['input'];
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
  bonus?: InputMaybe<Scalars['Int']['input']>;
  fixed?: InputMaybe<HitpointFixedInput>;
  maxHitpoints?: InputMaybe<Scalars['Int']['input']>;
  maxOverride?: InputMaybe<Scalars['Int']['input']>;
  method: Scalars['ID']['input'];
  rolled?: InputMaybe<HitpointRollInput>;
  temp?: InputMaybe<Scalars['Int']['input']>;
};

export type CharacterInput = {
  abilities?: InputMaybe<CharacterAbilitiesInput>;
  advancement?: InputMaybe<Scalars['ID']['input']>;
  ancestry?: InputMaybe<CharacterAncestryInput>;
  background?: InputMaybe<Scalars['ID']['input']>;
  backgroundEquipment?: InputMaybe<BackgroundStartingEquipmentInput>;
  classEquipment?: InputMaybe<ClassStartingEquipmentInput>;
  classes?: InputMaybe<Array<InputMaybe<CharacterClassInput>>>;
  currencyGroups?: InputMaybe<Array<CurrencyGroupInput>>;
  desc?: InputMaybe<Scalars['String']['input']>;
  equipment: CharacterEquipmentInput;
  exp?: InputMaybe<Scalars['Int']['input']>;
  expertise?: InputMaybe<CharacterExpertiseInput>;
  feats?: InputMaybe<Array<CharacterFeatInput>>;
  features?: InputMaybe<Array<CharacterFeatureInput>>;
  hitpoint?: InputMaybe<CharacterHitpointInput>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  modifiers?: InputMaybe<CharacterModifierInput>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  proficiencies?: InputMaybe<CharacterProficiencyInput>;
  race?: InputMaybe<Scalars['ID']['input']>;
  senses?: InputMaybe<Array<CharacterSenseInput>>;
  spellcasting?: InputMaybe<CharacterSpellcastingInput>;
  systemId: Scalars['String']['input'];
  value: Scalars['String']['input'];
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
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
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
  equipment?: Maybe<Scalars['ID']['output']>;
  equipmentId?: Maybe<Scalars['ID']['output']>;
  featId?: Maybe<Scalars['ID']['output']>;
  featureId?: Maybe<Scalars['ID']['output']>;
  featureLevel?: Maybe<Scalars['Int']['output']>;
  language?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  proficiencyId: Scalars['ID']['output'];
  property?: Maybe<Scalars['ID']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  saveAbility?: Maybe<Scalars['ID']['output']>;
  skill?: Maybe<Scalars['ID']['output']>;
};

export type CharacterProficiencyInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipment?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
  language?: InputMaybe<Scalars['ID']['input']>;
  optionId?: InputMaybe<Scalars['ID']['input']>;
  optionIndex?: InputMaybe<Scalars['String']['input']>;
  proficiencyId: Scalars['ID']['input'];
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
  id?: Maybe<Scalars['ID']['output']>;
  optionId?: Maybe<Scalars['ID']['output']>;
  optionIndex?: Maybe<Scalars['String']['output']>;
  raceId?: Maybe<Scalars['ID']['output']>;
  senseId: Scalars['ID']['output'];
};

export type CharacterSenseInput = {
  ancestryId?: InputMaybe<Scalars['ID']['input']>;
  backgroundId?: InputMaybe<Scalars['ID']['input']>;
  classId?: InputMaybe<Scalars['ID']['input']>;
  equipmentId?: InputMaybe<Scalars['ID']['input']>;
  featId?: InputMaybe<Scalars['ID']['input']>;
  featureId?: InputMaybe<Scalars['ID']['input']>;
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
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
  advancementMethods: Array<GenericTypeInput>;
  hitpointCalcMethods: Array<GenericTypeInput>;
  spellPointCalcMethods: Array<GenericTypeInput>;
  startingEquipmentOptions: Array<GenericTypeInput>;
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
  featureLevel?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  isRitual?: Maybe<Scalars['Boolean']['output']>;
  level: Scalars['Int']['output'];
  optionId?: Maybe<Scalars['ID']['output']>;
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
  featureLevel?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  isRitual?: InputMaybe<Scalars['Boolean']['input']>;
  level: Scalars['Int']['input'];
  optionId?: InputMaybe<Scalars['ID']['input']>;
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
  additional?: Maybe<Array<CharacterSpell>>;
  known?: Maybe<Array<ClassSpellList>>;
  prepared?: Maybe<Array<ClassSpellList>>;
  spellSlots?: Maybe<Array<CharacterSpellSlots>>;
};

export type CharacterSpellcastingInput = {
  additional?: InputMaybe<Array<CharacterSpellInput>>;
  known?: InputMaybe<Array<ClassSpellListInput>>;
  prepared?: InputMaybe<Array<ClassSpellListInput>>;
  spellSlots?: InputMaybe<Array<CharacterSpellSlotsInputs>>;
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
  value: Scalars['String']['output'];
};

export type ChargeOptionInput = {
  classes?: InputMaybe<Array<ClassesEnumInput>>;
  damage?: InputMaybe<Array<DamageEnumInput>>;
  equipment?: InputMaybe<Array<EquipmentEnumInput>>;
  feats?: InputMaybe<Array<FeatEnumInput>>;
  features?: InputMaybe<Array<FeatureEnumInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<SectionEnumInput>>;
  spells?: InputMaybe<Array<SpellEnumInput>>;
  value: Scalars['String']['input'];
};

export type Class = {
  __typename: 'Class';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category: Scalars['ID']['output'];
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Detail>>;
  equipment?: Maybe<Array<Array<Array<ClassEquipment>>>>;
  features?: Maybe<Array<Feature>>;
  hitpoint?: Maybe<Hitpoint>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAttributes?: Maybe<Array<LevelAttribute>>;
  masterId?: Maybe<Scalars['String']['output']>;
  multiclass?: Maybe<Multiclass>;
  ownerId: Scalars['ID']['output'];
  parentClass?: Maybe<Scalars['ID']['output']>;
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  resource?: Maybe<Resource>;
  spellcasting?: Maybe<Spellcasting>;
  startingGold?: Maybe<StartingGold>;
  subtypes?: Maybe<Array<Subtype>>;
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type ClassConnection = {
  __typename: 'ClassConnection';
  items: Array<ClassListItem>;
  metaData: ClassMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type ClassCurrency = {
  __typename: 'ClassCurrency';
  amount?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
};

export type ClassCurrencyInput = {
  amount?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
};

export type ClassEquipment = {
  __typename: 'ClassEquipment';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category?: Maybe<Scalars['ID']['output']>;
  currencies?: Maybe<Array<Maybe<ClassCurrency>>>;
  equipment?: Maybe<Array<Scalars['ID']['output']>>;
  properties?: Maybe<Array<Scalars['ID']['output']>>;
  quantity?: Maybe<Scalars['Int']['output']>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
};

export type ClassEquipmentInput = {
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  currencies?: InputMaybe<Array<ClassCurrencyInput>>;
  equipment?: InputMaybe<Array<Scalars['ID']['input']>>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
  quantity?: InputMaybe<Scalars['Int']['input']>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
};

export type ClassFeatureMetaObject = {
  __typename: 'ClassFeatureMetaObject';
  classIds?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
};

export type ClassFilter = {
  __typename: 'ClassFilter';
  count: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
};

export type ClassInput = {
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category: Scalars['ID']['input'];
  desc?: InputMaybe<Scalars['String']['input']>;
  details?: InputMaybe<Array<DetailInput>>;
  equipment?: InputMaybe<Array<Array<Array<ClassEquipmentInput>>>>;
  features?: InputMaybe<Array<FeatureInput>>;
  hitpoint?: InputMaybe<HitpointInput>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  levelAttributes?: InputMaybe<Array<LevelAttributeInput>>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  multiclass?: InputMaybe<MulticlassInput>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  parentClass?: InputMaybe<Scalars['ID']['input']>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  resource?: InputMaybe<ResourceInput>;
  spellcasting?: InputMaybe<SpellcastingInput>;
  startingGold?: InputMaybe<StartingGoldInput>;
  subtypes?: InputMaybe<Array<SubtypeInput>>;
  systemId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type ClassListItem = {
  __typename: 'ClassListItem';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['ID']['output'];
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type ClassMeta = {
  __typename: 'ClassMeta';
  categories: Array<ClassMetaObject>;
  features: Array<ClassFeatureMetaObject>;
  optionalAbilities: Array<ClassMultiClassMetaObject>;
  parentClasses: Array<ClassMetaObject>;
  primaryAbilities: Array<ClassMultiClassMetaObject>;
  secondaryAbilities: Array<ClassMultiClassMetaObject>;
};

export type ClassMetaObject = {
  __typename: 'ClassMetaObject';
  classIds?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
};

export type ClassMultiClassMetaObject = {
  __typename: 'ClassMultiClassMetaObject';
  amount?: Maybe<Scalars['Int']['output']>;
  classIds?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
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
  spells?: Maybe<Array<ClassSpell>>;
};

export type ClassSpellListInput = {
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
  id: Scalars['ID']['input'];
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
  abbreviation: Scalars['String']['output'];
  conversions: CurrencyConversion;
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

export type CurrencyGroup = {
  __typename: 'CurrencyGroup';
  container?: Maybe<Scalars['ID']['output']>;
  currencies?: Maybe<Array<CharacterCurrency>>;
};

export type CurrencyGroupInput = {
  container?: InputMaybe<Scalars['ID']['input']>;
  currencies?: InputMaybe<Array<CharacterCurrencyInput>>;
};

export type CurrencyInput = {
  abbreviation: Scalars['String']['input'];
  conversions: CurrencyConversionInput;
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  value: Scalars['String']['input'];
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
  equipment?: Maybe<Array<Scalars['ID']['output']>>;
  numberEquipped?: Maybe<Scalars['Int']['output']>;
  properties?: Maybe<Array<Scalars['ID']['output']>>;
};

export type EquipPrerequisiteInput = {
  category?: InputMaybe<Scalars['ID']['input']>;
  equipment?: InputMaybe<Array<Scalars['ID']['input']>>;
  numberEquipped?: InputMaybe<Scalars['Int']['input']>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type EquipementCostMeta = {
  __typename: 'EquipementCostMeta';
  amount?: Maybe<Scalars['Int']['output']>;
  equipmentIds?: Maybe<Array<Scalars['ID']['output']>>;
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
  items: Array<EquipmentListItem>;
  metaData: EquipmentMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
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

export type EquipmentFeatureMetaObject = {
  __typename: 'EquipmentFeatureMetaObject';
  equipmentIds?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
};

export type EquipmentInput = {
  Rank?: InputMaybe<Scalars['Int']['input']>;
  armorClass?: InputMaybe<Scalars['Int']['input']>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  capacity?: InputMaybe<CapacityInput>;
  category: Scalars['ID']['input'];
  contains?: InputMaybe<Array<ContainsInput>>;
  cost?: InputMaybe<CostInput>;
  damage?: InputMaybe<DamageInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  features?: InputMaybe<Array<FeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  masterId?: InputMaybe<Scalars['String']['input']>;
  maxBonus?: InputMaybe<Scalars['Int']['input']>;
  maxStack?: InputMaybe<Scalars['Int']['input']>;
  optionalAbility?: InputMaybe<Scalars['ID']['input']>;
  ownerId?: InputMaybe<Scalars['String']['input']>;
  prerequisities?: InputMaybe<PrerequisiteInput>;
  primaryAbility?: InputMaybe<Scalars['ID']['input']>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
  quantity: Scalars['Int']['input'];
  quote?: InputMaybe<Scalars['String']['input']>;
  range?: InputMaybe<EquipmentRangeInput>;
  rarity: Scalars['ID']['input'];
  saveAbility?: InputMaybe<SaveAbilityInput>;
  secondaryAbility?: InputMaybe<Scalars['ID']['input']>;
  speed?: InputMaybe<SpeedInput>;
  systemId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
  weight?: InputMaybe<WeightInput>;
};

export type EquipmentListItem = {
  __typename: 'EquipmentListItem';
  cost?: Maybe<Cost>;
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  quote?: Maybe<Scalars['String']['output']>;
  rank?: Maybe<Scalars['Int']['output']>;
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
  weight?: Maybe<Weight>;
};

export type EquipmentMeta = {
  __typename: 'EquipmentMeta';
  armorClasses: Array<EquipmentMetaObject>;
  categories: Array<EquipmentMetaObject>;
  cost: Array<EquipementCostMeta>;
  features: Array<EquipmentFeatureMetaObject>;
  primaryDamages: Array<EquipmentMetaObject>;
  properties: Array<EquipmentMetaObject>;
  secondaryDamages: Array<EquipmentMetaObject>;
  versatileDamages: Array<EquipmentMetaObject>;
  weight: Array<EquipmentWeightMeta>;
};

export type EquipmentMetaObject = {
  __typename: 'EquipmentMetaObject';
  equipmentIds?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
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

export type EquipmentWeightMeta = {
  __typename: 'EquipmentWeightMeta';
  amount?: Maybe<Scalars['Float']['output']>;
  equipmentIds?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
};

export type Feat = {
  __typename: 'Feat';
  actions?: Maybe<ActionGroup>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  bonusDamage?: Maybe<Damage>;
  category?: Maybe<Scalars['ID']['output']>;
  charges?: Maybe<Charge>;
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  expertise?: Maybe<Array<FeatureProficiency>>;
  feats?: Maybe<Array<FeatureFeat>>;
  features?: Maybe<Array<Feature>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAvailable?: Maybe<Scalars['String']['output']>;
  masterId?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<FeatureModifier>>;
  options?: Maybe<Array<FeatureOption>>;
  ownerId: Scalars['String']['output'];
  prerequisites?: Maybe<Prerequisite>;
  primaryDamage?: Maybe<Damage>;
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  secondaryDamage?: Maybe<Damage>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  senses?: Maybe<Array<FeatureSense>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<FeatureSpell>>;
  systemId: Scalars['ID']['output'];
  targets?: Maybe<Scalars['Int']['output']>;
  value: Scalars['String']['output'];
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

export type FeatFeatureMetaObject = {
  __typename: 'FeatFeatureMetaObject';
  featIds?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
};

export type FeatInput = {
  actions?: InputMaybe<ActionGroupInput>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  bonusDamage?: InputMaybe<DamageInput>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charges?: InputMaybe<ChargeInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  detail?: InputMaybe<Scalars['String']['input']>;
  expertise?: InputMaybe<Array<FeatureProficiencyInput>>;
  feats?: InputMaybe<Array<FeatureFeatInput>>;
  features?: InputMaybe<Array<FeatureInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  levelAvailable?: InputMaybe<Scalars['String']['input']>;
  masterId?: InputMaybe<Scalars['String']['input']>;
  modifiers?: InputMaybe<Array<FeatureModifierInput>>;
  options?: InputMaybe<Array<FeatureOptionInput>>;
  ownerId: Scalars['String']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  primaryDamage?: InputMaybe<DamageInput>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  secondaryDamage?: InputMaybe<DamageInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  senses?: InputMaybe<Array<FeatureSenseInput>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<FeatureSpellInput>>;
  systemId: Scalars['ID']['input'];
  targets?: InputMaybe<Scalars['Int']['input']>;
  value: Scalars['String']['input'];
};

export type FeatListItem = {
  __typename: 'FeatListItem';
  desc?: Maybe<Scalars['String']['output']>;
  detail?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['String']['output'];
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type FeatMeta = {
  __typename: 'FeatMeta';
  features: Array<FeatFeatureMetaObject>;
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
  label?: Maybe<Scalars['String']['output']>;
  levelAvailable?: Maybe<Scalars['String']['output']>;
  modifiers?: Maybe<Array<FeatureModifier>>;
  options?: Maybe<Array<FeatureOption>>;
  optionsByLevel?: Maybe<Array<OptionsByLevel>>;
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  senses?: Maybe<Array<FeatureSense>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<FeatureSpell>>;
  targets?: Maybe<Scalars['Int']['output']>;
  value?: Maybe<Scalars['String']['output']>;
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
  prerequisites?: Maybe<Prerequisite>;
  properties?: Maybe<ProficiencyProperties>;
  saveAbilities?: Maybe<Array<Scalars['ID']['output']>>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  skills?: Maybe<Array<Scalars['ID']['output']>>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureExpertiseInput = {
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category: Scalars['ID']['input'];
  equipment?: InputMaybe<ProficiencyPropertiesInput>;
  id: Scalars['ID']['input'];
  languages?: InputMaybe<Array<Scalars['ID']['input']>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  properties?: InputMaybe<ProficiencyPropertiesInput>;
  saveAbilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<Scalars['ID']['input']>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureFeat = {
  __typename: 'FeatureFeat';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  feats?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureFeatInput = {
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  feats?: InputMaybe<Array<Scalars['ID']['input']>>;
  id: Scalars['ID']['input'];
  prerequisites?: InputMaybe<PrerequisiteInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureInput = {
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
  modifiers?: InputMaybe<Array<FeatureModifierInput>>;
  options?: InputMaybe<Array<FeatureOptionInput>>;
  optionsByLevel?: InputMaybe<Array<OptionsByLevelInput>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  senses?: InputMaybe<Array<FeatureSenseInput>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<FeatureSpellInput>>;
  targets?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type FeatureModifier = {
  __typename: 'FeatureModifier';
  abilities?: Maybe<Array<Scalars['ID']['output']>>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  category?: Maybe<Scalars['ID']['output']>;
  charge?: Maybe<Charge>;
  conditions?: Maybe<Array<Scalars['ID']['output']>>;
  damageType?: Maybe<Scalars['ID']['output']>;
  damageTypes?: Maybe<Array<Scalars['ID']['output']>>;
  dieConfig?: Maybe<Scalars['String']['output']>;
  diePerLevel?: Maybe<Array<ModifierDiePerLevel>>;
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
  type?: Maybe<Scalars['ID']['output']>;
  unit?: Maybe<Scalars['ID']['output']>;
};

export type FeatureModifierInput = {
  abilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category?: InputMaybe<Scalars['ID']['input']>;
  charge?: InputMaybe<ChargeInput>;
  conditions?: InputMaybe<Array<Scalars['ID']['input']>>;
  damageType?: InputMaybe<Scalars['ID']['input']>;
  damageTypes?: InputMaybe<Array<Scalars['ID']['input']>>;
  dieConfig?: InputMaybe<Scalars['String']['input']>;
  diePerLevel?: InputMaybe<Array<ModifierDiePerLevelInput>>;
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
  modifiers?: Maybe<Array<FeatureModifier>>;
  prerequisites?: Maybe<Prerequisite>;
  proficiencies?: Maybe<Array<FeatureProficiency>>;
  range?: Maybe<Range>;
  saveAbility?: Maybe<SaveAbility>;
  senses?: Maybe<Array<FeatureSense>>;
  shape?: Maybe<Shape>;
  spells?: Maybe<Array<FeatureSpell>>;
  targets?: Maybe<Scalars['Int']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

export type FeatureOptionInput = {
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
  modifiers?: InputMaybe<Array<FeatureModifierInput>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  proficiencies?: InputMaybe<Array<FeatureProficiencyInput>>;
  range?: InputMaybe<RangeInput>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  senses?: InputMaybe<Array<FeatureSenseInput>>;
  shape?: InputMaybe<ShapeInput>;
  spells?: InputMaybe<Array<FeatureSpellInput>>;
  targets?: InputMaybe<Scalars['Int']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

export type FeatureProficiency = {
  __typename: 'FeatureProficiency';
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

export type FeatureProficiencyInput = {
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  category: Scalars['ID']['input'];
  equipment?: InputMaybe<ProficiencyPropertiesInput>;
  id: Scalars['ID']['input'];
  languages?: InputMaybe<Array<Scalars['ID']['input']>>;
  level?: InputMaybe<Scalars['ID']['input']>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  properties?: InputMaybe<ProficiencyPropertiesInput>;
  rounding?: InputMaybe<Scalars['ID']['input']>;
  saveAbilities?: InputMaybe<Array<Scalars['ID']['input']>>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  skills?: InputMaybe<Array<Scalars['ID']['input']>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
};

export type FeatureSense = {
  __typename: 'FeatureSense';
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureSenseInput = {
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
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
  attributeLimit?: Maybe<Array<Scalars['ID']['output']>>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  charges?: Maybe<Charge>;
  classLimit?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  levelLimit?: Maybe<Array<Scalars['String']['output']>>;
  prerequisites?: Maybe<Prerequisite>;
  selectionCount?: Maybe<Scalars['Int']['output']>;
  spellLevel?: Maybe<Scalars['Int']['output']>;
  spellsByLevel?: Maybe<Array<SpellsByLevel>>;
  subtype?: Maybe<Scalars['ID']['output']>;
};

export type FeatureSpellInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  attributeLimit?: InputMaybe<Array<Scalars['ID']['input']>>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  charges?: InputMaybe<ChargeInput>;
  classLimit?: InputMaybe<Array<Scalars['ID']['input']>>;
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  levelLimit?: InputMaybe<Array<Scalars['String']['input']>>;
  prerequisites?: InputMaybe<PrerequisiteInput>;
  selectionCount?: InputMaybe<Scalars['Int']['input']>;
  spellLevel?: InputMaybe<Scalars['Int']['input']>;
  spellsByLevel?: InputMaybe<Array<SpellsByLevelInput>>;
  subtype?: InputMaybe<Scalars['ID']['input']>;
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

export type HitpointFixed = {
  __typename: 'HitpointFixed';
  current?: Maybe<Scalars['Int']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
};

export type HitpointFixedInput = {
  current?: InputMaybe<Scalars['Int']['input']>;
  total?: InputMaybe<Scalars['Int']['input']>;
};

export type HitpointInput = {
  ability?: InputMaybe<Scalars['ID']['input']>;
  dieConfig?: InputMaybe<Scalars['String']['input']>;
};

export type HitpointRoll = {
  __typename: 'HitpointRoll';
  current?: Maybe<Scalars['Int']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
  values?: Maybe<Array<HitpointRollValues>>;
};

export type HitpointRollInput = {
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
  cantripsKnownLimit?: InputMaybe<Scalars['Int']['input']>;
  level?: InputMaybe<Scalars['Int']['input']>;
  resourcePoints?: InputMaybe<Scalars['Int']['input']>;
  spellSlots?: InputMaybe<Array<SpellSlotInput>>;
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
  manual?: Maybe<Array<Manual>>;
  rollGroups?: Maybe<Array<Array<RollType>>>;
};

export type ManualRolledInput = {
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
  batchCreateMasterBackgrounds: Array<Background>;
  batchCreateMasterClasses: Array<Class>;
  batchCreateMasterEquipment: Array<Equipment>;
  batchCreateMasterFeats: Array<Feat>;
  batchCreateMasterRaces: Array<Race>;
  batchCreateMasterSpells: Array<Spell>;
  batchCreateMasterSystems: Array<System>;
  batchCreateRaces: Array<Race>;
  batchCreateSpells: Array<Spell>;
  batchCreateSystems: Array<System>;
  createBackground: Background;
  createCharacter: Character;
  createClass: Class;
  createEquipment: Equipment;
  createFeat: Feat;
  createMasterBackground: Background;
  createMasterClass: Class;
  createMasterEquipment: Equipment;
  createMasterFeat: Feat;
  createMasterRace: Race;
  createMasterSpell: Spell;
  createMasterSystem: System;
  createRace: Race;
  createSpell: Spell;
  createSystem: System;
  deleteBackground: Scalars['ID']['output'];
  deleteCharacter: Scalars['ID']['output'];
  deleteClass: Scalars['ID']['output'];
  deleteEquipment: Scalars['ID']['output'];
  deleteFeat: Scalars['ID']['output'];
  deleteMasterBackground: Scalars['ID']['output'];
  deleteMasterClass: Scalars['ID']['output'];
  deleteMasterEquipment: Scalars['ID']['output'];
  deleteMasterFeat: Scalars['ID']['output'];
  deleteMasterRace: Scalars['ID']['output'];
  deleteMasterSpell: Scalars['ID']['output'];
  deleteMasterSystem: Scalars['ID']['output'];
  deleteRace: Scalars['ID']['output'];
  deleteSpell: Scalars['ID']['output'];
  deleteSystem: Scalars['ID']['output'];
  updateBackground: Background;
  updateCharacter: Character;
  updateClass: Class;
  updateEquipment: Equipment;
  updateFeat: Feat;
  updateMasterBackground: Background;
  updateMasterClass: Class;
  updateMasterEquipment: Equipment;
  updateMasterFeat: Feat;
  updateMasterRace: Race;
  updateMasterSpell: Spell;
  updateMasterSystem: System;
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
  distributed?: InputMaybe<Array<DistributedInput>>;
  pointsLeft?: InputMaybe<Scalars['Int']['input']>;
};

export type Possessions = {
  __typename: 'Possessions';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type PossessionsInput = {
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type PrepareLimit = {
  __typename: 'PrepareLimit';
  level?: Maybe<PrepareLimitLevel>;
  methods?: Maybe<Array<Scalars['ID']['output']>>;
};

export type PrepareLimitInput = {
  level?: InputMaybe<PrepareLimitLevelInput>;
  methods?: InputMaybe<Array<Scalars['ID']['input']>>;
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
  ids?: Maybe<Array<Scalars['ID']['output']>>;
  properties?: Maybe<Array<Scalars['ID']['output']>>;
};

export type ProficiencyPropertiesInput = {
  category?: InputMaybe<Scalars['ID']['input']>;
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  properties?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type Query = {
  __typename: 'Query';
  getBackground?: Maybe<Background>;
  getCharacter?: Maybe<Character>;
  getClass?: Maybe<Class>;
  getEquipment?: Maybe<Equipment>;
  getFeat?: Maybe<Feat>;
  getMasterBackground?: Maybe<Background>;
  getMasterClass?: Maybe<Class>;
  getMasterEquipment?: Maybe<Equipment>;
  getMasterFeat?: Maybe<Feat>;
  getMasterRace?: Maybe<Race>;
  getMasterSpell?: Maybe<Spell>;
  getMasterSystem?: Maybe<System>;
  getRace?: Maybe<Race>;
  getSpell?: Maybe<Spell>;
  getSystem?: Maybe<System>;
  listBackgrounds: BackgroundConnection;
  listCharacters: CharacterConnection;
  listClasses: ClassConnection;
  listEquipment: EquipmentConnection;
  listFeats: FeatConnection;
  listMasterBackgrounds: BackgroundConnection;
  listMasterClasses: ClassConnection;
  listMasterEquipment: EquipmentConnection;
  listMasterFeats: FeatConnection;
  listMasterRaces: RaceConnection;
  listMasterSpells: SpellConnection;
  listMasterSystems: SystemConnection;
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
  value: Scalars['String']['output'];
};

export type RaceConnection = {
  __typename: 'RaceConnection';
  items: Array<RaceListItem>;
  metaData: RaceMeta;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type RaceFeatureMetaObject = {
  __typename: 'RaceFeatureMetaObject';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  raceIds?: Maybe<Array<Scalars['ID']['output']>>;
};

export type RaceInput = {
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
  value: Scalars['String']['input'];
};

export type RaceListItem = {
  __typename: 'RaceListItem';
  desc?: Maybe<Scalars['String']['output']>;
  details?: Maybe<Array<Detail>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  quote?: Maybe<Scalars['String']['output']>;
  systemId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type RaceMeta = {
  __typename: 'RaceMeta';
  categories: Array<RaceMetaObject>;
  features: Array<RaceFeatureMetaObject>;
  lineages: Array<RaceMetaObject>;
  playable: Array<RaceMetaObject>;
};

export type RaceMetaObject = {
  __typename: 'RaceMetaObject';
  id: Scalars['ID']['output'];
  raceIds?: Maybe<Array<Scalars['ID']['output']>>;
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
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  levelAvailable?: Maybe<Scalars['Int']['output']>;
  method?: Maybe<Scalars['ID']['output']>;
  value: Scalars['String']['output'];
};

export type ResourceInput = {
  charges?: InputMaybe<ChargeInput>;
  desc?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  levelAvailable?: InputMaybe<Scalars['Int']['input']>;
  method?: InputMaybe<Scalars['ID']['input']>;
  value: Scalars['String']['input'];
};

export type Roll = {
  __typename: 'Roll';
  die: Scalars['Int']['output'];
  id?: Maybe<Scalars['String']['output']>;
  value: Scalars['Int']['output'];
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
  kept?: Maybe<Array<Roll>>;
  rolled: Array<Roll>;
  rolling: Scalars['Boolean']['output'];
  score: Scalars['Int']['output'];
};

export type RollTypeInput = {
  ability: Scalars['ID']['input'];
  applied: Scalars['Boolean']['input'];
  kept?: InputMaybe<Array<RollInput>>;
  rolled: Array<RollInput>;
  rolling: Scalars['Boolean']['input'];
  score: Scalars['Int']['input'];
};

export type SaveAbility = {
  __typename: 'SaveAbility';
  abilityModifier?: Maybe<Scalars['ID']['output']>;
  attributes?: Maybe<Array<Scalars['ID']['output']>>;
  id: Scalars['ID']['output'];
  minAmount?: Maybe<Scalars['Int']['output']>;
};

export type SaveAbilityInput = {
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
  ModifierScore?: InputMaybe<Scalars['Int']['input']>;
  ability: Scalars['ID']['input'];
  baseScore?: InputMaybe<Scalars['Int']['input']>;
  calculatedScore?: InputMaybe<Scalars['Int']['input']>;
  classScore?: InputMaybe<Scalars['Int']['input']>;
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
  value: Scalars['String']['output'];
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
  ownerId?: InputMaybe<Scalars['String']['input']>;
  range: RangeInput;
  requirements?: InputMaybe<Array<Scalars['ID']['input']>>;
  saveAbility?: InputMaybe<SaveAbilityInput>;
  school: Scalars['ID']['input'];
  shape?: InputMaybe<ShapeInput>;
  systemId: Scalars['ID']['input'];
  targets?: InputMaybe<Scalars['Int']['input']>;
  upcast?: InputMaybe<UpcastInput>;
  value: Scalars['String']['input'];
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
  value: Scalars['String']['output'];
};

export type SpellMeta = {
  __typename: 'SpellMeta';
  attributes: Array<SpellMetaObject>;
  classes: Array<SpellMetaObject>;
  conditions: Array<SpellMetaObject>;
  durations: Array<SpellDurationMetaObject>;
  levels: Array<SpellLevelObject>;
  primaryActions: Array<SpellMetaObject>;
  primaryDamages: Array<SpellMetaObject>;
  ranges: Array<SpellRangeMetaObject>;
  requirements: Array<SpellMetaObject>;
  saveAbilities: Array<SpellMetaObject>;
  schools: Array<SpellMetaObject>;
  secondaryActions: Array<SpellMetaObject>;
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
  ability?: InputMaybe<Scalars['ID']['input']>;
  attributes?: InputMaybe<Array<Scalars['ID']['input']>>;
  charges?: InputMaybe<ChargeInput>;
  magicName?: InputMaybe<Scalars['String']['input']>;
  maxSpellLevel?: InputMaybe<Scalars['Int']['input']>;
  prepareLimit?: InputMaybe<PrepareLimitInput>;
};

export type SpellsByLevel = {
  __typename: 'SpellsByLevel';
  level?: Maybe<Scalars['Int']['output']>;
  spellLevel?: Maybe<Scalars['Int']['output']>;
  spells?: Maybe<Array<Scalars['ID']['output']>>;
};

export type SpellsByLevelInput = {
  id: Scalars['ID']['input'];
  level?: InputMaybe<Scalars['Int']['input']>;
  spellLevel?: InputMaybe<Scalars['Int']['input']>;
  spells?: InputMaybe<Array<Scalars['ID']['input']>>;
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
  equipment?: InputMaybe<Array<StartingEquipmentInput>>;
  groupId: Scalars['ID']['input'];
  optionId: Scalars['ID']['input'];
};

export type StartingEquipmentInput = {
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
  ownerId: Scalars['String']['output'];
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
  classes?: Maybe<Array<ClassesEnum>>;
  damage?: Maybe<Array<DamageEnum>>;
  equipment?: Maybe<Array<EquipmentEnum>>;
  feats?: Maybe<Array<FeatEnum>>;
  features?: Maybe<Array<FeatureEnum>>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  sections?: Maybe<Array<SectionEnum>>;
  spells?: Maybe<Array<SpellEnum>>;
  value: Scalars['String']['output'];
};

export type SystemAttributeInput = {
  classes?: InputMaybe<Array<ClassesEnumInput>>;
  damage?: InputMaybe<Array<DamageEnumInput>>;
  equipment?: InputMaybe<Array<EquipmentEnumInput>>;
  feats?: InputMaybe<Array<FeatEnumInput>>;
  features?: InputMaybe<Array<FeatureEnumInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<SectionEnumInput>>;
  spells?: InputMaybe<Array<SpellEnumInput>>;
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
  limits: Array<ChargeOption>;
  resets: Array<ChargeOption>;
};

export type SystemChargesInput = {
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
  categories: Array<GenericTypeInput>;
  categoryProperties: Array<EquipmentCategoryPropertyInput>;
  properties: Array<GenericTypeInput>;
  rarities: Array<GenericTypeInput>;
};

export type SystemInput = {
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
  ownerId: Scalars['String']['input'];
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
  value: Scalars['String']['input'];
};

export type SystemListItem = {
  __typename: 'SystemListItem';
  desc?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  masterId?: Maybe<Scalars['String']['output']>;
  ownerId: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

export type SystemMeasurement = {
  __typename: 'SystemMeasurement';
  amount: Array<GenericType>;
  imperial: Imperial;
  rounding: Array<GenericType>;
};

export type SystemMeasurementInput = {
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
  value: Scalars['String']['output'];
};

export type SystemPrerequisiteInput = {
  classes?: InputMaybe<Array<ClassesEnumInput>>;
  damage?: InputMaybe<Array<DamageEnumInput>>;
  equipment?: InputMaybe<Array<EquipmentEnumInput>>;
  feats?: InputMaybe<Array<FeatEnumInput>>;
  features?: InputMaybe<Array<FeatureEnumInput>>;
  id: Scalars['ID']['input'];
  label: Scalars['String']['input'];
  sections?: InputMaybe<Array<SectionEnumInput>>;
  spells?: InputMaybe<Array<SpellEnumInput>>;
  value: Scalars['String']['input'];
};

export type SystemProficiency = {
  __typename: 'SystemProficiency';
  categories: Array<GenericType>;
  levels: Array<ProficiencyLevel>;
};

export type SystemProficiencyInput = {
  categories: Array<GenericTypeInput>;
  levels: Array<ProficiencyLevelInput>;
};

export type SystemRules = {
  __typename: 'SystemRules';
  abilityGenerateMethod: Array<AbilityGenerateMethod>;
  measurements: SystemMeasurement;
};

export type SystemRulesInput = {
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
  categories: Array<GenericType>;
  durations: Array<GenericType>;
  ranges: Array<GenericType>;
  requirements: Array<GenericType>;
  schools: Array<GenericType>;
  shapes: Array<GenericType>;
};

export type SystemSpellInput = {
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
  amount?: InputMaybe<Scalars['Int']['input']>;
  distance?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['ID']['input']>;
  maxRange?: InputMaybe<Scalars['Int']['input']>;
  minRange?: InputMaybe<Scalars['Int']['input']>;
  size?: InputMaybe<Scalars['Float']['input']>;
  unit?: InputMaybe<Scalars['ID']['input']>;
};

export type UpcastInput = {
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
