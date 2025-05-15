import { z } from 'zod'
import type {
  AbilityGenerateMethodInput,
  AbilityScoreInput,
  ActionGroupInput,
  ActionPropertyInput,
  AncestryFeatureInput,
  AncestryInput,
  AncestryOptionInput,
  BackgroundCurrencyInput,
  BackgroundEquipmentInput,
  BackgroundInput,
  BackgroundStartingEquipmentInput,
  BatchBackgroundsInput,
  BatchClassesInput,
  BatchEquipmentInput,
  BatchFeatInput,
  BatchRacesInput,
  BatchSpellsInput,
  BatchSystemsInput,
  CapacityInput,
  CharacterAbilitiesInput,
  CharacterAncestryInput,
  CharacterClassInput,
  CharacterCurrencyInput,
  CharacterEquipmentInput,
  CharacterEquipmentObjectInput,
  CharacterExpertiseInput,
  CharacterFeatInput,
  CharacterFeatureInput,
  CharacterFeatureOptionInput,
  CharacterHitpointInput,
  CharacterInput,
  CharacterModifierInput,
  CharacterProficiencyInput,
  CharacterSenseInput,
  CharacterSettingInput,
  CharacterSpellInput,
  CharacterSpellSlotsInputs,
  CharacterSpellcastingInput,
  ChargeInput,
  ChargeOptionInput,
  ClassCurrencyInput,
  ClassEquipmentInput,
  ClassInput,
  ClassSpellInput,
  ClassSpellListInput,
  ClassStartingEquipmentInput,
  ContainsInput,
  CostInput,
  CurrencyConversionInput,
  CurrencyGroupInput,
  CurrencyInput,
  DamageFieldsInput,
  DamageInput,
  DamagePoolInput,
  DetailInput,
  DiePerLevelInput,
  DistributedInput,
  DurationInput,
  EquipPrerequisiteInput,
  EquipmentCategoryPropertyInput,
  EquipmentInput,
  EquipmentRangeInput,
  FeatInput,
  FeatureExpertiseInput,
  FeatureFeatInput,
  FeatureInput,
  FeatureModifierInput,
  FeatureOptionInput,
  FeatureProficiencyInput,
  FeatureSenseInput,
  FeatureSpellInput,
  GenerateOptionInput,
  GenericTypeInput,
  HitpointFixedInput,
  HitpointInput,
  HitpointRollInput,
  HitpointRollValuesInput,
  ImperialInput,
  LevelAttributeInput,
  LineageInput,
  ManualInput,
  ManualRolledInput,
  ModifierCategoryTypeInput,
  ModifierCategoryTypeMethodInput,
  ModifierDiePerLevelInput,
  ModifierSetPerLevelInput,
  ModifierTypeMethodInput,
  MulticlassAbilityInput,
  MulticlassInput,
  OptionsByLevelInput,
  PointBuyInput,
  PossessionsInput,
  PrepareLimitInput,
  PrepareLimitLevelInput,
  PrerequisiteInput,
  ProficiencyLevelInput,
  ProficiencyPropertiesInput,
  RaceInput,
  RaceSpeedInput,
  RangeInput,
  ResourceInput,
  RollInput,
  RollTypeInput,
  SaveAbilityInput,
  ScoresInput,
  SetPerLevelInput,
  ShapeInput,
  SpeedInput,
  SpellInput,
  SpellSlotInput,
  SpellcastingInput,
  SpellsByLevelInput,
  StandardArrayInput,
  StartingEquipmentGroupInput,
  StartingEquipmentInput,
  StartingGoldInput,
  SubclassInput,
  SubtypeInput,
  SystemActionInput,
  SystemAttributeInput,
  SystemCategoryInput,
  SystemChargesInput,
  SystemEquipmentInput,
  SystemInput,
  SystemMeasurementInput,
  SystemModifiersInput,
  SystemPrerequisiteInput,
  SystemProficiencyInput,
  SystemRulesInput,
  SystemSenseInput,
  SystemSkillInput,
  SystemSpellInput,
  TraitsInput,
  UpcastFieldsInput,
  UpcastInput,
  UpcastLevelInput,
  UsesPerLevelInput,
  WeightInput,
} from '../gql/types.ts'
import {
  ClassesEnum,
  ClassesEnumInput,
  DamageEnum,
  DamageEnumInput,
  EquipmentEnum,
  EquipmentEnumInput,
  FeatEnum,
  FeatEnumInput,
  FeatureEnum,
  FeatureEnumInput,
  SectionEnum,
  SectionEnumInput,
  SpellEnum,
  SpellEnumInput,
} from '../gql/types.ts'

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K], any, T[K]>
}>

type definedNonNullAny = {}

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny => v !== undefined && v !== null

export const definedNonNullAnySchema = z.any().refine((v) => isDefinedNonNullAny(v))

export const ClassesEnumSchema = z.nativeEnum(ClassesEnum)

export const ClassesEnumInputSchema = z.nativeEnum(ClassesEnumInput)

export const DamageEnumSchema = z.nativeEnum(DamageEnum)

export const DamageEnumInputSchema = z.nativeEnum(DamageEnumInput)

export const EquipmentEnumSchema = z.nativeEnum(EquipmentEnum)

export const EquipmentEnumInputSchema = z.nativeEnum(EquipmentEnumInput)

export const FeatEnumSchema = z.nativeEnum(FeatEnum)

export const FeatEnumInputSchema = z.nativeEnum(FeatEnumInput)

export const FeatureEnumSchema = z.nativeEnum(FeatureEnum)

export const FeatureEnumInputSchema = z.nativeEnum(FeatureEnumInput)

export const SectionEnumSchema = z.nativeEnum(SectionEnum)

export const SectionEnumInputSchema = z.nativeEnum(SectionEnumInput)

export const SpellEnumSchema = z.nativeEnum(SpellEnum)

export const SpellEnumInputSchema = z.nativeEnum(SpellEnumInput)

export function AbilityGenerateMethodInputSchema(): z.ZodObject<Properties<AbilityGenerateMethodInput>> {
  return z.object({
    id: z.string(),
    label: z.string(),
    options: z.array(z.lazy(() => GenerateOptionInputSchema())).nullish(),
    total: z.number().nullish(),
    value: z.string(),
  })
}

export function AbilityScoreInputSchema(): z.ZodObject<Properties<AbilityScoreInput>> {
  return z.object({
    abilities: z.array(z.string()).nullish(),
    score: z.number().nullish(),
  })
}

export function ActionGroupInputSchema(): z.ZodObject<Properties<ActionGroupInput>> {
  return z.object({
    primary: z.lazy(() => ActionPropertyInputSchema().nullish()),
    secondary: z.lazy(() => ActionPropertyInputSchema().nullish()),
  })
}

export function ActionPropertyInputSchema(): z.ZodObject<Properties<ActionPropertyInput>> {
  return z.object({
    amount: z.number().nullish(),
    id: z.string().nullish(),
  })
}

