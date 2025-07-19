import { z } from 'zod/v4'
import { GenericTypeInput, CurrencyConversionInput, CurrencyInput, EquipmentCategoryPropertyInput, SystemEquipmentInput, ModifierCategoryTypeInput, ModifierTypeMethodInput, ModifierCategoryTypeMethodInput, SystemModifiersInput, ProficiencyLevelInput, SystemProficiencyInput, SystemSpellInput, GenerateOptionInput, ImperialInput, SystemMeasurementInput, AbilityGenerateMethodInput, SystemRulesInput, ChargeOptionInput, SystemChargesInput, CharacterSettingInput, SystemActionInput, SystemAttributeInput, SystemCategoryInput, SystemSenseInput, SystemSkillInput, SystemPrerequisiteInput, SystemInput, UpcastFieldsInput, SetPerLevelInput, DamagePoolInput, DamageFieldsInput, DiePerLevelInput, DamageInput, UpcastLevelInput, UpcastInput, ShapeInput, RangeInput, DurationInput, ActionPropertyInput, ActionGroupInput, SaveAbilityInput, SpellInput, AncestryInput, RaceSpeedInput, DetailInput, TraitsInput, RaceInput, UsesPerLevelInput, ChargeInput, EquipPrerequisiteInput, AbilityScoreInput, PrerequisiteInput, ProficiencyPropertiesInput, EquipmentCurrencyInput, EquipmentOptionItemInput, SpellsByLevelInput, FeatureSpellInput, FeatureSenseInput, FeatureProficiencyInput, FeatureOptionInput, ModifierDiePerLevelInput, ModifierSetPerLevelInput, FeatureModifierInput, FeatureFeatInput, FeatureExpertiseInput, OptionsByLevelInput, FeatureInput, FeatInput, SpeedInput, WeightInput, CapacityInput, CostInput, ContainsInput, EquipmentRangeInput, EquipmentInput, HitpointInput, StartingGoldInput, PrepareLimitLevelInput, PrepareLimitInput, SpellcastingInput, SpellSlotInput, LevelAttributeInput, ResourceInput, MulticlassAbilityInput, MulticlassInput, SubtypeInput, ClassProficiencyInput, ClassInput, CharacterModifierInput, CharacterSenseInput, CharacterFeatInput, CharacterProficiencyInput, CharacterExpertiseInput, CharacterSpellInput, CharacterFeatureOptionInput, CharacterFeatureInput, RollInput, RollTypeInput, ManualInput, ManualRolledInput, DistributedInput, PointBuyInput, StandardArrayInput, ScoresInput, CharacterAbilitiesInput, LineageInput, CharacterAncestryInput, SubclassInput, ClassSpellInput, ClassSpellListInput, CharacterSpellSlotsInput, CharacterSpellcastingInput, CharacterClassInput, StartingEquipmentInput, StartingEquipmentGroupInput, ClassStartingEquipmentInput, BackgroundStartingEquipmentInput, PossessionsInput, CharacterCurrencyInput, CurrencyGroupInput, HitpointRollValuesInput, HitpointRollInput, HitpointFixedInput, CharacterHitpointInput, CharacterEquipmentObjectInput, CharacterEquipmentInput, CharacterInput, BackgroundInput, AncestryOptionInput, FEATURE_ENUM_INPUT, DAMAGE_ENUM_INPUT, SPELL_ENUM_INPUT, FEAT_ENUM_INPUT, SECTION_ENUM_INPUT, EQUIPMENT_ENUM_INPUT, CLASSES_ENUM_INPUT } from '@/types'

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>
}>