export function AncestryFeatureInputSchema(): z.ZodObject<Properties<AncestryFeatureInput>> {
  return z.object({
    actions: z.lazy(() => ActionGroupInputSchema().nullish()),
    attributes: z.array(z.string()).nullish(),
    category: z.string().nullish(),
    charges: z.lazy(() => ChargeInputSchema().nullish()),
    damage: z.lazy(() => DamageInputSchema().nullish()),
    desc: z.string().nullish(),
    detail: z.string().nullish(),
    expertise: z.array(z.lazy(() => FeatureExpertiseInputSchema())).nullish(),
    feats: z.array(z.lazy(() => FeatureFeatInputSchema())).nullish(),
    id: z.string(),
    label: z.string().nullish(),
    levelAvailable: z.string().nullish(),
    modifiers: z.array(z.lazy(() => FeatureModifierInputSchema())).nullish(),
    options: z.array(z.lazy(() => FeatureOptionInputSchema())).nullish(),
    optionsByLevel: z.array(z.lazy(() => OptionsByLevelInputSchema())).nullish(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    proficiencies: z.array(z.lazy(() => FeatureProficiencyInputSchema())).nullish(),
    range: z.lazy(() => RangeInputSchema().nullish()),
    saveAbility: z.lazy(() => SaveAbilityInputSchema().nullish()),
    senses: z.array(z.lazy(() => FeatureSenseInputSchema())).nullish(),
    shape: z.lazy(() => ShapeInputSchema().nullish()),
    spells: z.array(z.lazy(() => FeatureSpellInputSchema())).nullish(),
    targets: z.number().nullish(),
    value: z.string().nullish(),
  })
}

export function AncestryInputSchema(): z.ZodObject<Properties<AncestryInput>> {
  return z.object({
    desc: z.string().nullish(),
    id: z.string(),
    label: z.string(),
    options: z.array(z.lazy(() => AncestryOptionInputSchema())),
    value: z.string(),
  })
}

export function AncestryOptionInputSchema(): z.ZodObject<Properties<AncestryOptionInput>> {
  return z.object({
    desc: z.string().nullish(),
    features: z.array(z.lazy(() => AncestryFeatureInputSchema())).nullish(),
    id: z.string(),
    label: z.string(),
    value: z.string(),
  })
}

export function BackgroundCurrencyInputSchema(): z.ZodObject<Properties<BackgroundCurrencyInput>> {
  return z.object({
    amount: z.number().nullish(),
    id: z.string(),
  })
}

export function BackgroundEquipmentInputSchema(): z.ZodObject<Properties<BackgroundEquipmentInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    category: z.string().nullish(),
    currencies: z.array(z.lazy(() => BackgroundCurrencyInputSchema().nullable())).nullish(),
    equipment: z.array(z.string()).nullish(),
    properties: z.array(z.string()).nullish(),
    quantity: z.number().nullish(),
    selectionCount: z.number().nullish(),
  })
}

export function BackgroundInputSchema(): z.ZodObject<Properties<BackgroundInput>> {
  return z.object({
    desc: z.string().nullish(),
    details: z.array(z.lazy(() => DetailInputSchema())).nullish(),
    equipment: z.array(z.array(z.array(z.lazy(() => BackgroundEquipmentInputSchema())))).nullish(),
    features: z.array(z.lazy(() => FeatureInputSchema())).nullish(),
    id: z.string(),
    label: z.string(),
    masterId: z.string().nullish(),
    ownerId: z.string().nullish(),
    proficiencies: z.array(z.lazy(() => FeatureProficiencyInputSchema())).nullish(),
    systemId: z.string(),
    value: z.string(),
  })
}

export function BackgroundStartingEquipmentInputSchema(): z.ZodObject<Properties<BackgroundStartingEquipmentInput>> {
  return z.object({
    addedToCharacter: z.boolean().nullish(),
    equipmentGroups: z.array(z.lazy(() => StartingEquipmentGroupInputSchema())).nullish(),
  })
}

export function BatchBackgroundsInputSchema(): z.ZodObject<Properties<BatchBackgroundsInput>> {
  return z.object({
    data: z.lazy(() => BackgroundInputSchema()),
    tableName: z.string(),
  })
}

export function BatchClassesInputSchema(): z.ZodObject<Properties<BatchClassesInput>> {
  return z.object({
    data: z.lazy(() => ClassInputSchema()),
    tableName: z.string(),
  })
}

export function BatchEquipmentInputSchema(): z.ZodObject<Properties<BatchEquipmentInput>> {
  return z.object({
    data: z.lazy(() => EquipmentInputSchema()),
    tableName: z.string(),
  })
}

export function BatchFeatInputSchema(): z.ZodObject<Properties<BatchFeatInput>> {
  return z.object({
    data: z.lazy(() => FeatInputSchema()),
    tableName: z.string(),
  })
}

export function BatchRacesInputSchema(): z.ZodObject<Properties<BatchRacesInput>> {
  return z.object({
    data: z.lazy(() => RaceInputSchema()),
    tableName: z.string(),
  })
}

export function BatchSpellsInputSchema(): z.ZodObject<Properties<BatchSpellsInput>> {
  return z.object({
    data: z.lazy(() => SpellInputSchema()),
    tableName: z.string(),
  })
}

export function BatchSystemsInputSchema(): z.ZodObject<Properties<BatchSystemsInput>> {
  return z.object({
    data: z.lazy(() => SystemInputSchema()),
    tableName: z.string(),
  })
}

export function CapacityInputSchema(): z.ZodObject<Properties<CapacityInput>> {
  return z.object({
    amount: z.number().nullish(),
    unit: z.string(),
  })
}

export function CharacterAbilitiesInputSchema(): z.ZodObject<Properties<CharacterAbilitiesInput>> {
  return z.object({
    manualRolled: z.lazy(() => ManualRolledInputSchema().nullish()),
    pointBuy: z.lazy(() => PointBuyInputSchema().nullish()),
    scores: z.array(z.lazy(() => ScoresInputSchema())).nullish(),
    selectedSystem: z.string().nullish(),
    standardArray: z.array(z.lazy(() => StandardArrayInputSchema())).nullish(),
  })
}

export function CharacterAncestryInputSchema(): z.ZodObject<Properties<CharacterAncestryInput>> {
  return z.object({
    id: z.string().nullish(),
    lineage: z.array(z.lazy(() => LineageInputSchema())).nullish(),
    raceId: z.string().nullish(),
  })
}

export function CharacterClassInputSchema(): z.ZodObject<Properties<CharacterClassInput>> {
  return z.object({
    id: z.string(),
    level: z.number(),
    subclass: z.lazy(() => SubclassInputSchema().nullish()),
  })
}

export function CharacterCurrencyInputSchema(): z.ZodObject<Properties<CharacterCurrencyInput>> {
  return z.object({
    amount: z.number(),
    id: z.string(),
  })
}

export function CharacterEquipmentInputSchema(): z.ZodObject<Properties<CharacterEquipmentInput>> {
  return z.object({
    attuned: z.array(z.string()).nullish(),
    equipped: z.array(z.string()).nullish(),
    inventory: z.array(z.lazy(() => CharacterEquipmentObjectInputSchema())).nullish(),
  })
}

export function CharacterEquipmentObjectInputSchema(): z.ZodObject<Properties<CharacterEquipmentObjectInput>> {
  return z.object({
    containerId: z.string().nullish(),
    containerPath: z.string().nullish(),
    customName: z.string().nullish(),
    equipmentId: z.string(),
    id: z.string(),
    notes: z.string().nullish(),
    quantity: z.number(),
  })
}

export function CharacterExpertiseInputSchema(): z.ZodObject<Properties<CharacterExpertiseInput>> {
  return z.object({
    ancestryId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    classId: z.string().nullish(),
    equipment: z.string().nullish(),
    equipmentId: z.string().nullish(),
    expertiseId: z.string(),
    featId: z.string().nullish(),
    featureId: z.string().nullish(),
    featureLevel: z.number().nullish(),
    language: z.string().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    property: z.string().nullish(),
    raceId: z.string().nullish(),
    saveAbility: z.string().nullish(),
    skill: z.string().nullish(),
  })
}

export function CharacterFeatInputSchema(): z.ZodObject<Properties<CharacterFeatInput>> {
  return z.object({
    ancestryId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    classId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    featId: z.string().nullish(),
    featureId: z.string().nullish(),
    featureLevel: z.number().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    raceId: z.string().nullish(),
  })
}

export function CharacterFeatureInputSchema(): z.ZodObject<Properties<CharacterFeatureInput>> {
  return z.object({
    ancestryId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    classId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    featId: z.string().nullish(),
    id: z.string().nullish(),
    level: z.number().nullish(),
    options: z.array(z.lazy(() => CharacterFeatureOptionInputSchema())).nullish(),
    raceId: z.string().nullish(),
  })
}

export function CharacterFeatureOptionInputSchema(): z.ZodObject<Properties<CharacterFeatureOptionInput>> {
  return z.object({
    featureLevel: z.number(),
    id: z.string(),
    optionIndex: z.string(),
  })
}

export function CharacterHitpointInputSchema(): z.ZodObject<Properties<CharacterHitpointInput>> {
  return z.object({
    bonus: z.number().nullish(),
    fixed: z.lazy(() => HitpointFixedInputSchema().nullish()),
    maxHitpoints: z.number().nullish(),
    maxOverride: z.number().nullish(),
    method: z.string(),
    rolled: z.lazy(() => HitpointRollInputSchema().nullish()),
    temp: z.number().nullish(),
  })
}

export function CharacterInputSchema(): z.ZodObject<Properties<CharacterInput>> {
  return z.object({
    abilities: z.lazy(() => CharacterAbilitiesInputSchema().nullish()),
    advancement: z.string().nullish(),
    ancestry: z.lazy(() => CharacterAncestryInputSchema().nullish()),
    background: z.string().nullish(),
    backgroundEquipment: z.lazy(() => BackgroundStartingEquipmentInputSchema().nullish()),
    classEquipment: z.lazy(() => ClassStartingEquipmentInputSchema().nullish()),
    classes: z.array(z.lazy(() => CharacterClassInputSchema().nullable())).nullish(),
    currencyGroups: z.array(z.lazy(() => CurrencyGroupInputSchema())).nullish(),
    desc: z.string().nullish(),
    equipment: z.lazy(() => CharacterEquipmentInputSchema()),
    exp: z.number().nullish(),
    expertise: z.lazy(() => CharacterExpertiseInputSchema().nullish()),
    feats: z.array(z.lazy(() => CharacterFeatInputSchema())).nullish(),
    features: z.array(z.lazy(() => CharacterFeatureInputSchema())).nullish(),
    hitpoint: z.lazy(() => CharacterHitpointInputSchema().nullish()),
    id: z.string(),
    label: z.string(),
    modifiers: z.lazy(() => CharacterModifierInputSchema().nullish()),
    ownerId: z.string().nullish(),
    proficiencies: z.lazy(() => CharacterProficiencyInputSchema().nullish()),
    race: z.string().nullish(),
    senses: z.array(z.lazy(() => CharacterSenseInputSchema())).nullish(),
    spellcasting: z.lazy(() => CharacterSpellcastingInputSchema().nullish()),
    systemId: z.string(),
    value: z.string(),
  })
}

export function CharacterModifierInputSchema(): z.ZodObject<Properties<CharacterModifierInput>> {
  return z.object({
    ancestryId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    classId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    featId: z.string().nullish(),
    featureId: z.string().nullish(),
    featureLevel: z.number().nullish(),
    modifierId: z.string(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    raceId: z.string().nullish(),
  })
}

export function CharacterProficiencyInputSchema(): z.ZodObject<Properties<CharacterProficiencyInput>> {
  return z.object({
    ancestryId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    classId: z.string().nullish(),
    equipment: z.string().nullish(),
    equipmentId: z.string().nullish(),
    featId: z.string().nullish(),
    featureId: z.string().nullish(),
    featureLevel: z.number().nullish(),
    language: z.string().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    proficiencyId: z.string(),
    property: z.string().nullish(),
    raceId: z.string().nullish(),
    saveAbility: z.string().nullish(),
    skill: z.string().nullish(),
  })
}

export function CharacterSenseInputSchema(): z.ZodObject<Properties<CharacterSenseInput>> {
  return z.object({
    ancestryId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    classId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    featId: z.string().nullish(),
    featureId: z.string().nullish(),
    featureLevel: z.number().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    raceId: z.string().nullish(),
    senseId: z.string().nullish(),
  })
}

export function CharacterSettingInputSchema(): z.ZodObject<Properties<CharacterSettingInput>> {
  return z.object({
    advancementMethods: z.array(z.lazy(() => GenericTypeInputSchema())),
    hitpointCalcMethods: z.array(z.lazy(() => GenericTypeInputSchema())),
    spellPointCalcMethods: z.array(z.lazy(() => GenericTypeInputSchema())),
    startingEquipmentOptions: z.array(z.lazy(() => GenericTypeInputSchema())),
  })
}

export function CharacterSpellInputSchema(): z.ZodObject<Properties<CharacterSpellInput>> {
  return z.object({
    ability: z.string().nullish(),
    alwaysPrepared: z.boolean().nullish(),
    ancestryId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    castAtLevel: z.boolean().nullish(),
    classId: z.string().nullish(),
    countAsKnown: z.boolean().nullish(),
    equipmentId: z.string().nullish(),
    featId: z.string().nullish(),
    featureId: z.string().nullish(),
    featureLevel: z.number().nullish(),
    id: z.string(),
    isRitual: z.boolean().nullish(),
    level: z.number(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    optionalAbility: z.boolean().nullish(),
    raceId: z.string().nullish(),
    requiresConcentration: z.boolean().nullish(),
    usesSlot: z.boolean().nullish(),
  })
}

export function CharacterSpellSlotsInputsSchema(): z.ZodObject<Properties<CharacterSpellSlotsInputs>> {
  return z.object({
    classId: z.string(),
    level: z.number(),
    used: z.number(),
  })
}

export function CharacterSpellcastingInputSchema(): z.ZodObject<Properties<CharacterSpellcastingInput>> {
  return z.object({
    additional: z.array(z.lazy(() => CharacterSpellInputSchema())).nullish(),
    known: z.array(z.lazy(() => ClassSpellListInputSchema())).nullish(),
    prepared: z.array(z.lazy(() => ClassSpellListInputSchema())).nullish(),
    spellSlots: z.array(z.lazy(() => CharacterSpellSlotsInputsSchema())).nullish(),
  })
}

export function ChargeInputSchema(): z.ZodObject<Properties<ChargeInput>> {
  return z.object({
    ability: z.string().nullish(),
    addAmount: z.number().nullish(),
    limit: z.string().nullish(),
    minAmount: z.number().nullish(),
    multiplier: z.number().nullish(),
    reset: z.string().nullish(),
    resourcePoints: z.number().nullish(),
    setAmount: z.number().nullish(),
    skill: z.string().nullish(),
    usesPerLevel: z.array(z.lazy(() => UsesPerLevelInputSchema().nullable())).nullish(),
  })
}

export function ChargeOptionInputSchema(): z.ZodObject<Properties<ChargeOptionInput>> {
  return z.object({
    classes: z.array(z.lazy(() => ClassesEnumInputSchema)).nullish(),
    damage: z.array(z.lazy(() => DamageEnumInputSchema)).nullish(),
    equipment: z.array(z.lazy(() => EquipmentEnumInputSchema)).nullish(),
    feats: z.array(z.lazy(() => FeatEnumInputSchema)).nullish(),
    features: z.array(z.lazy(() => FeatureEnumInputSchema)).nullish(),
    id: z.string(),
    label: z.string(),
    sections: z.array(z.lazy(() => SectionEnumInputSchema)).nullish(),
    spells: z.array(z.lazy(() => SpellEnumInputSchema)).nullish(),
    value: z.string(),
  })
}

export function ClassCurrencyInputSchema(): z.ZodObject<Properties<ClassCurrencyInput>> {
  return z.object({
    amount: z.number().nullish(),
    id: z.string(),
  })
}

export function ClassEquipmentInputSchema(): z.ZodObject<Properties<ClassEquipmentInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    category: z.string().nullish(),
    currencies: z.array(z.lazy(() => ClassCurrencyInputSchema())).nullish(),
    equipment: z.array(z.string()).nullish(),
    properties: z.array(z.string()).nullish(),
    quantity: z.number().nullish(),
    selectionCount: z.number().nullish(),
  })
}

export function ClassInputSchema(): z.ZodObject<Properties<ClassInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    category: z.string(),
    desc: z.string().nullish(),
    details: z.array(z.lazy(() => DetailInputSchema())).nullish(),
    equipment: z.array(z.array(z.array(z.lazy(() => ClassEquipmentInputSchema())))).nullish(),
    features: z.array(z.lazy(() => FeatureInputSchema())).nullish(),
    hitpoint: z.lazy(() => HitpointInputSchema().nullish()),
    id: z.string(),
    label: z.string(),
    levelAttributes: z.array(z.lazy(() => LevelAttributeInputSchema())).nullish(),
    masterId: z.string().nullish(),
    multiclass: z.lazy(() => MulticlassInputSchema().nullish()),
    ownerId: z.string().nullish(),
    parentClass: z.string().nullish(),
    proficiencies: z.array(z.lazy(() => FeatureProficiencyInputSchema())).nullish(),
    resource: z.lazy(() => ResourceInputSchema().nullish()),
    spellcasting: z.lazy(() => SpellcastingInputSchema().nullish()),
    startingGold: z.lazy(() => StartingGoldInputSchema().nullish()),
    subtypes: z.array(z.lazy(() => SubtypeInputSchema())).nullish(),
    systemId: z.string(),
    value: z.string(),
  })
}