export const genericTypeInputObject = {
    __kind: z.literal('GenericTypeInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    tooltip: z.string().nullish(),
    short: z.string().nullish(),
} satisfies Properties<GenericTypeInput>

export const GenericTypeInputSchema = z.object(genericTypeInputObject)

export type GenericTypeInputInfer = z.infer<typeof GenericTypeInputSchema>

export const currencyConversionInputObject = {
    __kind: z.literal('CurrencyConversionInput'),
    copper: z.number(),
    silver: z.number(),
    gold: z.number(),
    electrum: z.number(),
    platinum: z.number(),
} satisfies Properties<CurrencyConversionInput>

export const CurrencyConversionInputSchema = z.object(currencyConversionInputObject)

export type CurrencyConversionInputInfer = z.infer<typeof CurrencyConversionInputSchema>

export const currencyInputObject = {
    __kind: z.literal('CurrencyInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    abbreviation: z.string(),
    conversions: CurrencyConversionInputSchema,
} satisfies Properties<CurrencyInput>

export const CurrencyInputSchema = z.object(currencyInputObject)

export type CurrencyInputInfer = z.infer<typeof CurrencyInputSchema>

export const equipmentCategoryPropertyInputObject = {
    __kind: z.literal('EquipmentCategoryPropertyInput'),
    id: z.string(),
    propertyId: z.string(),
    categoryId: z.string(),
} satisfies Properties<EquipmentCategoryPropertyInput>

export const EquipmentCategoryPropertyInputSchema = z.object(equipmentCategoryPropertyInputObject)

export type EquipmentCategoryPropertyInputInfer = z.infer<typeof EquipmentCategoryPropertyInputSchema>

export const systemEquipmentInputObject = {
    __kind: z.literal('SystemEquipmentInput'),
    categories: z.array(GenericTypeInputSchema),
    properties: z.array(GenericTypeInputSchema),
    categoryProperties: z.array(EquipmentCategoryPropertyInputSchema),
    rarities: z.array(GenericTypeInputSchema),
} satisfies Properties<SystemEquipmentInput>

export const SystemEquipmentInputSchema = z.object(systemEquipmentInputObject)

export type SystemEquipmentInputInfer = z.infer<typeof SystemEquipmentInputSchema>

export const modifierCategoryTypeInputObject = {
    __kind: z.literal('ModifierCategoryTypeInput'),
    id: z.string(),
    typeId: z.string(),
    categoryId: z.string(),
} satisfies Properties<ModifierCategoryTypeInput>

export const ModifierCategoryTypeInputSchema = z.object(modifierCategoryTypeInputObject)

export type ModifierCategoryTypeInputInfer = z.infer<typeof ModifierCategoryTypeInputSchema>

export const modifierTypeMethodInputObject = {
    __kind: z.literal('ModifierTypeMethodInput'),
    id: z.string(),
    typeId: z.string(),
    methodId: z.string(),
} satisfies Properties<ModifierTypeMethodInput>

export const ModifierTypeMethodInputSchema = z.object(modifierTypeMethodInputObject)

export type ModifierTypeMethodInputInfer = z.infer<typeof ModifierTypeMethodInputSchema>

export const modifierCategoryTypeMethodInputObject = {
    __kind: z.literal('ModifierCategoryTypeMethodInput'),
    id: z.string(),
    methodId: z.string(),
    typeId: z.string(),
    categoryId: z.string(),
} satisfies Properties<ModifierCategoryTypeMethodInput>

export const ModifierCategoryTypeMethodInputSchema = z.object(modifierCategoryTypeMethodInputObject)

export type ModifierCategoryTypeMethodInputInfer = z.infer<typeof ModifierCategoryTypeMethodInputSchema>

export const systemModifiersInputObject = {
    __kind: z.literal('SystemModifiersInput'),
    categories: z.array(GenericTypeInputSchema),
    types: z.array(GenericTypeInputSchema),
    methods: z.array(GenericTypeInputSchema),
    spellCategories: z.array(GenericTypeInputSchema),
    categoryTypes: z.array(ModifierCategoryTypeInputSchema),
    typeMethods: z.array(ModifierTypeMethodInputSchema),
    categoryMethods: z.array(ModifierCategoryTypeMethodInputSchema),
} satisfies Properties<SystemModifiersInput>

export const SystemModifiersInputSchema = z.object(systemModifiersInputObject)

export type SystemModifiersInputInfer = z.infer<typeof SystemModifiersInputSchema>

export const proficiencyLevelInputObject = {
    __kind: z.literal('ProficiencyLevelInput'),
    id: z.string(),
    label: z.string(),
    multiplier: z.number().nullish(),
} satisfies Properties<ProficiencyLevelInput>

export const ProficiencyLevelInputSchema = z.object(proficiencyLevelInputObject)

export type ProficiencyLevelInputInfer = z.infer<typeof ProficiencyLevelInputSchema>

export const systemProficiencyInputObject = {
    __kind: z.literal('SystemProficiencyInput'),
    levels: z.array(ProficiencyLevelInputSchema),
    categories: z.array(GenericTypeInputSchema),
} satisfies Properties<SystemProficiencyInput>

export const SystemProficiencyInputSchema = z.object(systemProficiencyInputObject)

export type SystemProficiencyInputInfer = z.infer<typeof SystemProficiencyInputSchema>

export const systemSpellInputObject = {
    __kind: z.literal('SystemSpellInput'),
    categories: z.array(GenericTypeInputSchema),
    durations: z.array(GenericTypeInputSchema),
    ranges: z.array(GenericTypeInputSchema),
    schools: z.array(GenericTypeInputSchema),
    shapes: z.array(GenericTypeInputSchema),
    requirements: z.array(GenericTypeInputSchema),
} satisfies Properties<SystemSpellInput>

export const SystemSpellInputSchema = z.object(systemSpellInputObject)

export type SystemSpellInputInfer = z.infer<typeof SystemSpellInputSchema>

export const generateOptionInputObject = {
    __kind: z.literal('GenerateOptionInput'),
    id: z.string(),
    label: z.string(),
    reduce: z.number().int().nullish(),
} satisfies Properties<GenerateOptionInput>

export const GenerateOptionInputSchema = z.object(generateOptionInputObject)

export type GenerateOptionInputInfer = z.infer<typeof GenerateOptionInputSchema>

export const imperialInputObject = {
    __kind: z.literal('ImperialInput'),
    weight: z.array(GenericTypeInputSchema),
    volume: z.array(GenericTypeInputSchema),
    length: z.array(GenericTypeInputSchema),
} satisfies Properties<ImperialInput>

export const ImperialInputSchema = z.object(imperialInputObject)

export type ImperialInputInfer = z.infer<typeof ImperialInputSchema>

export const systemMeasurementInputObject = {
    __kind: z.literal('SystemMeasurementInput'),
    amount: z.array(GenericTypeInputSchema),
    rounding: z.array(GenericTypeInputSchema),
    imperial: ImperialInputSchema,
} satisfies Properties<SystemMeasurementInput>

export const SystemMeasurementInputSchema = z.object(systemMeasurementInputObject)

export type SystemMeasurementInputInfer = z.infer<typeof SystemMeasurementInputSchema>

export const abilityGenerateMethodInputObject = {
    __kind: z.literal('AbilityGenerateMethodInput'),
    id: z.string(),
    label: z.string(),
    total: z.number().int().nullish(),
    options: z.array(GenerateOptionInputSchema).nullish(),
} satisfies Properties<AbilityGenerateMethodInput>

export const AbilityGenerateMethodInputSchema = z.object(abilityGenerateMethodInputObject)

export type AbilityGenerateMethodInputInfer = z.infer<typeof AbilityGenerateMethodInputSchema>

export const systemRulesInputObject = {
    __kind: z.literal('SystemRulesInput'),
    measurements: SystemMeasurementInputSchema,
    abilityGenerateMethod: z.array(AbilityGenerateMethodInputSchema),
} satisfies Properties<SystemRulesInput>

export const SystemRulesInputSchema = z.object(systemRulesInputObject)

export type SystemRulesInputInfer = z.infer<typeof SystemRulesInputSchema>

export const chargeOptionInputObject = {
    __kind: z.literal('ChargeOptionInput'),
    id: z.string(),
    label: z.string(),
    features: z.array(z.enum(FEATURE_ENUM_INPUT)).nullish(),
    damage: z.array(z.enum(DAMAGE_ENUM_INPUT)).nullish(),
    feats: z.array(z.enum(FEAT_ENUM_INPUT)).nullish(),
    sections: z.array(z.enum(SECTION_ENUM_INPUT)).nullish(),
    spells: z.array(z.enum(SPELL_ENUM_INPUT)).nullish(),
    equipment: z.array(z.enum(EQUIPMENT_ENUM_INPUT)).nullish(),
    classes: z.array(z.enum(CLASSES_ENUM_INPUT)).nullish(),
} satisfies Properties<ChargeOptionInput>

export const ChargeOptionInputSchema = z.object(chargeOptionInputObject)

export type ChargeOptionInputInfer = z.infer<typeof ChargeOptionInputSchema>

export const systemChargesInputObject = {
    __kind: z.literal('SystemChargesInput'),
    resets: z.array(ChargeOptionInputSchema),
    limits: z.array(ChargeOptionInputSchema),
} satisfies Properties<SystemChargesInput>

export const SystemChargesInputSchema = z.object(systemChargesInputObject)

export type SystemChargesInputInfer = z.infer<typeof SystemChargesInputSchema>

export const characterSettingInputObject = {
    __kind: z.literal('CharacterSettingInput'),
    hitpointCalcMethods: z.array(GenericTypeInputSchema),
    advancementMethods: z.array(GenericTypeInputSchema),
    spellPointCalcMethods: z.array(GenericTypeInputSchema),
    startingEquipmentOptions: z.array(GenericTypeInputSchema),
} satisfies Properties<CharacterSettingInput>

export const CharacterSettingInputSchema = z.object(characterSettingInputObject)

export type CharacterSettingInputInfer = z.infer<typeof CharacterSettingInputSchema>

export const systemActionInputObject = {
    __kind: z.literal('SystemActionInput'),
    id: z.string(),
    label: z.string(),
    features: z.boolean(),
    damage: z.boolean(),
    feats: z.boolean(),
    sections: z.boolean(),
    spells: z.boolean(),
    equipment: z.boolean(),
    classes: z.boolean(),
} satisfies Properties<SystemActionInput>

export const SystemActionInputSchema = z.object(systemActionInputObject)

export type SystemActionInputInfer = z.infer<typeof SystemActionInputSchema>

export const systemAttributeInputObject = {
    __kind: z.literal('SystemAttributeInput'),
    id: z.string(),
    label: z.string(),
    features: z.array(z.enum(FEATURE_ENUM_INPUT)).nullish(),
    damage: z.array(z.enum(DAMAGE_ENUM_INPUT)).nullish(),
    feats: z.array(z.enum(FEAT_ENUM_INPUT)).nullish(),
    sections: z.array(z.enum(SECTION_ENUM_INPUT)).nullish(),
    spells: z.array(z.enum(SPELL_ENUM_INPUT)).nullish(),
    equipment: z.array(z.enum(EQUIPMENT_ENUM_INPUT)).nullish(),
    classes: z.array(z.enum(CLASSES_ENUM_INPUT)).nullish(),
} satisfies Properties<SystemAttributeInput>

export const SystemAttributeInputSchema = z.object(systemAttributeInputObject)

export type SystemAttributeInputInfer = z.infer<typeof SystemAttributeInputSchema>

export const systemCategoryInputObject = {
    __kind: z.literal('SystemCategoryInput'),
    id: z.string(),
    label: z.string(),
    features: z.boolean(),
    classes: z.boolean(),
    races: z.boolean(),
} satisfies Properties<SystemCategoryInput>

export const SystemCategoryInputSchema = z.object(systemCategoryInputObject)

export type SystemCategoryInputInfer = z.infer<typeof SystemCategoryInputSchema>

export const systemSenseInputObject = {
    __kind: z.literal('SystemSenseInput'),
    id: z.string(),
    label: z.string(),
    creatureDesc: z.string().nullish(),
    monsterDesc: z.string().nullish(),
    type: z.array(z.string().optional()).nullish(),
} satisfies Properties<SystemSenseInput>

export const SystemSenseInputSchema = z.object(systemSenseInputObject)

export type SystemSenseInputInfer = z.infer<typeof SystemSenseInputSchema>

export const systemSkillInputObject = {
    __kind: z.literal('SystemSkillInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    abilityId: z.string(),
} satisfies Properties<SystemSkillInput>

export const SystemSkillInputSchema = z.object(systemSkillInputObject)

export type SystemSkillInputInfer = z.infer<typeof SystemSkillInputSchema>

export const systemPrerequisiteInputObject = {
    __kind: z.literal('SystemPrerequisiteInput'),
    id: z.string(),
    label: z.string(),
    features: z.array(z.enum(FEATURE_ENUM_INPUT)).nullish(),
    damage: z.array(z.enum(DAMAGE_ENUM_INPUT)).nullish(),
    feats: z.array(z.enum(FEAT_ENUM_INPUT)).nullish(),
    sections: z.array(z.enum(SECTION_ENUM_INPUT)).nullish(),
    spells: z.array(z.enum(SPELL_ENUM_INPUT)).nullish(),
    equipment: z.array(z.enum(EQUIPMENT_ENUM_INPUT)).nullish(),
    classes: z.array(z.enum(CLASSES_ENUM_INPUT)).nullish(),
} satisfies Properties<SystemPrerequisiteInput>

export const SystemPrerequisiteInputSchema = z.object(systemPrerequisiteInputObject)

export type SystemPrerequisiteInputInfer = z.infer<typeof SystemPrerequisiteInputSchema>

export const systemInputObject = {
    __kind: z.literal('SystemInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    abilities: z.array(GenericTypeInputSchema),
    actions: z.array(SystemActionInputSchema),
    alignments: z.array(GenericTypeInputSchema),
    attributes: z.array(SystemAttributeInputSchema),
    categories: z.array(SystemCategoryInputSchema),
    characters: CharacterSettingInputSchema,
    charges: SystemChargesInputSchema,
    conditions: z.array(GenericTypeInputSchema),
    currencies: z.array(CurrencyInputSchema),
    damageTypes: z.array(GenericTypeInputSchema),
    equipment: SystemEquipmentInputSchema,
    languages: z.array(GenericTypeInputSchema),
    modifiers: SystemModifiersInputSchema,
    passives: z.array(GenericTypeInputSchema),
    prerequisites: z.array(SystemPrerequisiteInputSchema),
    proficiencies: SystemProficiencyInputSchema,
    rules: SystemRulesInputSchema,
    senses: z.array(SystemSenseInputSchema),
    sizes: z.array(GenericTypeInputSchema),
    skills: z.array(SystemSkillInputSchema),
    speeds: z.array(GenericTypeInputSchema),
    spells: SystemSpellInputSchema,
    terrains: z.array(GenericTypeInputSchema),
    ownerId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<SystemInput>

export const SystemInputSchema = z.object(systemInputObject)

export type SystemInputInfer = z.infer<typeof SystemInputSchema>

export const upcastFieldsInputObject = {
    __kind: z.literal('UpcastFieldsInput'),
    id: z.string().nullish(),
    size: z.number().nullish(),
    unit: z.string().nullish(),
    amount: z.number().int().nullish(),
    minRange: z.number().int().nullish(),
    maxRange: z.number().int().nullish(),
    distance: z.number().int().nullish(),
} satisfies Properties<UpcastFieldsInput>

export const UpcastFieldsInputSchema = z.object(upcastFieldsInputObject)

export type UpcastFieldsInputInfer = z.infer<typeof UpcastFieldsInputSchema>

export const setPerLevelInputObject = {
    __kind: z.literal('SetPerLevelInput'),
    level: z.string().nullish(),
    primary: z.number().int().nullish(),
    secondary: z.number().int().nullish(),
    bonus: z.number().int().nullish(),
} satisfies Properties<SetPerLevelInput>

export const SetPerLevelInputSchema = z.object(setPerLevelInputObject)

export type SetPerLevelInputInfer = z.infer<typeof SetPerLevelInputSchema>

export const damagePoolInputObject = {
    __kind: z.literal('DamagePoolInput'),
    attribute: z.string().nullish(),
    setAmount: z.number().int().nullish(),
    multiplier: z.number().int().nullish(),
    minAmount: z.number().int().nullish(),
    maxAmount: z.number().int().nullish(),
    ability: z.string().nullish(),
    option: z.string().nullish(),
} satisfies Properties<DamagePoolInput>

export const DamagePoolInputSchema = z.object(damagePoolInputObject)

export type DamagePoolInputInfer = z.infer<typeof DamagePoolInputSchema>

export const damageFieldsInputObject = {
    __kind: z.literal('DamageFieldsInput'),
    dieConfig: z.string().nullish(),
    attribute: z.string().nullish(),
    id: z.string().nullish(),
    ability: z.string().nullish(),
    setAmount: z.number().int().nullish(),
    multiplier: z.number().int().nullish(),
    minAmount: z.number().int().nullish(),
    maxAmount: z.number().int().nullish(),
    pool: DamagePoolInputSchema.nullish(),
} satisfies Properties<DamageFieldsInput>

export const DamageFieldsInputSchema = z.object(damageFieldsInputObject)

export type DamageFieldsInputInfer = z.infer<typeof DamageFieldsInputSchema>

export const diePerLevelInputObject = {
    __kind: z.literal('DiePerLevelInput'),
    level: z.string().nullish(),
    primary: DamageFieldsInputSchema.nullish(),
    secondary: DamageFieldsInputSchema.nullish(),
    bonus: DamageFieldsInputSchema.nullish(),
} satisfies Properties<DiePerLevelInput>

export const DiePerLevelInputSchema = z.object(diePerLevelInputObject)

export type DiePerLevelInputInfer = z.infer<typeof DiePerLevelInputSchema>

export const damageInputObject = {
    __kind: z.literal('DamageInput'),
    attributes: z.array(z.string()).nullish(),
    damageSave: z.array(z.string()).nullish(),
    setPerLevel: z.array(SetPerLevelInputSchema).nullish(),
    diePerLevel: z.array(DiePerLevelInputSchema).nullish(),
    primary: DamageFieldsInputSchema.nullish(),
    secondary: DamageFieldsInputSchema.nullish(),
    bonus: DamageFieldsInputSchema.nullish(),
    versatile: DamageFieldsInputSchema.nullish(),
} satisfies Properties<DamageInput>

export const DamageInputSchema = z.object(damageInputObject)

export type DamageInputInfer = z.infer<typeof DamageInputSchema>

export const upcastLevelInputObject = {
    __kind: z.literal('UpcastLevelInput'),
    level: z.number().int().nullish(),
    damage: DamageInputSchema.nullish(),
    duration: UpcastFieldsInputSchema.nullish(),
    range: UpcastFieldsInputSchema.nullish(),
    shape: UpcastFieldsInputSchema.nullish(),
    targets: z.number().int().nullish(),
} satisfies Properties<UpcastLevelInput>

export const UpcastLevelInputSchema = z.object(upcastLevelInputObject)

export type UpcastLevelInputInfer = z.infer<typeof UpcastLevelInputSchema>

export const upcastInputObject = {
    __kind: z.literal('UpcastInput'),
    attributes: z.array(z.string()).nullish(),
    levels: z.array(UpcastLevelInputSchema.optional()).nullish(),
} satisfies Properties<UpcastInput>

export const UpcastInputSchema = z.object(upcastInputObject)

export type UpcastInputInfer = z.infer<typeof UpcastInputSchema>

export const shapeInputObject = {
    __kind: z.literal('ShapeInput'),
    id: z.string(),
    size: z.number().nullish(),
    unit: z.string().nullish(),
} satisfies Properties<ShapeInput>

export const ShapeInputSchema = z.object(shapeInputObject)

export type ShapeInputInfer = z.infer<typeof ShapeInputSchema>

export const rangeInputObject = {
    __kind: z.literal('RangeInput'),
    id: z.string(),
    minRange: z.number().int().nullish(),
    maxRange: z.number().int().nullish(),
    distance: z.number().int().nullish(),
    unit: z.string().nullish(),
} satisfies Properties<RangeInput>

export const RangeInputSchema = z.object(rangeInputObject)

export type RangeInputInfer = z.infer<typeof RangeInputSchema>

export const durationInputObject = {
    __kind: z.literal('DurationInput'),
    id: z.string(),
    amount: z.number().int().nullish(),
} satisfies Properties<DurationInput>

export const DurationInputSchema = z.object(durationInputObject)

export type DurationInputInfer = z.infer<typeof DurationInputSchema>

export const actionPropertyInputObject = {
    __kind: z.literal('ActionPropertyInput'),
    id: z.string().nullish(),
    amount: z.number().int().nullish(),
} satisfies Properties<ActionPropertyInput>

export const ActionPropertyInputSchema = z.object(actionPropertyInputObject)

export type ActionPropertyInputInfer = z.infer<typeof ActionPropertyInputSchema>

export const actionGroupInputObject = {
    __kind: z.literal('ActionGroupInput'),
    primary: ActionPropertyInputSchema.nullish(),
    secondary: ActionPropertyInputSchema.nullish(),
} satisfies Properties<ActionGroupInput>

export const ActionGroupInputSchema = z.object(actionGroupInputObject)

export type ActionGroupInputInfer = z.infer<typeof ActionGroupInputSchema>

export const saveAbilityInputObject = {
    __kind: z.literal('SaveAbilityInput'),
    id: z.string(),
    minAmount: z.number().int().nullish(),
    attributes: z.array(z.string()).nullish(),
    abilityModifier: z.string().nullish(),
} satisfies Properties<SaveAbilityInput>

export const SaveAbilityInputSchema = z.object(saveAbilityInputObject)

export type SaveAbilityInputInfer = z.infer<typeof SaveAbilityInputSchema>

export const spellInputObject = {
    __kind: z.literal('SpellInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    level: z.number().int(),
    school: z.string(),
    classes: z.array(z.string()),
    attributes: z.array(z.string()).nullish(),
    upcast: UpcastInputSchema.nullish(),
    actions: ActionGroupInputSchema.nullish(),
    targets: z.number().int().nullish(),
    saveAbility: SaveAbilityInputSchema.nullish(),
    conditions: z.array(z.string()).nullish(),
    requirements: z.array(z.string()).nullish(),
    range: RangeInputSchema,
    shape: ShapeInputSchema,
    duration: DurationInputSchema,
    damage: DamageInputSchema.nullish(),
    materialDesc: z.string().nullish(),
    ownerId: z.string().nullish(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<SpellInput>

export const SpellInputSchema = z.object(spellInputObject)

export type SpellInputInfer = z.infer<typeof SpellInputSchema>

export const ancestryInputObject = {
    __kind: z.literal('AncestryInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    options: z.array(z.string()),
} satisfies Properties<AncestryInput>

export const AncestryInputSchema = z.object(ancestryInputObject)

export type AncestryInputInfer = z.infer<typeof AncestryInputSchema>

export const raceSpeedInputObject = {
    __kind: z.literal('RaceSpeedInput'),
    walking: z.number().int().nullish(),
    swimming: z.number().int().nullish(),
    flying: z.number().int().nullish(),
    climbing: z.number().int().nullish(),
} satisfies Properties<RaceSpeedInput>

export const RaceSpeedInputSchema = z.object(raceSpeedInputObject)

export type RaceSpeedInputInfer = z.infer<typeof RaceSpeedInputSchema>

export const detailInputObject = {
    __kind: z.literal('DetailInput'),
    label: z.string(),
    desc: z.string().nullish(),
} satisfies Properties<DetailInput>

export const DetailInputSchema = z.object(detailInputObject)

export type DetailInputInfer = z.infer<typeof DetailInputSchema>

export const traitsInputObject = {
    __kind: z.literal('TraitsInput'),
    details: z.array(DetailInputSchema).nullish(),
    size: z.string().nullish(),
    speeds: RaceSpeedInputSchema.nullish(),
} satisfies Properties<TraitsInput>

export const TraitsInputSchema = z.object(traitsInputObject)

export type TraitsInputInfer = z.infer<typeof TraitsInputSchema>

export const raceInputObject = {
    __kind: z.literal('RaceInput'),
    id: z.string(),
    label: z.string(),
    quote: z.string().nullish(),
    desc: z.string().nullish(),
    playable: z.string().nullish(),
    category: z.string(),
    lineages: z.array(z.string()).nullish(),
    ancestry: AncestryInputSchema.nullish(),
    details: z.array(DetailInputSchema).nullish(),
    traits: TraitsInputSchema.nullish(),
    features: z.array(z.string()).nullish(),
    ownerId: z.string().nullish(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<RaceInput>

export const RaceInputSchema = z.object(raceInputObject)

export type RaceInputInfer = z.infer<typeof RaceInputSchema>

export const usesPerLevelInputObject = {
    __kind: z.literal('UsesPerLevelInput'),
    level: z.number().int().nullish(),
    uses: z.number().int().nullish(),
} satisfies Properties<UsesPerLevelInput>

export const UsesPerLevelInputSchema = z.object(usesPerLevelInputObject)

export type UsesPerLevelInputInfer = z.infer<typeof UsesPerLevelInputSchema>

export const chargeInputObject = {
    __kind: z.literal('ChargeInput'),
    reset: z.string().nullish(),
    limit: z.string().nullish(),
    ability: z.string().nullish(),
    skill: z.string().nullish(),
    usesPerLevel: z.array(UsesPerLevelInputSchema.optional()).nullish(),
    minAmount: z.number().int().nullish(),
    addAmount: z.number().int().nullish(),
    setAmount: z.number().int().nullish(),
    multiplier: z.number().int().nullish(),
    resourcePoints: z.number().int().nullish(),
} satisfies Properties<ChargeInput>

export const ChargeInputSchema = z.object(chargeInputObject)

export type ChargeInputInfer = z.infer<typeof ChargeInputSchema>

export const equipPrerequisiteInputObject = {
    __kind: z.literal('EquipPrerequisiteInput'),
    numberEquipped: z.number().int().nullish(),
    category: z.string().nullish(),
    equipment: z.array(z.string()).nullish(),
    properties: z.array(z.string()).nullish(),
} satisfies Properties<EquipPrerequisiteInput>

export const EquipPrerequisiteInputSchema = z.object(equipPrerequisiteInputObject)

export type EquipPrerequisiteInputInfer = z.infer<typeof EquipPrerequisiteInputSchema>

export const abilityScoreInputObject = {
    __kind: z.literal('AbilityScoreInput'),
    abilities: z.array(z.string()).nullish(),
    score: z.number().int().nullish(),
} satisfies Properties<AbilityScoreInput>

export const AbilityScoreInputSchema = z.object(abilityScoreInputObject)

export type AbilityScoreInputInfer = z.infer<typeof AbilityScoreInputSchema>

export const prerequisiteInputObject = {
    __kind: z.literal('PrerequisiteInput'),
    options: z.array(z.string()).nullish(),
    skillProficiencies: z.array(z.string()).nullish(),
    equipmentProficiencies: z.array(EquipPrerequisiteInputSchema).nullish(),
    equipped: z.array(EquipPrerequisiteInputSchema).nullish(),
    notEquipped: z.array(EquipPrerequisiteInputSchema).nullish(),
    abilityScore: AbilityScoreInputSchema.nullish(),
    spellsObtained: z.array(z.string()).nullish(),
    featuresObtained: z.array(z.string()).nullish(),
    optionsObtained: z.array(z.string()).nullish(),
    size: z.array(z.string()).nullish(),
} satisfies Properties<PrerequisiteInput>

export const PrerequisiteInputSchema = z.object(prerequisiteInputObject)

export type PrerequisiteInputInfer = z.infer<typeof PrerequisiteInputSchema>

export const proficiencyPropertiesInputObject = {
    __kind: z.literal('ProficiencyPropertiesInput'),
    ids: z.array(z.string()).nullish(),
    category: z.string().nullish(),
    properties: z.array(z.string()).nullish(),
} satisfies Properties<ProficiencyPropertiesInput>

export const ProficiencyPropertiesInputSchema = z.object(proficiencyPropertiesInputObject)

export type ProficiencyPropertiesInputInfer = z.infer<typeof ProficiencyPropertiesInputSchema>

export const equipmentCurrencyInputObject = {
    __kind: z.literal('EquipmentCurrencyInput'),
    id: z.string(),
    amount: z.number().int().nullish(),
} satisfies Properties<EquipmentCurrencyInput>

export const EquipmentCurrencyInputSchema = z.object(equipmentCurrencyInputObject)

export type EquipmentCurrencyInputInfer = z.infer<typeof EquipmentCurrencyInputSchema>

export const equipmentOptionItemInputObject = {
    __kind: z.literal('EquipmentOptionItemInput'),
    attributes: z.array(z.string()).nullish(),
    selectionCount: z.number().int().nullish(),
    category: z.string().nullish(),
    equipment: z.array(z.string()).nullish(),
    properties: z.array(z.string()).nullish(),
    quantity: z.number().int().nullish(),
    currencies: z.array(EquipmentCurrencyInputSchema).nullish(),
} satisfies Properties<EquipmentOptionItemInput>

export const EquipmentOptionItemInputSchema = z.object(equipmentOptionItemInputObject)

export type EquipmentOptionItemInputInfer = z.infer<typeof EquipmentOptionItemInputSchema>

export const spellsByLevelInputObject = {
    __kind: z.literal('SpellsByLevelInput'),
    id: z.string(),
    ids: z.array(z.string()).nullish(),
    level: z.number().int().nullish(),
    spellLevel: z.number().int().nullish(),
} satisfies Properties<SpellsByLevelInput>

export const SpellsByLevelInputSchema = z.object(spellsByLevelInputObject)

export type SpellsByLevelInputInfer = z.infer<typeof SpellsByLevelInputSchema>

export const featureSpellInputObject = {
    __kind: z.literal('FeatureSpellInput'),
    id: z.string(),
    ids: z.array(z.string()).nullish(),
    attributes: z.array(z.string()).nullish(),
    selectionCount: z.number().int().nullish(),
    classLimit: z.array(z.string()).nullish(),
    levelLimit: z.array(z.string()).nullish(),
    attributeLimit: z.array(z.string()).nullish(),
    ability: z.string().nullish(),
    spellLevel: z.number().int().nullish(),
    spellsByLevel: z.array(SpellsByLevelInputSchema).nullish(),
    subtype: z.string().nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    charges: ChargeInputSchema.nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<FeatureSpellInput>

export const FeatureSpellInputSchema = z.object(featureSpellInputObject)

export type FeatureSpellInputInfer = z.infer<typeof FeatureSpellInputSchema>

export const featureSenseInputObject = {
    __kind: z.literal('FeatureSenseInput'),
    id: z.string(),
    attributes: z.array(z.string()).nullish(),
    selectionCount: z.number().int().nullish(),
    subtype: z.string().nullish(),
    ids: z.array(z.string()).nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    charges: ChargeInputSchema.nullish(),
} satisfies Properties<FeatureSenseInput>

export const FeatureSenseInputSchema = z.object(featureSenseInputObject)

export type FeatureSenseInputInfer = z.infer<typeof FeatureSenseInputSchema>

export const featureProficiencyInputObject = {
    __kind: z.literal('FeatureProficiencyInput'),
    id: z.string(),
    subtype: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    selectionCount: z.number().int().nullish(),
    category: z.string(),
    level: z.string().nullish(),
    rounding: z.string().nullish(),
    saveAbilities: z.array(z.string()).nullish(),
    skills: z.array(z.string()).nullish(),
    languages: z.array(z.string()).nullish(),
    properties: ProficiencyPropertiesInputSchema.nullish(),
    equipment: ProficiencyPropertiesInputSchema.nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<FeatureProficiencyInput>

export const FeatureProficiencyInputSchema = z.object(featureProficiencyInputObject)

export type FeatureProficiencyInputInfer = z.infer<typeof FeatureProficiencyInputSchema>

export const featureOptionInputObject = {
    __kind: z.literal('FeatureOptionInput'),
    id: z.string(),
    label: z.string().nullish(),
    desc: z.string().nullish(),
    detail: z.string().nullish(),
    category: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    actions: ActionGroupInputSchema.nullish(),
    damage: DamageInputSchema.nullish(),
    charges: ChargeInputSchema.nullish(),
    range: RangeInputSchema.nullish(),
    shape: ShapeInputSchema.nullish(),
    targets: z.number().int().nullish(),
    feats: z.array(z.string()).nullish(),
    modifiers: z.array(z.string()).nullish(),
    proficiencies: z.array(z.string()).nullish(),
    expertise: z.array(z.string()).nullish(),
    senses: z.array(z.string()).nullish(),
    spells: z.array(z.string()).nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    saveAbility: SaveAbilityInputSchema.nullish(),
    levelAvailable: z.string().nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<FeatureOptionInput>

export const FeatureOptionInputSchema = z.object(featureOptionInputObject)

export type FeatureOptionInputInfer = z.infer<typeof FeatureOptionInputSchema>

export const modifierDiePerLevelInputObject = {
    __kind: z.literal('ModifierDiePerLevelInput'),
    level: z.number().int(),
    dieConfig: z.string(),
} satisfies Properties<ModifierDiePerLevelInput>

export const ModifierDiePerLevelInputSchema = z.object(modifierDiePerLevelInputObject)

export type ModifierDiePerLevelInputInfer = z.infer<typeof ModifierDiePerLevelInputSchema>

export const modifierSetPerLevelInputObject = {
    __kind: z.literal('ModifierSetPerLevelInput'),
    level: z.number().int(),
    setAmount: z.number().int(),
} satisfies Properties<ModifierSetPerLevelInput>

export const ModifierSetPerLevelInputSchema = z.object(modifierSetPerLevelInputObject)

export type ModifierSetPerLevelInputInfer = z.infer<typeof ModifierSetPerLevelInputSchema>

export const featureModifierInputObject = {
    __kind: z.literal('FeatureModifierInput'),
    id: z.string(),
    subtype: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    selectionCount: z.number().int().nullish(),
    category: z.string().nullish(),
    type: z.string().nullish(),
    method: z.string().nullish(),
    methodAbility: z.string().nullish(),
    methodSkill: z.string().nullish(),
    multiplier: z.number().int().nullish(),
    maxAmount: z.number().int().nullish(),
    minAmount: z.number().int().nullish(),
    setAmount: z.number().int().nullish(),
    dieConfig: z.string().nullish(),
    feature: z.string().nullish(),
    diePerLevel: z.array(ModifierDiePerLevelInputSchema).nullish(),
    setPerLevel: z.array(ModifierSetPerLevelInputSchema).nullish(),
    skills: z.array(z.string()).nullish(),
    saveAbilities: z.array(z.string()).nullish(),
    abilities: z.array(z.string()).nullish(),
    speeds: z.array(z.string()).nullish(),
    charges: ChargeInputSchema.nullish(),
    range: z.string().nullish(),
    minRange: z.number().int().nullish(),
    maxRange: z.number().int().nullish(),
    shape: z.string().nullish(),
    size: z.number().int().nullish(),
    duration: z.string().nullish(),
    unit: z.string().nullish(),
    conditions: z.array(z.string()).nullish(),
    damageTypes: z.array(z.string()).nullish(),
    damageType: z.string().nullish(),
    spells: z.string().nullish(),
    spellCategory: z.string().nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<FeatureModifierInput>

export const FeatureModifierInputSchema = z.object(featureModifierInputObject)

export type FeatureModifierInputInfer = z.infer<typeof FeatureModifierInputSchema>

export const featureFeatInputObject = {
    __kind: z.literal('FeatureFeatInput'),
    id: z.string(),
    attributes: z.array(z.string()).nullish(),
    feats: z.array(z.string()).nullish(),
    selectionCount: z.number().int().nullish(),
    subtype: z.string().nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<FeatureFeatInput>

export const FeatureFeatInputSchema = z.object(featureFeatInputObject)

export type FeatureFeatInputInfer = z.infer<typeof FeatureFeatInputSchema>

export const featureExpertiseInputObject = {
    __kind: z.literal('FeatureExpertiseInput'),
    id: z.string(),
    subtype: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    selectionCount: z.number().int().nullish(),
    category: z.string(),
    saveAbilities: z.array(z.string()).nullish(),
    skills: z.array(z.string()).nullish(),
    languages: z.array(z.string()).nullish(),
    properties: ProficiencyPropertiesInputSchema.nullish(),
    equipment: ProficiencyPropertiesInputSchema.nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<FeatureExpertiseInput>

export const FeatureExpertiseInputSchema = z.object(featureExpertiseInputObject)

export type FeatureExpertiseInputInfer = z.infer<typeof FeatureExpertiseInputSchema>

export const optionsByLevelInputObject = {
    __kind: z.literal('OptionsByLevelInput'),
    level: z.number().int().nullish(),
    count: z.number().int().nullish(),
    replaceCount: z.number().int().nullish(),
} satisfies Properties<OptionsByLevelInput>

export const OptionsByLevelInputSchema = z.object(optionsByLevelInputObject)

export type OptionsByLevelInputInfer = z.infer<typeof OptionsByLevelInputSchema>

export const featureInputObject = {
    __kind: z.literal('FeatureInput'),
    id: z.string(),
    label: z.string().nullish(),
    desc: z.string().nullish(),
    detail: z.string().nullish(),
    category: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    actions: ActionGroupInputSchema.nullish(),
    damage: DamageInputSchema.nullish(),
    charges: ChargeInputSchema.nullish(),
    optionsByLevel: z.array(OptionsByLevelInputSchema).nullish(),
    range: RangeInputSchema.nullish(),
    shape: ShapeInputSchema.nullish(),
    targets: z.number().int().nullish(),
    feats: z.array(z.string()).nullish(),
    modifiers: z.array(z.string()).nullish(),
    proficiencies: z.array(z.string()).nullish(),
    expertise: z.array(z.string()).nullish(),
    senses: z.array(z.string()).nullish(),
    spells: z.array(z.string()).nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    saveAbility: SaveAbilityInputSchema.nullish(),
    levelAvailable: z.string().nullish(),
    options: z.array(z.string()).nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<FeatureInput>

export const FeatureInputSchema = z.object(featureInputObject)

export type FeatureInputInfer = z.infer<typeof FeatureInputSchema>

export const featInputObject = {
    __kind: z.literal('FeatInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    detail: z.string().nullish(),
    category: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    actions: ActionGroupInputSchema.nullish(),
    damage: DamageInputSchema.nullish(),
    charges: ChargeInputSchema.nullish(),
    range: RangeInputSchema.nullish(),
    shape: ShapeInputSchema.nullish(),
    targets: z.number().int().nullish(),
    modifiers: z.array(z.string()).nullish(),
    proficiencies: z.array(z.string()).nullish(),
    expertise: z.array(z.string()).nullish(),
    senses: z.array(z.string()).nullish(),
    spells: z.array(z.string()).nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
    saveAbility: SaveAbilityInputSchema.nullish(),
    selectionCount: z.number().int().nullish(),
    levelAvailable: z.string().nullish(),
    features: z.array(z.string()).nullish(),
    options: z.array(z.string()).nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<FeatInput>

export const FeatInputSchema = z.object(featInputObject)

export type FeatInputInfer = z.infer<typeof FeatInputSchema>

export const speedInputObject = {
    __kind: z.literal('SpeedInput'),
    amount: z.number().int().nullish(),
    unit: z.string(),
} satisfies Properties<SpeedInput>

export const SpeedInputSchema = z.object(speedInputObject)

export type SpeedInputInfer = z.infer<typeof SpeedInputSchema>

export const weightInputObject = {
    __kind: z.literal('WeightInput'),
    amount: z.number().nullish(),
    unit: z.string(),
} satisfies Properties<WeightInput>

export const WeightInputSchema = z.object(weightInputObject)

export type WeightInputInfer = z.infer<typeof WeightInputSchema>

export const capacityInputObject = {
    __kind: z.literal('CapacityInput'),
    amount: z.number().nullish(),
    unit: z.string(),
} satisfies Properties<CapacityInput>

export const CapacityInputSchema = z.object(capacityInputObject)

export type CapacityInputInfer = z.infer<typeof CapacityInputSchema>

export const costInputObject = {
    __kind: z.literal('CostInput'),
    amount: z.number().int().nullish(),
    currency: z.string(),
} satisfies Properties<CostInput>

export const CostInputSchema = z.object(costInputObject)

export type CostInputInfer = z.infer<typeof CostInputSchema>

export const containsInputObject = {
    __kind: z.literal('ContainsInput'),
    id: z.string(),
    quantity: z.number().int(),
} satisfies Properties<ContainsInput>

export const ContainsInputSchema = z.object(containsInputObject)

export type ContainsInputInfer = z.infer<typeof ContainsInputSchema>

export const equipmentRangeInputObject = {
    __kind: z.literal('EquipmentRangeInput'),
    minRange: z.number().int().nullish(),
    maxRange: z.number().int().nullish(),
    unit: z.string(),
} satisfies Properties<EquipmentRangeInput>

export const EquipmentRangeInputSchema = z.object(equipmentRangeInputObject)

export type EquipmentRangeInputInfer = z.infer<typeof EquipmentRangeInputSchema>

export const equipmentInputObject = {
    __kind: z.literal('EquipmentInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    quote: z.string().nullish(),
    cost: CostInputSchema,
    weight: WeightInputSchema,
    capacity: CapacityInputSchema.nullish(),
    maxStack: z.number().int().nullish(),
    quantity: z.number().int(),
    properties: z.array(z.string()).nullish(),
    category: z.string(),
    rarity: z.string(),
    attributes: z.array(z.string()).nullish(),
    damage: DamageInputSchema.nullish(),
    saveAbility: SaveAbilityInputSchema.nullish(),
    primaryAbility: z.string().nullish(),
    secondaryAbility: z.string().nullish(),
    optionalAbility: z.string().nullish(),
    maxBonus: z.number().int().nullish(),
    armorClass: z.number().int().nullish(),
    prerequisities: PrerequisiteInputSchema.nullish(),
    speed: SpeedInputSchema.nullish(),
    range: EquipmentRangeInputSchema.nullish(),
    contains: z.array(ContainsInputSchema).nullish(),
    features: z.array(z.string()).nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
    rank: z.number().int().nullish(),
} satisfies Properties<EquipmentInput>

export const EquipmentInputSchema = z.object(equipmentInputObject)

export type EquipmentInputInfer = z.infer<typeof EquipmentInputSchema>

export const hitpointInputObject = {
    __kind: z.literal('HitpointInput'),
    ability: z.string(),
    dieConfig: z.string().nullish(),
} satisfies Properties<HitpointInput>

export const HitpointInputSchema = z.object(hitpointInputObject)

export type HitpointInputInfer = z.infer<typeof HitpointInputSchema>

export const startingGoldInputObject = {
    __kind: z.literal('StartingGoldInput'),
    multiplier: z.number().int(),
    currency: z.string(),
    dieConfig: z.string().nullish(),
} satisfies Properties<StartingGoldInput>

export const StartingGoldInputSchema = z.object(startingGoldInputObject)

export type StartingGoldInputInfer = z.infer<typeof StartingGoldInputSchema>

export const prepareLimitLevelInputObject = {
    __kind: z.literal('PrepareLimitLevelInput'),
    measurement: z.string().nullish(),
    rounding: z.string().nullish(),
} satisfies Properties<PrepareLimitLevelInput>

export const PrepareLimitLevelInputSchema = z.object(prepareLimitLevelInputObject)

export type PrepareLimitLevelInputInfer = z.infer<typeof PrepareLimitLevelInputSchema>

export const prepareLimitInputObject = {
    __kind: z.literal('PrepareLimitInput'),
    methods: z.array(z.string()).nullish(),
    level: PrepareLimitLevelInputSchema.nullish(),
} satisfies Properties<PrepareLimitInput>

export const PrepareLimitInputSchema = z.object(prepareLimitInputObject)

export type PrepareLimitInputInfer = z.infer<typeof PrepareLimitInputSchema>

export const spellcastingInputObject = {
    __kind: z.literal('SpellcastingInput'),
    magicName: z.string().nullish(),
    ability: z.string().nullish(),
    maxSpellLevel: z.number().int().nullish(),
    attributes: z.array(z.string()).nullish(),
    charges: ChargeInputSchema.nullish(),
    prepareLimit: PrepareLimitInputSchema.nullish(),
} satisfies Properties<SpellcastingInput>

export const SpellcastingInputSchema = z.object(spellcastingInputObject)

export type SpellcastingInputInfer = z.infer<typeof SpellcastingInputSchema>

export const spellSlotInputObject = {
    __kind: z.literal('SpellSlotInput'),
    slotCount: z.number().int().nullish(),
} satisfies Properties<SpellSlotInput>

export const SpellSlotInputSchema = z.object(spellSlotInputObject)

export type SpellSlotInputInfer = z.infer<typeof SpellSlotInputSchema>

export const levelAttributeInputObject = {
    __kind: z.literal('LevelAttributeInput'),
    level: z.number().int().nullish(),
    spellSlots: z.array(SpellSlotInputSchema).nullish(),
    resourcePoints: z.number().int().nullish(),
    spellsKnownLimit: z.number().int().nullish(),
    cantripsKnownLimit: z.number().int().nullish(),
} satisfies Properties<LevelAttributeInput>

export const LevelAttributeInputSchema = z.object(levelAttributeInputObject)

export type LevelAttributeInputInfer = z.infer<typeof LevelAttributeInputSchema>

export const resourceInputObject = {
    __kind: z.literal('ResourceInput'),
    id: z.string(),
    label: z.string(),
    levelAvailable: z.number().int().nullish(),
    charges: ChargeInputSchema.nullish(),
    method: z.string().nullish(),
    desc: z.string().nullish(),
} satisfies Properties<ResourceInput>

export const ResourceInputSchema = z.object(resourceInputObject)

export type ResourceInputInfer = z.infer<typeof ResourceInputSchema>

export const multiclassAbilityInputObject = {
    __kind: z.literal('MulticlassAbilityInput'),
    id: z.string().nullish(),
    minAmount: z.number().int().nullish(),
} satisfies Properties<MulticlassAbilityInput>

export const MulticlassAbilityInputSchema = z.object(multiclassAbilityInputObject)

export type MulticlassAbilityInputInfer = z.infer<typeof MulticlassAbilityInputSchema>

export const multiclassInputObject = {
    __kind: z.literal('MulticlassInput'),
    primaryAbility: MulticlassAbilityInputSchema.nullish(),
    secondaryAbility: MulticlassAbilityInputSchema.nullish(),
    optionalAbility: MulticlassAbilityInputSchema.nullish(),
} satisfies Properties<MulticlassInput>

export const MulticlassInputSchema = z.object(multiclassInputObject)

export type MulticlassInputInfer = z.infer<typeof MulticlassInputSchema>

export const subtypeInputObject = {
    __kind: z.literal('SubtypeInput'),
    id: z.string(),
    label: z.string(),
} satisfies Properties<SubtypeInput>

export const SubtypeInputSchema = z.object(subtypeInputObject)

export type SubtypeInputInfer = z.infer<typeof SubtypeInputSchema>

export const classProficiencyInputObject = {
    __kind: z.literal('ClassProficiencyInput'),
    id: z.string(),
    subtype: z.string().nullish(),
    attributes: z.array(z.string()).nullish(),
    selectionCount: z.number().int().nullish(),
    category: z.string(),
    level: z.string(),
    rounding: z.string().nullish(),
    saveAbilities: z.array(z.string()).nullish(),
    skills: z.array(z.string()).nullish(),
    languages: z.array(z.string()).nullish(),
    properties: ProficiencyPropertiesInputSchema.nullish(),
    equipment: ProficiencyPropertiesInputSchema.nullish(),
    prerequisites: PrerequisiteInputSchema.nullish(),
} satisfies Properties<ClassProficiencyInput>

export const ClassProficiencyInputSchema = z.object(classProficiencyInputObject)

export type ClassProficiencyInputInfer = z.infer<typeof ClassProficiencyInputSchema>

export const classInputObject = {
    __kind: z.literal('ClassInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    category: z.string(),
    attributes: z.array(z.string()).nullish(),
    details: z.array(DetailInputSchema).nullish(),
    hitpoint: HitpointInputSchema.nullish(),
    startingGold: StartingGoldInputSchema.nullish(),
    equipment: z.array(z.array(z.array(EquipmentOptionItemInputSchema))).nullish(),
    proficiencies: z.array(ClassProficiencyInputSchema).nullish(),
    spellcasting: SpellcastingInputSchema.nullish(),
    levelAttributes: z.array(LevelAttributeInputSchema).nullish(),
    resource: ResourceInputSchema.nullish(),
    multiclass: MulticlassInputSchema.nullish(),
    parentClass: z.string().nullish(),
    subtypes: z.array(SubtypeInputSchema).nullish(),
    features: z.array(z.string()).nullish(),
    ownerId: z.string().nullish(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<ClassInput>

export const ClassInputSchema = z.object(classInputObject)

export type ClassInputInfer = z.infer<typeof ClassInputSchema>

export const characterModifierInputObject = {
    __kind: z.literal('CharacterModifierInput'),
    id: z.string(),
    featureId: z.string().nullish(),
    classId: z.string().nullish(),
    raceId: z.string().nullish(),
    ancestryId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    featId: z.string().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    featureLevel: z.number().int().nullish(),
} satisfies Properties<CharacterModifierInput>

export const CharacterModifierInputSchema = z.object(characterModifierInputObject)

export type CharacterModifierInputInfer = z.infer<typeof CharacterModifierInputSchema>

export const characterSenseInputObject = {
    __kind: z.literal('CharacterSenseInput'),
    id: z.string(),
    senseId: z.string().nullish(),
    featureId: z.string().nullish(),
    classId: z.string().nullish(),
    raceId: z.string().nullish(),
    ancestryId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    featId: z.string().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    featureLevel: z.number().int().nullish(),
} satisfies Properties<CharacterSenseInput>

export const CharacterSenseInputSchema = z.object(characterSenseInputObject)

export type CharacterSenseInputInfer = z.infer<typeof CharacterSenseInputSchema>

export const characterFeatInputObject = {
    __kind: z.literal('CharacterFeatInput'),
    id: z.string().nullish(),
    featId: z.string().nullish(),
    featureId: z.string().nullish(),
    classId: z.string().nullish(),
    raceId: z.string().nullish(),
    ancestryId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    featureLevel: z.number().int().nullish(),
} satisfies Properties<CharacterFeatInput>

export const CharacterFeatInputSchema = z.object(characterFeatInputObject)

export type CharacterFeatInputInfer = z.infer<typeof CharacterFeatInputSchema>

export const characterProficiencyInputObject = {
    __kind: z.literal('CharacterProficiencyInput'),
    skill: z.string().nullish(),
    language: z.string().nullish(),
    saveAbility: z.string().nullish(),
    property: z.string().nullish(),
    equipment: z.string().nullish(),
    id: z.string(),
    featureId: z.string().nullish(),
    classId: z.string().nullish(),
    raceId: z.string().nullish(),
    ancestryId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    featId: z.string().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    featureLevel: z.number().int().nullish(),
} satisfies Properties<CharacterProficiencyInput>

export const CharacterProficiencyInputSchema = z.object(characterProficiencyInputObject)

export type CharacterProficiencyInputInfer = z.infer<typeof CharacterProficiencyInputSchema>

export const characterExpertiseInputObject = {
    __kind: z.literal('CharacterExpertiseInput'),
    skill: z.string().nullish(),
    language: z.string().nullish(),
    saveAbility: z.string().nullish(),
    property: z.string().nullish(),
    equipment: z.string().nullish(),
    id: z.string(),
    featureId: z.string().nullish(),
    classId: z.string().nullish(),
    raceId: z.string().nullish(),
    ancestryId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    featId: z.string().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    featureLevel: z.number().int().nullish(),
} satisfies Properties<CharacterExpertiseInput>

export const CharacterExpertiseInputSchema = z.object(characterExpertiseInputObject)

export type CharacterExpertiseInputInfer = z.infer<typeof CharacterExpertiseInputSchema>

export const characterSpellInputObject = {
    __kind: z.literal('CharacterSpellInput'),
    id: z.string(),
    level: z.number().int(),
    saveAbility: z.string().nullish(),
    isRitual: z.boolean().nullish(),
    countAsKnown: z.boolean().nullish(),
    usesSlot: z.boolean().nullish(),
    alwaysPrepared: z.boolean().nullish(),
    castAtLevel: z.boolean().nullish(),
    requiresConcentration: z.boolean().nullish(),
    optionalAbility: z.boolean().nullish(),
    featureId: z.string().nullish(),
    classId: z.string().nullish(),
    raceId: z.string().nullish(),
    ancestryId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    featId: z.string().nullish(),
    optionId: z.string().nullish(),
    optionIndex: z.string().nullish(),
    featureLevel: z.number().int().nullish(),
} satisfies Properties<CharacterSpellInput>

export const CharacterSpellInputSchema = z.object(characterSpellInputObject)

export type CharacterSpellInputInfer = z.infer<typeof CharacterSpellInputSchema>

export const characterFeatureOptionInputObject = {
    __kind: z.literal('CharacterFeatureOptionInput'),
    id: z.string(),
    optionIndex: z.string(),
    featureLevel: z.number().int(),
} satisfies Properties<CharacterFeatureOptionInput>

export const CharacterFeatureOptionInputSchema = z.object(characterFeatureOptionInputObject)

export type CharacterFeatureOptionInputInfer = z.infer<typeof CharacterFeatureOptionInputSchema>

export const characterFeatureInputObject = {
    __kind: z.literal('CharacterFeatureInput'),
    id: z.string().nullish(),
    options: z.array(CharacterFeatureOptionInputSchema).nullish(),
    classId: z.string().nullish(),
    raceId: z.string().nullish(),
    ancestryId: z.string().nullish(),
    equipmentId: z.string().nullish(),
    backgroundId: z.string().nullish(),
    featId: z.string().nullish(),
    level: z.number().int().nullish(),
} satisfies Properties<CharacterFeatureInput>

export const CharacterFeatureInputSchema = z.object(characterFeatureInputObject)

export type CharacterFeatureInputInfer = z.infer<typeof CharacterFeatureInputSchema>

export const rollInputObject = {
    __kind: z.literal('RollInput'),
    die: z.number().int(),
    value: z.number().int(),
    id: z.string().nullish(),
} satisfies Properties<RollInput>

export const RollInputSchema = z.object(rollInputObject)

export type RollInputInfer = z.infer<typeof RollInputSchema>

export const rollTypeInputObject = {
    __kind: z.literal('RollTypeInput'),
    score: z.number().int(),
    ability: z.string(),
    rolling: z.boolean(),
    applied: z.boolean(),
    rolled: z.array(RollInputSchema),
    kept: z.array(RollInputSchema).nullish(),
} satisfies Properties<RollTypeInput>

export const RollTypeInputSchema = z.object(rollTypeInputObject)

export type RollTypeInputInfer = z.infer<typeof RollTypeInputSchema>

export const manualInputObject = {
    __kind: z.literal('ManualInput'),
    ability: z.string().nullish(),
    score: z.number().int().nullish(),
} satisfies Properties<ManualInput>

export const ManualInputSchema = z.object(manualInputObject)

export type ManualInputInfer = z.infer<typeof ManualInputSchema>

export const manualRolledInputObject = {
    __kind: z.literal('ManualRolledInput'),
    configuration: z.string(),
    rollGroups: z.array(z.array(RollTypeInputSchema)).nullish(),
    manual: z.array(ManualInputSchema).nullish(),
} satisfies Properties<ManualRolledInput>

export const ManualRolledInputSchema = z.object(manualRolledInputObject)

export type ManualRolledInputInfer = z.infer<typeof ManualRolledInputSchema>

export const distributedInputObject = {
    __kind: z.literal('DistributedInput'),
    ability: z.string(),
    id: z.string(),
} satisfies Properties<DistributedInput>

export const DistributedInputSchema = z.object(distributedInputObject)

export type DistributedInputInfer = z.infer<typeof DistributedInputSchema>

export const pointBuyInputObject = {
    __kind: z.literal('PointBuyInput'),
    pointsLeft: z.number().int().nullish(),
    distributed: z.array(DistributedInputSchema).nullish(),
} satisfies Properties<PointBuyInput>

export const PointBuyInputSchema = z.object(pointBuyInputObject)

export type PointBuyInputInfer = z.infer<typeof PointBuyInputSchema>

export const standardArrayInputObject = {
    __kind: z.literal('StandardArrayInput'),
    ability: z.string().nullish(),
    score: z.string().nullish(),
} satisfies Properties<StandardArrayInput>

export const StandardArrayInputSchema = z.object(standardArrayInputObject)

export type StandardArrayInputInfer = z.infer<typeof StandardArrayInputSchema>

export const scoresInputObject = {
    __kind: z.literal('ScoresInput'),
    ability: z.string(),
    baseScore: z.number().int().nullish(),
    raceScore: z.number().int().nullish(),
    classScore: z.number().int().nullish(),
    calculatedScore: z.number().int().nullish(),
    modifierScore: z.number().int().nullish(),
} satisfies Properties<ScoresInput>

export const ScoresInputSchema = z.object(scoresInputObject)

export type ScoresInputInfer = z.infer<typeof ScoresInputSchema>

export const characterAbilitiesInputObject = {
    __kind: z.literal('CharacterAbilitiesInput'),
    manualRolled: ManualRolledInputSchema.nullish(),
    pointBuy: PointBuyInputSchema.nullish(),
    standardArray: z.array(StandardArrayInputSchema).nullish(),
    selectedSystem: z.string().nullish(),
    scores: z.array(ScoresInputSchema).nullish(),
} satisfies Properties<CharacterAbilitiesInput>

export const CharacterAbilitiesInputSchema = z.object(characterAbilitiesInputObject)

export type CharacterAbilitiesInputInfer = z.infer<typeof CharacterAbilitiesInputSchema>

export const lineageInputObject = {
    __kind: z.literal('LineageInput'),
    id: z.string().nullish(),
    raceId: z.string().nullish(),
} satisfies Properties<LineageInput>

export const LineageInputSchema = z.object(lineageInputObject)

export type LineageInputInfer = z.infer<typeof LineageInputSchema>

export const characterAncestryInputObject = {
    __kind: z.literal('CharacterAncestryInput'),
    id: z.string().nullish(),
    raceId: z.string().nullish(),
    lineage: z.array(LineageInputSchema).nullish(),
} satisfies Properties<CharacterAncestryInput>

export const CharacterAncestryInputSchema = z.object(characterAncestryInputObject)

export type CharacterAncestryInputInfer = z.infer<typeof CharacterAncestryInputSchema>

export const subclassInputObject = {
    __kind: z.literal('SubclassInput'),
    id: z.string().nullish(),
    subtype: z.string().nullish(),
} satisfies Properties<SubclassInput>

export const SubclassInputSchema = z.object(subclassInputObject)

export type SubclassInputInfer = z.infer<typeof SubclassInputSchema>

export const classSpellInputObject = {
    __kind: z.literal('ClassSpellInput'),
    id: z.string(),
    classId: z.string().nullish(),
    ability: z.string().nullish(),
    isRitual: z.boolean().nullish(),
    countAsKnown: z.boolean().nullish(),
    usesSlot: z.boolean().nullish(),
    alwaysPrepared: z.boolean().nullish(),
    castAtLevel: z.boolean().nullish(),
    requiresConcentration: z.boolean().nullish(),
    optionalAbility: z.boolean().nullish(),
} satisfies Properties<ClassSpellInput>

export const ClassSpellInputSchema = z.object(classSpellInputObject)

export type ClassSpellInputInfer = z.infer<typeof ClassSpellInputSchema>

export const classSpellListInputObject = {
    __kind: z.literal('ClassSpellListInput'),
    level: z.number().int(),
    spells: z.array(ClassSpellInputSchema).nullish(),
} satisfies Properties<ClassSpellListInput>

export const ClassSpellListInputSchema = z.object(classSpellListInputObject)

export type ClassSpellListInputInfer = z.infer<typeof ClassSpellListInputSchema>

export const characterSpellSlotsInputObject = {
    __kind: z.literal('CharacterSpellSlotsInput'),
    level: z.number().int(),
    used: z.number().int(),
    classId: z.string(),
} satisfies Properties<CharacterSpellSlotsInput>

export const CharacterSpellSlotsInputSchema = z.object(characterSpellSlotsInputObject)

export type CharacterSpellSlotsInputInfer = z.infer<typeof CharacterSpellSlotsInputSchema>

export const characterSpellcastingInputObject = {
    __kind: z.literal('CharacterSpellcastingInput'),
    prepared: z.array(ClassSpellListInputSchema).nullish(),
    known: z.array(ClassSpellListInputSchema).nullish(),
    additional: z.array(CharacterSpellInputSchema).nullish(),
    spellSlots: z.array(CharacterSpellSlotsInputSchema).nullish(),
} satisfies Properties<CharacterSpellcastingInput>

export const CharacterSpellcastingInputSchema = z.object(characterSpellcastingInputObject)

export type CharacterSpellcastingInputInfer = z.infer<typeof CharacterSpellcastingInputSchema>

export const characterClassInputObject = {
    __kind: z.literal('CharacterClassInput'),
    id: z.string(),
    subclass: SubclassInputSchema.nullish(),
    level: z.number().int(),
} satisfies Properties<CharacterClassInput>

export const CharacterClassInputSchema = z.object(characterClassInputObject)

export type CharacterClassInputInfer = z.infer<typeof CharacterClassInputSchema>

export const startingEquipmentInputObject = {
    __kind: z.literal('StartingEquipmentInput'),
    id: z.string(),
    selectionId: z.string().nullish(),
    quantity: z.number().int(),
} satisfies Properties<StartingEquipmentInput>

export const StartingEquipmentInputSchema = z.object(startingEquipmentInputObject)

export type StartingEquipmentInputInfer = z.infer<typeof StartingEquipmentInputSchema>

export const startingEquipmentGroupInputObject = {
    __kind: z.literal('StartingEquipmentGroupInput'),
    optionId: z.string(),
    groupId: z.string(),
    equipment: z.array(StartingEquipmentInputSchema).nullish(),
} satisfies Properties<StartingEquipmentGroupInput>

export const StartingEquipmentGroupInputSchema = z.object(startingEquipmentGroupInputObject)

export type StartingEquipmentGroupInputInfer = z.infer<typeof StartingEquipmentGroupInputSchema>

export const classStartingEquipmentInputObject = {
    __kind: z.literal('ClassStartingEquipmentInput'),
    option: z.string(),
    goldOption: z.string().nullish(),
    totalGold: z.number().int().nullish(),
    equipmentGroups: z.array(StartingEquipmentGroupInputSchema).nullish(),
    addedToCharacter: z.boolean().nullish(),
} satisfies Properties<ClassStartingEquipmentInput>

export const ClassStartingEquipmentInputSchema = z.object(classStartingEquipmentInputObject)

export type ClassStartingEquipmentInputInfer = z.infer<typeof ClassStartingEquipmentInputSchema>

export const backgroundStartingEquipmentInputObject = {
    __kind: z.literal('BackgroundStartingEquipmentInput'),
    equipmentGroups: z.array(StartingEquipmentGroupInputSchema).nullish(),
    addedToCharacter: z.boolean().nullish(),
} satisfies Properties<BackgroundStartingEquipmentInput>

export const BackgroundStartingEquipmentInputSchema = z.object(backgroundStartingEquipmentInputObject)

export type BackgroundStartingEquipmentInputInfer = z.infer<typeof BackgroundStartingEquipmentInputSchema>

export const possessionsInputObject = {
    __kind: z.literal('PossessionsInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
} satisfies Properties<PossessionsInput>

export const PossessionsInputSchema = z.object(possessionsInputObject)

export type PossessionsInputInfer = z.infer<typeof PossessionsInputSchema>

export const characterCurrencyInputObject = {
    __kind: z.literal('CharacterCurrencyInput'),
    id: z.string(),
    amount: z.number().int(),
} satisfies Properties<CharacterCurrencyInput>

export const CharacterCurrencyInputSchema = z.object(characterCurrencyInputObject)

export type CharacterCurrencyInputInfer = z.infer<typeof CharacterCurrencyInputSchema>

export const currencyGroupInputObject = {
    __kind: z.literal('CurrencyGroupInput'),
    currencies: z.array(CharacterCurrencyInputSchema).nullish(),
    container: z.string().nullish(),
} satisfies Properties<CurrencyGroupInput>

export const CurrencyGroupInputSchema = z.object(currencyGroupInputObject)

export type CurrencyGroupInputInfer = z.infer<typeof CurrencyGroupInputSchema>

export const hitpointRollValuesInputObject = {
    __kind: z.literal('HitpointRollValuesInput'),
    level: z.number().int(),
    value: z.number().int(),
} satisfies Properties<HitpointRollValuesInput>

export const HitpointRollValuesInputSchema = z.object(hitpointRollValuesInputObject)

export type HitpointRollValuesInputInfer = z.infer<typeof HitpointRollValuesInputSchema>

export const hitpointRollInputObject = {
    __kind: z.literal('HitpointRollInput'),
    values: z.array(HitpointRollValuesInputSchema).nullish(),
    total: z.number().int().nullish(),
    current: z.number().int().nullish(),
} satisfies Properties<HitpointRollInput>

export const HitpointRollInputSchema = z.object(hitpointRollInputObject)

export type HitpointRollInputInfer = z.infer<typeof HitpointRollInputSchema>

export const hitpointFixedInputObject = {
    __kind: z.literal('HitpointFixedInput'),
    current: z.number().int().nullish(),
    total: z.number().int().nullish(),
} satisfies Properties<HitpointFixedInput>

export const HitpointFixedInputSchema = z.object(hitpointFixedInputObject)

export type HitpointFixedInputInfer = z.infer<typeof HitpointFixedInputSchema>

export const characterHitpointInputObject = {
    __kind: z.literal('CharacterHitpointInput'),
    method: z.string(),
    maxOverride: z.number().int().nullish(),
    maxHitpoints: z.number().int().nullish(),
    temp: z.number().int().nullish(),
    bonus: z.number().int().nullish(),
    rolled: HitpointRollInputSchema.nullish(),
    fixed: HitpointFixedInputSchema.nullish(),
} satisfies Properties<CharacterHitpointInput>

export const CharacterHitpointInputSchema = z.object(characterHitpointInputObject)

export type CharacterHitpointInputInfer = z.infer<typeof CharacterHitpointInputSchema>

export const characterEquipmentObjectInputObject = {
    __kind: z.literal('CharacterEquipmentObjectInput'),
    id: z.string(),
    equipmentId: z.string(),
    quantity: z.number().int(),
    containerId: z.string().nullish(),
    containerPath: z.string().nullish(),
    customName: z.string().nullish(),
    notes: z.string().nullish(),
} satisfies Properties<CharacterEquipmentObjectInput>

export const CharacterEquipmentObjectInputSchema = z.object(characterEquipmentObjectInputObject)

export type CharacterEquipmentObjectInputInfer = z.infer<typeof CharacterEquipmentObjectInputSchema>

export const characterEquipmentInputObject = {
    __kind: z.literal('CharacterEquipmentInput'),
    equipped: z.array(z.string()).nullish(),
    attuned: z.array(z.string()).nullish(),
    inventory: z.array(CharacterEquipmentObjectInputSchema).nullish(),
} satisfies Properties<CharacterEquipmentInput>

export const CharacterEquipmentInputSchema = z.object(characterEquipmentInputObject)

export type CharacterEquipmentInputInfer = z.infer<typeof CharacterEquipmentInputSchema>

export const characterInputObject = {
    __kind: z.literal('CharacterInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    advancement: z.string().nullish(),
    exp: z.number().int().nullish(),
    hitpoint: CharacterHitpointInputSchema.nullish(),
    abilities: CharacterAbilitiesInputSchema.nullish(),
    race: z.string().nullish(),
    ancestry: CharacterAncestryInputSchema.nullish(),
    background: z.string().nullish(),
    classes: z.array(CharacterClassInputSchema).nullish(),
    spellcasting: CharacterSpellcastingInputSchema.nullish(),
    classEquipment: ClassStartingEquipmentInputSchema.nullish(),
    backgroundEquipment: BackgroundStartingEquipmentInputSchema.nullish(),
    equipment: CharacterEquipmentInputSchema,
    currencyGroups: z.array(CurrencyGroupInputSchema).nullish(),
    features: z.array(CharacterFeatureInputSchema).nullish(),
    feats: z.array(CharacterFeatInputSchema).nullish(),
    proficiencies: z.array(CharacterProficiencyInputSchema).nullish(),
    expertise: z.array(CharacterExpertiseInputSchema).nullish(),
    modifiers: z.array(CharacterModifierInputSchema).nullish(),
    senses: z.array(CharacterSenseInputSchema).nullish(),
    ownerId: z.string().nullish(),
    systemId: z.string(),
} satisfies Properties<CharacterInput>

export const CharacterInputSchema = z.object(characterInputObject)

export type CharacterInputInfer = z.infer<typeof CharacterInputSchema>

export const backgroundInputObject = {
    __kind: z.literal('BackgroundInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    details: z.array(DetailInputSchema).nullish(),
    equipment: z.array(z.array(z.array(EquipmentOptionItemInputSchema))).nullish(),
    proficiencies: z.array(FeatureProficiencyInputSchema).nullish(),
    features: z.array(z.string()).nullish(),
    ownerId: z.string().nullish(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<BackgroundInput>

export const BackgroundInputSchema = z.object(backgroundInputObject)

export type BackgroundInputInfer = z.infer<typeof BackgroundInputSchema>

export const ancestryOptionInputObject = {
    __kind: z.literal('AncestryOptionInput'),
    id: z.string(),
    label: z.string(),
    desc: z.string().nullish(),
    features: z.array(z.string()).nullish(),
    ownerId: z.string(),
    systemId: z.string(),
    masterId: z.string().nullish(),
} satisfies Properties<AncestryOptionInput>

export const AncestryOptionInputSchema = z.object(ancestryOptionInputObject)

export type AncestryOptionInputInfer = z.infer<typeof AncestryOptionInputSchema>