export function ClassSpellInputSchema(): z.ZodObject<Properties<ClassSpellInput>> {
  return z.object({
    ability: z.string().nullish(),
    alwaysPrepared: z.boolean().nullish(),
    castAtLevel: z.boolean().nullish(),
    classId: z.string().nullish(),
    countAsKnown: z.boolean().nullish(),
    id: z.string(),
    isRitual: z.boolean().nullish(),
    optionalAbility: z.boolean().nullish(),
    requiresConcentration: z.boolean().nullish(),
    usesSlot: z.boolean().nullish(),
  })
}

export function ClassSpellListInputSchema(): z.ZodObject<Properties<ClassSpellListInput>> {
  return z.object({
    level: z.number(),
    spells: z.array(z.lazy(() => ClassSpellInputSchema())).nullish(),
  })
}

export function ClassStartingEquipmentInputSchema(): z.ZodObject<Properties<ClassStartingEquipmentInput>> {
  return z.object({
    addedToCharacter: z.boolean().nullish(),
    equipmentGroups: z.array(z.lazy(() => StartingEquipmentGroupInputSchema())).nullish(),
    goldOption: z.string().nullish(),
    option: z.string(),
    totalGold: z.number().nullish(),
  })
}

export function ContainsInputSchema(): z.ZodObject<Properties<ContainsInput>> {
  return z.object({
    id: z.string(),
    quantity: z.number(),
  })
}

export function CostInputSchema(): z.ZodObject<Properties<CostInput>> {
  return z.object({
    amount: z.number().nullish(),
    currency: z.string(),
  })
}

export function CurrencyConversionInputSchema(): z.ZodObject<Properties<CurrencyConversionInput>> {
  return z.object({
    copper: z.number(),
    electrum: z.number(),
    gold: z.number(),
    platinum: z.number(),
    silver: z.number(),
  })
}

export function CurrencyGroupInputSchema(): z.ZodObject<Properties<CurrencyGroupInput>> {
  return z.object({
    container: z.string().nullish(),
    currencies: z.array(z.lazy(() => CharacterCurrencyInputSchema())).nullish(),
  })
}

export function CurrencyInputSchema(): z.ZodObject<Properties<CurrencyInput>> {
  return z.object({
    abbreviation: z.string(),
    conversions: z.lazy(() => CurrencyConversionInputSchema()),
    desc: z.string().nullish(),
    id: z.string(),
    label: z.string(),
    value: z.string(),
  })
}

export function DamageFieldsInputSchema(): z.ZodObject<Properties<DamageFieldsInput>> {
  return z.object({
    ability: z.string().nullish(),
    attribute: z.string().nullish(),
    dieConfig: z.string().nullish(),
    id: z.string().nullish(),
    maxAmount: z.number().nullish(),
    minAmount: z.number().nullish(),
    multiplier: z.number().nullish(),
    pool: z.lazy(() => DamagePoolInputSchema().nullish()),
    setAmount: z.number().nullish(),
  })
}

export function DamageInputSchema(): z.ZodObject<Properties<DamageInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    bonus: z.lazy(() => DamageFieldsInputSchema().nullish()),
    damageSave: z.array(z.string()).nullish(),
    diePerLevel: z.array(z.lazy(() => DiePerLevelInputSchema())).nullish(),
    primary: z.lazy(() => DamageFieldsInputSchema().nullish()),
    secondary: z.lazy(() => DamageFieldsInputSchema().nullish()),
    setPerLevel: z.array(z.lazy(() => SetPerLevelInputSchema())).nullish(),
    versatile: z.lazy(() => DamageFieldsInputSchema().nullish()),
  })
}

export function DamagePoolInputSchema(): z.ZodObject<Properties<DamagePoolInput>> {
  return z.object({
    ability: z.string().nullish(),
    attribute: z.string().nullish(),
    maxAmount: z.number().nullish(),
    minAmount: z.number().nullish(),
    multiplier: z.number().nullish(),
    option: z.string().nullish(),
    setAmount: z.number().nullish(),
  })
}

export function DetailInputSchema(): z.ZodObject<Properties<DetailInput>> {
  return z.object({
    desc: z.string().nullish(),
    label: z.string(),
    value: z.string(),
  })
}

export function DiePerLevelInputSchema(): z.ZodObject<Properties<DiePerLevelInput>> {
  return z.object({
    bonus: z.lazy(() => DamageFieldsInputSchema().nullish()),
    level: z.string().nullish(),
    primary: z.lazy(() => DamageFieldsInputSchema().nullish()),
    secondary: z.lazy(() => DamageFieldsInputSchema().nullish()),
  })
}

export function DistributedInputSchema(): z.ZodObject<Properties<DistributedInput>> {
  return z.object({
    ability: z.string(),
    id: z.string(),
  })
}

export function DurationInputSchema(): z.ZodObject<Properties<DurationInput>> {
  return z.object({
    amount: z.number().nullish(),
    id: z.string(),
  })
}

export function EquipPrerequisiteInputSchema(): z.ZodObject<Properties<EquipPrerequisiteInput>> {
  return z.object({
    category: z.string().nullish(),
    equipment: z.array(z.string()).nullish(),
    numberEquipped: z.number().nullish(),
    properties: z.array(z.string()).nullish(),
  })
}

export function EquipmentCategoryPropertyInputSchema(): z.ZodObject<Properties<EquipmentCategoryPropertyInput>> {
  return z.object({
    categoryId: z.string(),
    id: z.string(),
    propertyId: z.string(),
  })
}

export function EquipmentInputSchema(): z.ZodObject<Properties<EquipmentInput>> {
  return z.object({
    Rank: z.number().nullish(),
    armorClass: z.number().nullish(),
    attributes: z.array(z.string()).nullish(),
    capacity: z.lazy(() => CapacityInputSchema().nullish()),
    category: z.string(),
    contains: z.array(z.lazy(() => ContainsInputSchema())).nullish(),
    cost: z.lazy(() => CostInputSchema().nullish()),
    damage: z.lazy(() => DamageInputSchema().nullish()),
    desc: z.string().nullish(),
    features: z.array(z.lazy(() => FeatureInputSchema())).nullish(),
    id: z.string(),
    label: z.string(),
    masterId: z.string().nullish(),
    maxBonus: z.number().nullish(),
    maxStack: z.number().nullish(),
    optionalAbility: z.string().nullish(),
    ownerId: z.string().nullish(),
    prerequisities: z.lazy(() => PrerequisiteInputSchema().nullish()),
    primaryAbility: z.string().nullish(),
    properties: z.array(z.string()).nullish(),
    quantity: z.number(),
    quote: z.string().nullish(),
    range: z.lazy(() => EquipmentRangeInputSchema().nullish()),
    rarity: z.string(),
    saveAbility: z.lazy(() => SaveAbilityInputSchema().nullish()),
    secondaryAbility: z.string().nullish(),
    speed: z.lazy(() => SpeedInputSchema().nullish()),
    systemId: z.string(),
    value: z.string(),
    weight: z.lazy(() => WeightInputSchema().nullish()),
  })
}

export function EquipmentRangeInputSchema(): z.ZodObject<Properties<EquipmentRangeInput>> {
  return z.object({
    maxRange: z.number().nullish(),
    minRange: z.number().nullish(),
    unit: z.string(),
  })
}

export function FeatInputSchema(): z.ZodObject<Properties<FeatInput>> {
  return z.object({
    actions: z.lazy(() => ActionGroupInputSchema().nullish()),
    attributes: z.array(z.string()).nullish(),
    bonusDamage: z.lazy(() => DamageInputSchema().nullish()),
    category: z.string().nullish(),
    charges: z.lazy(() => ChargeInputSchema().nullish()),
    desc: z.string().nullish(),
    detail: z.string().nullish(),
    expertise: z.array(z.lazy(() => FeatureProficiencyInputSchema())).nullish(),
    feats: z.array(z.lazy(() => FeatureFeatInputSchema())).nullish(),
    features: z.array(z.lazy(() => FeatureInputSchema())).nullish(),
    id: z.string(),
    label: z.string(),
    levelAvailable: z.string().nullish(),
    masterId: z.string().nullish(),
    modifiers: z.array(z.lazy(() => FeatureModifierInputSchema())).nullish(),
    options: z.array(z.lazy(() => FeatureOptionInputSchema())).nullish(),
    ownerId: z.string(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    primaryDamage: z.lazy(() => DamageInputSchema().nullish()),
    proficiencies: z.array(z.lazy(() => FeatureProficiencyInputSchema())).nullish(),
    range: z.lazy(() => RangeInputSchema().nullish()),
    saveAbility: z.lazy(() => SaveAbilityInputSchema().nullish()),
    secondaryDamage: z.lazy(() => DamageInputSchema().nullish()),
    selectionCount: z.number().nullish(),
    senses: z.array(z.lazy(() => FeatureSenseInputSchema())).nullish(),
    shape: z.lazy(() => ShapeInputSchema().nullish()),
    spells: z.array(z.lazy(() => FeatureSpellInputSchema())).nullish(),
    systemId: z.string(),
    targets: z.number().nullish(),
    value: z.string(),
  })
}

export function FeatureExpertiseInputSchema(): z.ZodObject<Properties<FeatureExpertiseInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    category: z.string(),
    equipment: z.lazy(() => ProficiencyPropertiesInputSchema().nullish()),
    id: z.string(),
    languages: z.array(z.string()).nullish(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    properties: z.lazy(() => ProficiencyPropertiesInputSchema().nullish()),
    saveAbilities: z.array(z.string()).nullish(),
    selectionCount: z.number().nullish(),
    skills: z.array(z.string()).nullish(),
    subtype: z.string().nullish(),
  })
}

export function FeatureFeatInputSchema(): z.ZodObject<Properties<FeatureFeatInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    feats: z.array(z.string()).nullish(),
    id: z.string(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    selectionCount: z.number().nullish(),
    subtype: z.string().nullish(),
  })
}

export function FeatureInputSchema(): z.ZodObject<Properties<FeatureInput>> {
  return z.object({
    actions: z.lazy(() => ActionGroupInputSchema().nullish()),
    attributes: z.array(z.string()).nullish(),
    category: z.string().nullish(),
    charges: z.lazy(() => ChargeInputSchema().nullish()),
    damage: z.lazy(() => DamageInputSchema().nullish()),
    desc: z.string().nullish(),
    detail: z.string().nullish(),
    expertise: z.array(z.lazy(() => FeatureExpertiseInputSchema())).nullish(),
    feats: z.array(z.lazy(() => FeatureFeatInputSchema())).nullish(),
    id: z.string(),
    label: z.string().nullish(),
    levelAvailable: z.string().nullish(),
    modifiers: z.array(z.lazy(() => FeatureModifierInputSchema())).nullish(),
    options: z.array(z.lazy(() => FeatureOptionInputSchema())).nullish(),
    optionsByLevel: z.array(z.lazy(() => OptionsByLevelInputSchema())).nullish(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    proficiencies: z.array(z.lazy(() => FeatureProficiencyInputSchema())).nullish(),
    range: z.lazy(() => RangeInputSchema().nullish()),
    saveAbility: z.lazy(() => SaveAbilityInputSchema().nullish()),
    senses: z.array(z.lazy(() => FeatureSenseInputSchema())).nullish(),
    shape: z.lazy(() => ShapeInputSchema().nullish()),
    spells: z.array(z.lazy(() => FeatureSpellInputSchema())).nullish(),
    targets: z.number().nullish(),
    value: z.string().nullish(),
  })
}

export function FeatureModifierInputSchema(): z.ZodObject<Properties<FeatureModifierInput>> {
  return z.object({
    abilities: z.array(z.string()).nullish(),
    attributes: z.array(z.string()).nullish(),
    category: z.string().nullish(),
    charge: z.lazy(() => ChargeInputSchema().nullish()),
    conditions: z.array(z.string()).nullish(),
    damageType: z.string().nullish(),
    damageTypes: z.array(z.string()).nullish(),
    dieConfig: z.string().nullish(),
    diePerLevel: z.array(z.lazy(() => ModifierDiePerLevelInputSchema())).nullish(),
    duration: z.string().nullish(),
    feature: z.string().nullish(),
    id: z.string(),
    maxAmount: z.number().nullish(),
    maxRange: z.number().nullish(),
    method: z.string().nullish(),
    methodAbility: z.string().nullish(),
    methodSkill: z.string().nullish(),
    minAmount: z.number().nullish(),
    minRange: z.number().nullish(),
    multiplier: z.number().nullish(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    range: z.string().nullish(),
    saveAbilities: z.array(z.string()).nullish(),
    selectionCount: z.number().nullish(),
    setAmount: z.number().nullish(),
    setPerLevel: z.array(z.lazy(() => ModifierSetPerLevelInputSchema())).nullish(),
    shape: z.string().nullish(),
    size: z.number().nullish(),
    skills: z.array(z.string()).nullish(),
    speeds: z.array(z.string()).nullish(),
    spellCategory: z.string().nullish(),
    spells: z.string().nullish(),
    subtype: z.string().nullish(),
    type: z.string().nullish(),
    unit: z.string().nullish(),
  })
}

export function FeatureOptionInputSchema(): z.ZodObject<Properties<FeatureOptionInput>> {
  return z.object({
    actions: z.lazy(() => ActionGroupInputSchema().nullish()),
    attributes: z.array(z.string()).nullish(),
    category: z.string().nullish(),
    charges: z.lazy(() => ChargeInputSchema().nullish()),
    damage: z.lazy(() => DamageInputSchema().nullish()),
    desc: z.string().nullish(),
    detail: z.string().nullish(),
    expertise: z.array(z.lazy(() => FeatureExpertiseInputSchema())).nullish(),
    feats: z.array(z.lazy(() => FeatureFeatInputSchema())).nullish(),
    id: z.string(),
    label: z.string().nullish(),
    levelAvailable: z.string().nullish(),
    modifiers: z.array(z.lazy(() => FeatureModifierInputSchema())).nullish(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    proficiencies: z.array(z.lazy(() => FeatureProficiencyInputSchema())).nullish(),
    range: z.lazy(() => RangeInputSchema().nullish()),
    saveAbility: z.lazy(() => SaveAbilityInputSchema().nullish()),
    senses: z.array(z.lazy(() => FeatureSenseInputSchema())).nullish(),
    shape: z.lazy(() => ShapeInputSchema().nullish()),
    spells: z.array(z.lazy(() => FeatureSpellInputSchema())).nullish(),
    targets: z.number().nullish(),
    value: z.string().nullish(),
  })
}

export function FeatureProficiencyInputSchema(): z.ZodObject<Properties<FeatureProficiencyInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    category: z.string(),
    equipment: z.lazy(() => ProficiencyPropertiesInputSchema().nullish()),
    id: z.string(),
    languages: z.array(z.string()).nullish(),
    level: z.string().nullish(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    properties: z.lazy(() => ProficiencyPropertiesInputSchema().nullish()),
    rounding: z.string().nullish(),
    saveAbilities: z.array(z.string()).nullish(),
    selectionCount: z.number().nullish(),
    skills: z.array(z.string()).nullish(),
    subtype: z.string().nullish(),
  })
}

export function FeatureSenseInputSchema(): z.ZodObject<Properties<FeatureSenseInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    charges: z.lazy(() => ChargeInputSchema().nullish()),
    id: z.string(),
    ids: z.array(z.string()).nullish(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    selectionCount: z.number().nullish(),
    subtype: z.string().nullish(),
  })
}

export function FeatureSpellInputSchema(): z.ZodObject<Properties<FeatureSpellInput>> {
  return z.object({
    ability: z.string().nullish(),
    attributeLimit: z.array(z.string()).nullish(),
    attributes: z.array(z.string()).nullish(),
    charges: z.lazy(() => ChargeInputSchema().nullish()),
    classLimit: z.array(z.string()).nullish(),
    ids: z.array(z.string()).nullish(),
    levelLimit: z.array(z.string()).nullish(),
    prerequisites: z.lazy(() => PrerequisiteInputSchema().nullish()),
    selectionCount: z.number().nullish(),
    spellLevel: z.number().nullish(),
    spellsByLevel: z.array(z.lazy(() => SpellsByLevelInputSchema())).nullish(),
    subtype: z.string().nullish(),
  })
}

export function GenerateOptionInputSchema(): z.ZodObject<Properties<GenerateOptionInput>> {
  return z.object({
    id: z.string(),
    label: z.string(),
    reduce: z.number().nullish(),
    value: z.string(),
  })
}

export function GenericTypeInputSchema(): z.ZodObject<Properties<GenericTypeInput>> {
  return z.object({
    desc: z.string().nullish(),
    id: z.string(),
    label: z.string(),
    short: z.string().nullish(),
    tooltip: z.string().nullish(),
    value: z.string(),
  })
}

export function HitpointFixedInputSchema(): z.ZodObject<Properties<HitpointFixedInput>> {
  return z.object({
    current: z.number().nullish(),
    total: z.number().nullish(),
  })
}

export function HitpointInputSchema(): z.ZodObject<Properties<HitpointInput>> {
  return z.object({
    ability: z.string().nullish(),
    dieConfig: z.string().nullish(),
  })
}

export function HitpointRollInputSchema(): z.ZodObject<Properties<HitpointRollInput>> {
  return z.object({
    current: z.number().nullish(),
    total: z.number().nullish(),
    values: z.array(z.lazy(() => HitpointRollValuesInputSchema())).nullish(),
  })
}

export function HitpointRollValuesInputSchema(): z.ZodObject<Properties<HitpointRollValuesInput>> {
  return z.object({
    level: z.number(),
    value: z.number(),
  })
}

export function ImperialInputSchema(): z.ZodObject<Properties<ImperialInput>> {
  return z.object({
    length: z.array(z.lazy(() => GenericTypeInputSchema())),
    volume: z.array(z.lazy(() => GenericTypeInputSchema())),
    weight: z.array(z.lazy(() => GenericTypeInputSchema())),
  })
}

export function LevelAttributeInputSchema(): z.ZodObject<Properties<LevelAttributeInput>> {
  return z.object({
    cantripsKnownLimit: z.number().nullish(),
    level: z.number().nullish(),
    resourcePoints: z.number().nullish(),
    spellSlots: z.array(z.lazy(() => SpellSlotInputSchema())).nullish(),
    spellsKnownLimit: z.number().nullish(),
  })
}

export function LineageInputSchema(): z.ZodObject<Properties<LineageInput>> {
  return z.object({
    id: z.string().nullish(),
    raceId: z.string().nullish(),
  })
}

export function ManualInputSchema(): z.ZodObject<Properties<ManualInput>> {
  return z.object({
    ability: z.string().nullish(),
    score: z.number().nullish(),
  })
}

export function ManualRolledInputSchema(): z.ZodObject<Properties<ManualRolledInput>> {
  return z.object({
    configuration: z.string(),
    manual: z.array(z.lazy(() => ManualInputSchema())).nullish(),
    rollGroups: z.array(z.array(z.lazy(() => RollTypeInputSchema()))).nullish(),
  })
}

export function ModifierCategoryTypeInputSchema(): z.ZodObject<Properties<ModifierCategoryTypeInput>> {
  return z.object({
    categoryId: z.string(),
    id: z.string(),
    typeId: z.string(),
  })
}

export function ModifierCategoryTypeMethodInputSchema(): z.ZodObject<Properties<ModifierCategoryTypeMethodInput>> {
  return z.object({
    categoryId: z.string(),
    id: z.string(),
    methodId: z.string(),
    typeId: z.string(),
  })
}

export function ModifierDiePerLevelInputSchema(): z.ZodObject<Properties<ModifierDiePerLevelInput>> {
  return z.object({
    dieConfig: z.string().nullish(),
    level: z.string().nullish(),
  })
}

export function ModifierSetPerLevelInputSchema(): z.ZodObject<Properties<ModifierSetPerLevelInput>> {
  return z.object({
    level: z.string().nullish(),
    setAmount: z.number().nullish(),
  })
}

export function ModifierTypeMethodInputSchema(): z.ZodObject<Properties<ModifierTypeMethodInput>> {
  return z.object({
    id: z.string(),
    methodId: z.string(),
    typeId: z.string(),
  })
}

export function MulticlassAbilityInputSchema(): z.ZodObject<Properties<MulticlassAbilityInput>> {
  return z.object({
    id: z.string().nullish(),
    minAmount: z.number().nullish(),
  })
}

export function MulticlassInputSchema(): z.ZodObject<Properties<MulticlassInput>> {
  return z.object({
    optionalAbility: z.lazy(() => MulticlassAbilityInputSchema().nullish()),
    primaryAbility: z.lazy(() => MulticlassAbilityInputSchema().nullish()),
    secondaryAbility: z.lazy(() => MulticlassAbilityInputSchema().nullish()),
  })
}

export function OptionsByLevelInputSchema(): z.ZodObject<Properties<OptionsByLevelInput>> {
  return z.object({
    count: z.number().nullish(),
    level: z.number().nullish(),
    replaceCount: z.number().nullish(),
  })
}

export function PointBuyInputSchema(): z.ZodObject<Properties<PointBuyInput>> {
  return z.object({
    distributed: z.array(z.lazy(() => DistributedInputSchema())).nullish(),
    pointsLeft: z.number().nullish(),
  })
}

export function PossessionsInputSchema(): z.ZodObject<Properties<PossessionsInput>> {
  return z.object({
    desc: z.string().nullish(),
    id: z.string(),
    label: z.string(),
    value: z.string(),
  })
}

export function PrepareLimitInputSchema(): z.ZodObject<Properties<PrepareLimitInput>> {
  return z.object({
    level: z.lazy(() => PrepareLimitLevelInputSchema().nullish()),
    methods: z.array(z.string()).nullish(),
  })
}

export function PrepareLimitLevelInputSchema(): z.ZodObject<Properties<PrepareLimitLevelInput>> {
  return z.object({
    measurement: z.string().nullish(),
    rounding: z.string().nullish(),
  })
}

export function PrerequisiteInputSchema(): z.ZodObject<Properties<PrerequisiteInput>> {
  return z.object({
    abilityScore: z.lazy(() => AbilityScoreInputSchema().nullish()),
    equipmentProficiencies: z.array(z.lazy(() => EquipPrerequisiteInputSchema())).nullish(),
    equipped: z.array(z.lazy(() => EquipPrerequisiteInputSchema())).nullish(),
    featuresObtained: z.array(z.string()).nullish(),
    notEquipped: z.array(z.lazy(() => EquipPrerequisiteInputSchema())).nullish(),
    options: z.array(z.string()).nullish(),
    optionsObtained: z.array(z.string()).nullish(),
    size: z.array(z.string()).nullish(),
    skillProficiencies: z.array(z.string()).nullish(),
    spellsObtained: z.array(z.string()).nullish(),
  })
}

export function ProficiencyLevelInputSchema(): z.ZodObject<Properties<ProficiencyLevelInput>> {
  return z.object({
    id: z.string(),
    label: z.string(),
    multiplier: z.number().nullish(),
    value: z.string(),
  })
}

export function ProficiencyPropertiesInputSchema(): z.ZodObject<Properties<ProficiencyPropertiesInput>> {
  return z.object({
    category: z.string().nullish(),
    ids: z.array(z.string()).nullish(),
    properties: z.array(z.string()).nullish(),
  })
}

export function RaceInputSchema(): z.ZodObject<Properties<RaceInput>> {
  return z.object({
    ancestry: z.lazy(() => AncestryInputSchema().nullish()),
    category: z.string(),
    desc: z.string().nullish(),
    details: z.array(z.lazy(() => DetailInputSchema())).nullish(),
    features: z.array(z.lazy(() => FeatureInputSchema())).nullish(),
    id: z.string(),
    label: z.string(),
    lineages: z.array(z.string()).nullish(),
    masterId: z.string().nullish(),
    ownerId: z.string().nullish(),
    playable: z.string().nullish(),
    quote: z.string().nullish(),
    systemId: z.string(),
    traits: z.lazy(() => TraitsInputSchema().nullish()),
    value: z.string(),
  })
}

export function RaceSpeedInputSchema(): z.ZodObject<Properties<RaceSpeedInput>> {
  return z.object({
    climbing: z.number().nullish(),
    flying: z.number().nullish(),
    swimming: z.number().nullish(),
    walking: z.number().nullish(),
  })
}

export function RangeInputSchema(): z.ZodObject<Properties<RangeInput>> {
  return z.object({
    distance: z.number().nullish(),
    id: z.string(),
    maxRange: z.number().nullish(),
    minRange: z.number().nullish(),
    unit: z.string().nullish(),
  })
}

export function ResourceInputSchema(): z.ZodObject<Properties<ResourceInput>> {
  return z.object({
    charges: z.lazy(() => ChargeInputSchema().nullish()),
    desc: z.string().nullish(),
    id: z.string(),
    label: z.string(),
    levelAvailable: z.number().nullish(),
    method: z.string().nullish(),
    value: z.string(),
  })
}

export function RollInputSchema(): z.ZodObject<Properties<RollInput>> {
  return z.object({
    die: z.number(),
    id: z.string().nullish(),
    value: z.number(),
  })
}

export function RollTypeInputSchema(): z.ZodObject<Properties<RollTypeInput>> {
  return z.object({
    ability: z.string(),
    applied: z.boolean(),
    kept: z.array(z.lazy(() => RollInputSchema())).nullish(),
    rolled: z.array(z.lazy(() => RollInputSchema())),
    rolling: z.boolean(),
    score: z.number(),
  })
}

export function SaveAbilityInputSchema(): z.ZodObject<Properties<SaveAbilityInput>> {
  return z.object({
    abilityModifier: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    id: z.string(),
    minAmount: z.number().nullish(),
  })
}

export function ScoresInputSchema(): z.ZodObject<Properties<ScoresInput>> {
  return z.object({
    ModifierScore: z.number().nullish(),
    ability: z.string(),
    baseScore: z.number().nullish(),
    calculatedScore: z.number().nullish(),
    classScore: z.number().nullish(),
    raceScore: z.number().nullish(),
  })
}

export function SetPerLevelInputSchema(): z.ZodObject<Properties<SetPerLevelInput>> {
  return z.object({
    bonus: z.number().nullish(),
    level: z.string().nullish(),
    primary: z.number().nullish(),
    secondary: z.number().nullish(),
  })
}

export function ShapeInputSchema(): z.ZodObject<Properties<ShapeInput>> {
  return z.object({
    id: z.string(),
    size: z.number().nullish(),
    unit: z.string().nullish(),
  })
}

export function SpeedInputSchema(): z.ZodObject<Properties<SpeedInput>> {
  return z.object({
    amount: z.number().nullish(),
    unit: z.string(),
  })
}

export function SpellInputSchema(): z.ZodObject<Properties<SpellInput>> {
  return z.object({
    actions: z.lazy(() => ActionGroupInputSchema().nullish()),
    attributes: z.array(z.string()).nullish(),
    classes: z.array(z.string()),
    conditions: z.array(z.string()).nullish(),
    damage: z.lazy(() => DamageInputSchema().nullish()),
    desc: z.string(),
    duration: z.lazy(() => DurationInputSchema()),
    id: z.string(),
    label: z.string(),
    level: z.number(),
    masterId: z.string().nullish(),
    materialDesc: z.string().nullish(),
    ownerId: z.string().nullish(),
    range: z.lazy(() => RangeInputSchema()),
    requirements: z.array(z.string()).nullish(),
    saveAbility: z.lazy(() => SaveAbilityInputSchema().nullish()),
    school: z.string(),
    shape: z.lazy(() => ShapeInputSchema().nullish()),
    systemId: z.string(),
    targets: z.number().nullish(),
    upcast: z.lazy(() => UpcastInputSchema().nullish()),
    value: z.string(),
  })
}

export function SpellSlotInputSchema(): z.ZodObject<Properties<SpellSlotInput>> {
  return z.object({
    slotCount: z.number().nullish(),
  })
}

export function SpellcastingInputSchema(): z.ZodObject<Properties<SpellcastingInput>> {
  return z.object({
    ability: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    charges: z.lazy(() => ChargeInputSchema().nullish()),
    magicName: z.string().nullish(),
    maxSpellLevel: z.number().nullish(),
    prepareLimit: z.lazy(() => PrepareLimitInputSchema().nullish()),
  })
}

export function SpellsByLevelInputSchema(): z.ZodObject<Properties<SpellsByLevelInput>> {
  return z.object({
    id: z.string(),
    level: z.number().nullish(),
    spellLevel: z.number().nullish(),
    spells: z.array(z.string()).nullish(),
  })
}

export function StandardArrayInputSchema(): z.ZodObject<Properties<StandardArrayInput>> {
  return z.object({
    ability: z.string().nullish(),
    score: z.string().nullish(),
  })
}

export function StartingEquipmentGroupInputSchema(): z.ZodObject<Properties<StartingEquipmentGroupInput>> {
  return z.object({
    equipment: z.array(z.lazy(() => StartingEquipmentInputSchema())).nullish(),
    groupId: z.string(),
    optionId: z.string(),
  })
}

export function StartingEquipmentInputSchema(): z.ZodObject<Properties<StartingEquipmentInput>> {
  return z.object({
    id: z.string(),
    quantity: z.number(),
    selectionId: z.string().nullish(),
  })
}

export function StartingGoldInputSchema(): z.ZodObject<Properties<StartingGoldInput>> {
  return z.object({
    currency: z.string(),
    dieConfig: z.string().nullish(),
    multiplier: z.number(),
  })
}

export function SubclassInputSchema(): z.ZodObject<Properties<SubclassInput>> {
  return z.object({
    id: z.string().nullish(),
    subtype: z.string().nullish(),
  })
}

export function SubtypeInputSchema(): z.ZodObject<Properties<SubtypeInput>> {
  return z.object({
    id: z.string(),
    label: z.string(),
    value: z.string(),
  })
}

export function SystemActionInputSchema(): z.ZodObject<Properties<SystemActionInput>> {
  return z.object({
    classes: z.boolean(),
    damage: z.boolean(),
    equipment: z.boolean(),
    feats: z.boolean(),
    features: z.boolean(),
    id: z.string(),
    label: z.string(),
    sections: z.boolean(),
    spells: z.boolean(),
    value: z.string(),
  })
}

export function SystemAttributeInputSchema(): z.ZodObject<Properties<SystemAttributeInput>> {
  return z.object({
    classes: z.array(z.lazy(() => ClassesEnumInputSchema)).nullish(),
    damage: z.array(z.lazy(() => DamageEnumInputSchema)).nullish(),
    equipment: z.array(z.lazy(() => EquipmentEnumInputSchema)).nullish(),
    feats: z.array(z.lazy(() => FeatEnumInputSchema)).nullish(),
    features: z.array(z.lazy(() => FeatureEnumInputSchema)).nullish(),
    id: z.string(),
    label: z.string(),
    sections: z.array(z.lazy(() => SectionEnumInputSchema)).nullish(),
    spells: z.array(z.lazy(() => SpellEnumInputSchema)).nullish(),
    value: z.string(),
  })
}

export function SystemCategoryInputSchema(): z.ZodObject<Properties<SystemCategoryInput>> {
  return z.object({
    classes: z.boolean(),
    features: z.boolean(),
    id: z.string(),
    label: z.string(),
    races: z.boolean(),
    value: z.string(),
  })
}

export function SystemChargesInputSchema(): z.ZodObject<Properties<SystemChargesInput>> {
  return z.object({
    limits: z.array(z.lazy(() => ChargeOptionInputSchema())),
    resets: z.array(z.lazy(() => ChargeOptionInputSchema())),
  })
}

export function SystemEquipmentInputSchema(): z.ZodObject<Properties<SystemEquipmentInput>> {
  return z.object({
    categories: z.array(z.lazy(() => GenericTypeInputSchema())),
    categoryProperties: z.array(z.lazy(() => EquipmentCategoryPropertyInputSchema())),
    properties: z.array(z.lazy(() => GenericTypeInputSchema())),
    rarities: z.array(z.lazy(() => GenericTypeInputSchema())),
  })
}

export function SystemInputSchema(): z.ZodObject<Properties<SystemInput>> {
  return z.object({
    abilities: z.array(z.lazy(() => GenericTypeInputSchema())),
    actions: z.array(z.lazy(() => SystemActionInputSchema())),
    alignments: z.array(z.lazy(() => GenericTypeInputSchema())),
    attributes: z.array(z.lazy(() => SystemAttributeInputSchema())),
    categories: z.array(z.lazy(() => SystemCategoryInputSchema())),
    characters: z.lazy(() => CharacterSettingInputSchema()),
    charges: z.lazy(() => SystemChargesInputSchema()),
    conditions: z.array(z.lazy(() => GenericTypeInputSchema())),
    currencies: z.array(z.lazy(() => CurrencyInputSchema())),
    damageTypes: z.array(z.lazy(() => GenericTypeInputSchema())),
    desc: z.string().nullish(),
    equipment: z.lazy(() => SystemEquipmentInputSchema()),
    id: z.string(),
    label: z.string(),
    languages: z.array(z.lazy(() => GenericTypeInputSchema())),
    masterId: z.string().nullish(),
    modifiers: z.lazy(() => SystemModifiersInputSchema()),
    ownerId: z.string(),
    passives: z.array(z.lazy(() => GenericTypeInputSchema())),
    prerequisites: z.array(z.lazy(() => SystemPrerequisiteInputSchema())),
    proficiencies: z.lazy(() => SystemProficiencyInputSchema()),
    rules: z.lazy(() => SystemRulesInputSchema()),
    senses: z.array(z.lazy(() => SystemSenseInputSchema())),
    sizes: z.array(z.lazy(() => GenericTypeInputSchema())),
    skills: z.array(z.lazy(() => SystemSkillInputSchema())),
    speeds: z.array(z.lazy(() => GenericTypeInputSchema())),
    spells: z.lazy(() => SystemSpellInputSchema()),
    terrains: z.array(z.lazy(() => GenericTypeInputSchema())),
    value: z.string(),
  })
}

export function SystemMeasurementInputSchema(): z.ZodObject<Properties<SystemMeasurementInput>> {
  return z.object({
    amount: z.array(z.lazy(() => GenericTypeInputSchema())),
    imperial: z.lazy(() => ImperialInputSchema()),
    rounding: z.array(z.lazy(() => GenericTypeInputSchema())),
  })
}

export function SystemModifiersInputSchema(): z.ZodObject<Properties<SystemModifiersInput>> {
  return z.object({
    categories: z.array(z.lazy(() => GenericTypeInputSchema())),
    categoryMethods: z.array(z.lazy(() => ModifierCategoryTypeMethodInputSchema())),
    categoryTypes: z.array(z.lazy(() => ModifierCategoryTypeInputSchema())),
    methods: z.array(z.lazy(() => GenericTypeInputSchema())),
    spellCategories: z.array(z.lazy(() => GenericTypeInputSchema())),
    typeMethods: z.array(z.lazy(() => ModifierTypeMethodInputSchema())),
    types: z.array(z.lazy(() => GenericTypeInputSchema())),
  })
}

export function SystemPrerequisiteInputSchema(): z.ZodObject<Properties<SystemPrerequisiteInput>> {
  return z.object({
    classes: z.array(z.lazy(() => ClassesEnumInputSchema)).nullish(),
    damage: z.array(z.lazy(() => DamageEnumInputSchema)).nullish(),
    equipment: z.array(z.lazy(() => EquipmentEnumInputSchema)).nullish(),
    feats: z.array(z.lazy(() => FeatEnumInputSchema)).nullish(),
    features: z.array(z.lazy(() => FeatureEnumInputSchema)).nullish(),
    id: z.string(),
    label: z.string(),
    sections: z.array(z.lazy(() => SectionEnumInputSchema)).nullish(),
    spells: z.array(z.lazy(() => SpellEnumInputSchema)).nullish(),
    value: z.string(),
  })
}

export function SystemProficiencyInputSchema(): z.ZodObject<Properties<SystemProficiencyInput>> {
  return z.object({
    categories: z.array(z.lazy(() => GenericTypeInputSchema())),
    levels: z.array(z.lazy(() => ProficiencyLevelInputSchema())),
  })
}

export function SystemRulesInputSchema(): z.ZodObject<Properties<SystemRulesInput>> {
  return z.object({
    abilityGenerateMethod: z.array(z.lazy(() => AbilityGenerateMethodInputSchema())),
    measurements: z.lazy(() => SystemMeasurementInputSchema()),
  })
}

export function SystemSenseInputSchema(): z.ZodObject<Properties<SystemSenseInput>> {
  return z.object({
    creatureDesc: z.string().nullish(),
    id: z.string(),
    label: z.string(),
    monsterDesc: z.string().nullish(),
    type: z.array(z.string().nullable()).nullish(),
    value: z.string(),
  })
}

export function SystemSkillInputSchema(): z.ZodObject<Properties<SystemSkillInput>> {
  return z.object({
    abilityId: z.string(),
    desc: z.string().nullish(),
    id: z.string(),
    label: z.string(),
    value: z.string(),
  })
}

export function SystemSpellInputSchema(): z.ZodObject<Properties<SystemSpellInput>> {
  return z.object({
    categories: z.array(z.lazy(() => GenericTypeInputSchema())),
    durations: z.array(z.lazy(() => GenericTypeInputSchema())),
    ranges: z.array(z.lazy(() => GenericTypeInputSchema())),
    requirements: z.array(z.lazy(() => GenericTypeInputSchema())),
    schools: z.array(z.lazy(() => GenericTypeInputSchema())),
    shapes: z.array(z.lazy(() => GenericTypeInputSchema())),
  })
}

export function TraitsInputSchema(): z.ZodObject<Properties<TraitsInput>> {
  return z.object({
    details: z.array(z.lazy(() => DetailInputSchema())).nullish(),
    size: z.string().nullish(),
    speeds: z.lazy(() => RaceSpeedInputSchema().nullish()),
  })
}

export function UpcastFieldsInputSchema(): z.ZodObject<Properties<UpcastFieldsInput>> {
  return z.object({
    amount: z.number().nullish(),
    distance: z.number().nullish(),
    id: z.string().nullish(),
    maxRange: z.number().nullish(),
    minRange: z.number().nullish(),
    size: z.number().nullish(),
    unit: z.string().nullish(),
  })
}

export function UpcastInputSchema(): z.ZodObject<Properties<UpcastInput>> {
  return z.object({
    attributes: z.array(z.string()).nullish(),
    levels: z.array(z.lazy(() => UpcastLevelInputSchema().nullable())).nullish(),
  })
}

export function UpcastLevelInputSchema(): z.ZodObject<Properties<UpcastLevelInput>> {
  return z.object({
    damage: z.lazy(() => DamageInputSchema().nullish()),
    duration: z.lazy(() => UpcastFieldsInputSchema().nullish()),
    level: z.number().nullish(),
    range: z.lazy(() => UpcastFieldsInputSchema().nullish()),
    shape: z.lazy(() => UpcastFieldsInputSchema().nullish()),
    targets: z.number().nullish(),
  })
}

export function UsesPerLevelInputSchema(): z.ZodObject<Properties<UsesPerLevelInput>> {
  return z.object({
    level: z.number().nullish(),
    uses: z.number().nullish(),
  })
}

export function WeightInputSchema(): z.ZodObject<Properties<WeightInput>> {
  return z.object({
    amount: z.number().nullish(),
    unit: z.string(),
  })
}
