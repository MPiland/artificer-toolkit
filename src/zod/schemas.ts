import { z } from 'zod/v4'
import { GenericTypeInput, CurrencyConversionInput, CurrencyInput, EquipmentCategoryPropertyInput, SystemEquipmentInput, ModifierCategoryTypeInput, ModifierTypeMethodInput, ModifierCategoryTypeMethodInput, SystemModifiersInput, ProficiencyLevelInput, SystemProficiencyInput, SystemSpellInput, GenerateOptionInput, ImperialInput, SystemMeasurementInput, AbilityGenerateMethodInput, SystemRulesInput, ChargeOptionInput, SystemChargesInput, CharacterSettingInput, SystemActionInput, SystemAttributeInput, SystemCategoryInput, SystemSenseInput, SystemSkillInput, SystemPrerequisiteInput, SystemInput, UpcastFieldsInput, SetPerLevelInput, DamagePoolInput, DamageFieldsInput, DiePerLevelInput, DamageInput, UpcastLevelInput, UpcastInput, ShapeInput, RangeInput, DurationInput, ActionPropertyInput, ActionGroupInput, SaveAbilityInput, SpellInput, UsesPerLevelInput, ChargeInput, EquipPrerequisiteInput, AbilityScoreInput, PrerequisiteInput, AncestryFeatureInput, AncestryOptionInput, AncestryInput, RaceSpeedInput, DetailInput, TraitsInput, OptionsByLevelInput, FeatureInput, RaceInput, ProficiencyPropertiesInput, SpellsByLevelInput, FeatureSpellInput, FeatureSenseInput, FeatureProficiencyInput, FeatureOptionInput, ModifierDiePerLevelInput, ModifierSetPerLevelInput, FeatureModifierInput, FeatureFeatInput, FeatureExpertiseInput, FeatInput, SpeedInput, WeightInput, CapacityInput, CostInput, ContainsInput, EquipmentRangeInput, EquipmentInput, HitpointInput, StartingGoldInput, PrepareLimitLevelInput, PrepareLimitInput, SpellcastingInput, SpellSlotInput, LevelAttributeInput, ResourceInput, MulticlassAbilityInput, MulticlassInput, SubtypeInput, ClassCurrencyInput, ClassEquipmentInput, ClassInput, CharacterModifierInput, CharacterSenseInput, CharacterFeatInput, CharacterProficiencyInput, CharacterExpertiseInput, CharacterSpellInput, CharacterFeatureOptionInput, CharacterFeatureInput, RollInput, RollTypeInput, ManualInput, ManualRolledInput, DistributedInput, PointBuyInput, StandardArrayInput, ScoresInput, CharacterAbilitiesInput, LineageInput, CharacterAncestryInput, SubclassInput, ClassSpellInput, ClassSpellListInput, CharacterSpellSlotsInput, CharacterSpellcastingInput, CharacterClassInput, StartingEquipmentInput, StartingEquipmentGroupInput, ClassStartingEquipmentInput, BackgroundStartingEquipmentInput, PossessionsInput, CharacterCurrencyInput, CurrencyGroupInput, HitpointRollValuesInput, HitpointRollInput, HitpointFixedInput, CharacterHitpointInput, CharacterEquipmentObjectInput, CharacterEquipmentInput, CharacterInput, BackgroundCurrencyInput, BackgroundEquipmentInput, BackgroundInput, FEATURE_ENUM_INPUT, DAMAGE_ENUM_INPUT, SPELL_ENUM_INPUT, FEAT_ENUM_INPUT, SECTION_ENUM_INPUT, EQUIPMENT_ENUM_INPUT, CLASSES_ENUM_INPUT } from '@/types'

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>
}>

export const genericTypeInputObject = {
    __kind: z.literal('GenericTypeInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    tooltip: z.string().optional(),
    short: z.string().optional(),
} satisfies Properties<GenericTypeInput>

export const GenericTypeInputSchema = z.object(genericTypeInputObject)

export type GenericTypeInputInfer = z.infer<typeof GenericTypeInputSchema>

export const currencyConversionInputObject = {
    __kind: z.literal('CurrencyConversionInput'),
    copper: z.number().default(0),
    silver: z.number().default(0),
    gold: z.number().default(0),
    electrum: z.number().default(0),
    platinum: z.number().default(0),
} satisfies Properties<CurrencyConversionInput>

export const CurrencyConversionInputSchema = z.object(currencyConversionInputObject)

export type CurrencyConversionInputInfer = z.infer<typeof CurrencyConversionInputSchema>

export const currencyInputObject = {
    __kind: z.literal('CurrencyInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    abbreviation: z.string().default(""),
    conversions: CurrencyConversionInputSchema.default(CurrencyConversionInputSchema.parse({})),
} satisfies Properties<CurrencyInput>

export const CurrencyInputSchema = z.object(currencyInputObject)

export type CurrencyInputInfer = z.infer<typeof CurrencyInputSchema>

export const equipmentCategoryPropertyInputObject = {
    __kind: z.literal('EquipmentCategoryPropertyInput'),
    id: z.string().default(""),
    propertyId: z.string().default(""),
    categoryId: z.string().default(""),
} satisfies Properties<EquipmentCategoryPropertyInput>

export const EquipmentCategoryPropertyInputSchema = z.object(equipmentCategoryPropertyInputObject)

export type EquipmentCategoryPropertyInputInfer = z.infer<typeof EquipmentCategoryPropertyInputSchema>

export const systemEquipmentInputObject = {
    __kind: z.literal('SystemEquipmentInput'),
    categories: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    properties: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    categoryProperties: z.array(EquipmentCategoryPropertyInputSchema).default(() => [EquipmentCategoryPropertyInputSchema.parse({})]),
    rarities: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
} satisfies Properties<SystemEquipmentInput>

export const SystemEquipmentInputSchema = z.object(systemEquipmentInputObject)

export type SystemEquipmentInputInfer = z.infer<typeof SystemEquipmentInputSchema>

export const modifierCategoryTypeInputObject = {
    __kind: z.literal('ModifierCategoryTypeInput'),
    id: z.string().default(""),
    typeId: z.string().default(""),
    categoryId: z.string().default(""),
} satisfies Properties<ModifierCategoryTypeInput>

export const ModifierCategoryTypeInputSchema = z.object(modifierCategoryTypeInputObject)

export type ModifierCategoryTypeInputInfer = z.infer<typeof ModifierCategoryTypeInputSchema>

export const modifierTypeMethodInputObject = {
    __kind: z.literal('ModifierTypeMethodInput'),
    id: z.string().default(""),
    typeId: z.string().default(""),
    methodId: z.string().default(""),
} satisfies Properties<ModifierTypeMethodInput>

export const ModifierTypeMethodInputSchema = z.object(modifierTypeMethodInputObject)

export type ModifierTypeMethodInputInfer = z.infer<typeof ModifierTypeMethodInputSchema>

export const modifierCategoryTypeMethodInputObject = {
    __kind: z.literal('ModifierCategoryTypeMethodInput'),
    id: z.string().default(""),
    methodId: z.string().default(""),
    typeId: z.string().default(""),
    categoryId: z.string().default(""),
} satisfies Properties<ModifierCategoryTypeMethodInput>

export const ModifierCategoryTypeMethodInputSchema = z.object(modifierCategoryTypeMethodInputObject)

export type ModifierCategoryTypeMethodInputInfer = z.infer<typeof ModifierCategoryTypeMethodInputSchema>

export const systemModifiersInputObject = {
    __kind: z.literal('SystemModifiersInput'),
    categories: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    types: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    methods: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    spellCategories: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    categoryTypes: z.array(ModifierCategoryTypeInputSchema).default(() => [ModifierCategoryTypeInputSchema.parse({})]),
    typeMethods: z.array(ModifierTypeMethodInputSchema).default(() => [ModifierTypeMethodInputSchema.parse({})]),
    categoryMethods: z.array(ModifierCategoryTypeMethodInputSchema).default(() => [ModifierCategoryTypeMethodInputSchema.parse({})]),
} satisfies Properties<SystemModifiersInput>

export const SystemModifiersInputSchema = z.object(systemModifiersInputObject)

export type SystemModifiersInputInfer = z.infer<typeof SystemModifiersInputSchema>

export const proficiencyLevelInputObject = {
    __kind: z.literal('ProficiencyLevelInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    multiplier: z.number().optional(),
} satisfies Properties<ProficiencyLevelInput>

export const ProficiencyLevelInputSchema = z.object(proficiencyLevelInputObject)

export type ProficiencyLevelInputInfer = z.infer<typeof ProficiencyLevelInputSchema>

export const systemProficiencyInputObject = {
    __kind: z.literal('SystemProficiencyInput'),
    levels: z.array(ProficiencyLevelInputSchema).default(() => [ProficiencyLevelInputSchema.parse({})]),
    categories: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
} satisfies Properties<SystemProficiencyInput>

export const SystemProficiencyInputSchema = z.object(systemProficiencyInputObject)

export type SystemProficiencyInputInfer = z.infer<typeof SystemProficiencyInputSchema>

export const systemSpellInputObject = {
    __kind: z.literal('SystemSpellInput'),
    categories: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    durations: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    ranges: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    schools: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    shapes: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    requirements: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
} satisfies Properties<SystemSpellInput>

export const SystemSpellInputSchema = z.object(systemSpellInputObject)

export type SystemSpellInputInfer = z.infer<typeof SystemSpellInputSchema>

export const generateOptionInputObject = {
    __kind: z.literal('GenerateOptionInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    reduce: z.number().int().optional(),
} satisfies Properties<GenerateOptionInput>

export const GenerateOptionInputSchema = z.object(generateOptionInputObject)

export type GenerateOptionInputInfer = z.infer<typeof GenerateOptionInputSchema>

export const imperialInputObject = {
    __kind: z.literal('ImperialInput'),
    weight: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    volume: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    length: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
} satisfies Properties<ImperialInput>

export const ImperialInputSchema = z.object(imperialInputObject)

export type ImperialInputInfer = z.infer<typeof ImperialInputSchema>

export const systemMeasurementInputObject = {
    __kind: z.literal('SystemMeasurementInput'),
    amount: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    rounding: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    imperial: ImperialInputSchema.default(ImperialInputSchema.parse({})),
} satisfies Properties<SystemMeasurementInput>

export const SystemMeasurementInputSchema = z.object(systemMeasurementInputObject)

export type SystemMeasurementInputInfer = z.infer<typeof SystemMeasurementInputSchema>

export const abilityGenerateMethodInputObject = {
    __kind: z.literal('AbilityGenerateMethodInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    total: z.number().int().optional(),
    options: z.array(GenerateOptionInputSchema).optional(),
} satisfies Properties<AbilityGenerateMethodInput>

export const AbilityGenerateMethodInputSchema = z.object(abilityGenerateMethodInputObject)

export type AbilityGenerateMethodInputInfer = z.infer<typeof AbilityGenerateMethodInputSchema>

export const systemRulesInputObject = {
    __kind: z.literal('SystemRulesInput'),
    measurements: SystemMeasurementInputSchema.default(SystemMeasurementInputSchema.parse({})),
    abilityGenerateMethod: z.array(AbilityGenerateMethodInputSchema).default(() => [AbilityGenerateMethodInputSchema.parse({})]),
} satisfies Properties<SystemRulesInput>

export const SystemRulesInputSchema = z.object(systemRulesInputObject)

export type SystemRulesInputInfer = z.infer<typeof SystemRulesInputSchema>

export const chargeOptionInputObject = {
    __kind: z.literal('ChargeOptionInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    features: z.array(z.enum(FEATURE_ENUM_INPUT)).optional(),
    damage: z.array(z.enum(DAMAGE_ENUM_INPUT)).optional(),
    feats: z.array(z.enum(FEAT_ENUM_INPUT)).optional(),
    sections: z.array(z.enum(SECTION_ENUM_INPUT)).optional(),
    spells: z.array(z.enum(SPELL_ENUM_INPUT)).optional(),
    equipment: z.array(z.enum(EQUIPMENT_ENUM_INPUT)).optional(),
    classes: z.array(z.enum(CLASSES_ENUM_INPUT)).optional(),
} satisfies Properties<ChargeOptionInput>

export const ChargeOptionInputSchema = z.object(chargeOptionInputObject)

export type ChargeOptionInputInfer = z.infer<typeof ChargeOptionInputSchema>

export const systemChargesInputObject = {
    __kind: z.literal('SystemChargesInput'),
    resets: z.array(ChargeOptionInputSchema).default(() => [ChargeOptionInputSchema.parse({})]),
    limits: z.array(ChargeOptionInputSchema).default(() => [ChargeOptionInputSchema.parse({})]),
} satisfies Properties<SystemChargesInput>

export const SystemChargesInputSchema = z.object(systemChargesInputObject)

export type SystemChargesInputInfer = z.infer<typeof SystemChargesInputSchema>

export const characterSettingInputObject = {
    __kind: z.literal('CharacterSettingInput'),
    hitpointCalcMethods: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    advancementMethods: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    spellPointCalcMethods: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    startingEquipmentOptions: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
} satisfies Properties<CharacterSettingInput>

export const CharacterSettingInputSchema = z.object(characterSettingInputObject)

export type CharacterSettingInputInfer = z.infer<typeof CharacterSettingInputSchema>

export const systemActionInputObject = {
    __kind: z.literal('SystemActionInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    features: z.boolean().default(false),
    damage: z.boolean().default(false),
    feats: z.boolean().default(false),
    sections: z.boolean().default(false),
    spells: z.boolean().default(false),
    equipment: z.boolean().default(false),
    classes: z.boolean().default(false),
} satisfies Properties<SystemActionInput>

export const SystemActionInputSchema = z.object(systemActionInputObject)

export type SystemActionInputInfer = z.infer<typeof SystemActionInputSchema>

export const systemAttributeInputObject = {
    __kind: z.literal('SystemAttributeInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    features: z.array(z.enum(FEATURE_ENUM_INPUT)).optional(),
    damage: z.array(z.enum(DAMAGE_ENUM_INPUT)).optional(),
    feats: z.array(z.enum(FEAT_ENUM_INPUT)).optional(),
    sections: z.array(z.enum(SECTION_ENUM_INPUT)).optional(),
    spells: z.array(z.enum(SPELL_ENUM_INPUT)).optional(),
    equipment: z.array(z.enum(EQUIPMENT_ENUM_INPUT)).optional(),
    classes: z.array(z.enum(CLASSES_ENUM_INPUT)).optional(),
} satisfies Properties<SystemAttributeInput>

export const SystemAttributeInputSchema = z.object(systemAttributeInputObject)

export type SystemAttributeInputInfer = z.infer<typeof SystemAttributeInputSchema>

export const systemCategoryInputObject = {
    __kind: z.literal('SystemCategoryInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    features: z.boolean().default(false),
    classes: z.boolean().default(false),
    races: z.boolean().default(false),
} satisfies Properties<SystemCategoryInput>

export const SystemCategoryInputSchema = z.object(systemCategoryInputObject)

export type SystemCategoryInputInfer = z.infer<typeof SystemCategoryInputSchema>

export const systemSenseInputObject = {
    __kind: z.literal('SystemSenseInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    creatureDesc: z.string().optional(),
    monsterDesc: z.string().optional(),
    type: z.array(z.string().optional()).optional(),
} satisfies Properties<SystemSenseInput>

export const SystemSenseInputSchema = z.object(systemSenseInputObject)

export type SystemSenseInputInfer = z.infer<typeof SystemSenseInputSchema>

export const systemSkillInputObject = {
    __kind: z.literal('SystemSkillInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    abilityId: z.string().default(""),
} satisfies Properties<SystemSkillInput>

export const SystemSkillInputSchema = z.object(systemSkillInputObject)

export type SystemSkillInputInfer = z.infer<typeof SystemSkillInputSchema>

export const systemPrerequisiteInputObject = {
    __kind: z.literal('SystemPrerequisiteInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    features: z.array(z.enum(FEATURE_ENUM_INPUT)).optional(),
    damage: z.array(z.enum(DAMAGE_ENUM_INPUT)).optional(),
    feats: z.array(z.enum(FEAT_ENUM_INPUT)).optional(),
    sections: z.array(z.enum(SECTION_ENUM_INPUT)).optional(),
    spells: z.array(z.enum(SPELL_ENUM_INPUT)).optional(),
    equipment: z.array(z.enum(EQUIPMENT_ENUM_INPUT)).optional(),
    classes: z.array(z.enum(CLASSES_ENUM_INPUT)).optional(),
} satisfies Properties<SystemPrerequisiteInput>

export const SystemPrerequisiteInputSchema = z.object(systemPrerequisiteInputObject)

export type SystemPrerequisiteInputInfer = z.infer<typeof SystemPrerequisiteInputSchema>

export const systemInputObject = {
    __kind: z.literal('SystemInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    abilities: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    actions: z.array(SystemActionInputSchema).default(() => [SystemActionInputSchema.parse({})]),
    alignments: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    attributes: z.array(SystemAttributeInputSchema).default(() => [SystemAttributeInputSchema.parse({})]),
    categories: z.array(SystemCategoryInputSchema).default(() => [SystemCategoryInputSchema.parse({})]),
    characters: CharacterSettingInputSchema.default(CharacterSettingInputSchema.parse({})),
    charges: SystemChargesInputSchema.default(SystemChargesInputSchema.parse({})),
    conditions: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    currencies: z.array(CurrencyInputSchema).default(() => [CurrencyInputSchema.parse({})]),
    damageTypes: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    equipment: SystemEquipmentInputSchema.default(SystemEquipmentInputSchema.parse({})),
    languages: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    modifiers: SystemModifiersInputSchema.default(SystemModifiersInputSchema.parse({})),
    passives: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    prerequisites: z.array(SystemPrerequisiteInputSchema).default(() => [SystemPrerequisiteInputSchema.parse({})]),
    proficiencies: SystemProficiencyInputSchema.default(SystemProficiencyInputSchema.parse({})),
    rules: SystemRulesInputSchema.default(SystemRulesInputSchema.parse({})),
    senses: z.array(SystemSenseInputSchema).default(() => [SystemSenseInputSchema.parse({})]),
    sizes: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    skills: z.array(SystemSkillInputSchema).default(() => [SystemSkillInputSchema.parse({})]),
    speeds: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    spells: SystemSpellInputSchema.default(SystemSpellInputSchema.parse({})),
    terrains: z.array(GenericTypeInputSchema).default(() => [GenericTypeInputSchema.parse({})]),
    ownerId: z.string().default(""),
    masterId: z.string().optional(),
} satisfies Properties<SystemInput>

export const SystemInputSchema = z.object(systemInputObject)

export type SystemInputInfer = z.infer<typeof SystemInputSchema>

export const upcastFieldsInputObject = {
    __kind: z.literal('UpcastFieldsInput'),
    id: z.string().optional(),
    size: z.number().optional(),
    unit: z.string().optional(),
    amount: z.number().int().optional(),
    minRange: z.number().int().optional(),
    maxRange: z.number().int().optional(),
    distance: z.number().int().optional(),
} satisfies Properties<UpcastFieldsInput>

export const UpcastFieldsInputSchema = z.object(upcastFieldsInputObject)

export type UpcastFieldsInputInfer = z.infer<typeof UpcastFieldsInputSchema>

export const setPerLevelInputObject = {
    __kind: z.literal('SetPerLevelInput'),
    level: z.string().optional(),
    primary: z.number().int().optional(),
    secondary: z.number().int().optional(),
    bonus: z.number().int().optional(),
} satisfies Properties<SetPerLevelInput>

export const SetPerLevelInputSchema = z.object(setPerLevelInputObject)

export type SetPerLevelInputInfer = z.infer<typeof SetPerLevelInputSchema>

export const damagePoolInputObject = {
    __kind: z.literal('DamagePoolInput'),
    attribute: z.string().optional(),
    setAmount: z.number().int().optional(),
    multiplier: z.number().int().optional(),
    minAmount: z.number().int().optional(),
    maxAmount: z.number().int().optional(),
    ability: z.string().optional(),
    option: z.string().optional(),
} satisfies Properties<DamagePoolInput>

export const DamagePoolInputSchema = z.object(damagePoolInputObject)

export type DamagePoolInputInfer = z.infer<typeof DamagePoolInputSchema>

export const damageFieldsInputObject = {
    __kind: z.literal('DamageFieldsInput'),
    dieConfig: z.string().optional(),
    attribute: z.string().optional(),
    id: z.string().optional(),
    ability: z.string().optional(),
    setAmount: z.number().int().optional(),
    multiplier: z.number().int().optional(),
    minAmount: z.number().int().optional(),
    maxAmount: z.number().int().optional(),
    pool: DamagePoolInputSchema.optional(),
} satisfies Properties<DamageFieldsInput>

export const DamageFieldsInputSchema = z.object(damageFieldsInputObject)

export type DamageFieldsInputInfer = z.infer<typeof DamageFieldsInputSchema>

export const diePerLevelInputObject = {
    __kind: z.literal('DiePerLevelInput'),
    level: z.string().optional(),
    primary: DamageFieldsInputSchema.optional(),
    secondary: DamageFieldsInputSchema.optional(),
    bonus: DamageFieldsInputSchema.optional(),
} satisfies Properties<DiePerLevelInput>

export const DiePerLevelInputSchema = z.object(diePerLevelInputObject)

export type DiePerLevelInputInfer = z.infer<typeof DiePerLevelInputSchema>

export const damageInputObject = {
    __kind: z.literal('DamageInput'),
    attributes: z.array(z.string()).optional(),
    damageSave: z.array(z.string()).optional(),
    setPerLevel: z.array(SetPerLevelInputSchema).optional(),
    diePerLevel: z.array(DiePerLevelInputSchema).optional(),
    primary: DamageFieldsInputSchema.optional(),
    secondary: DamageFieldsInputSchema.optional(),
    bonus: DamageFieldsInputSchema.optional(),
    versatile: DamageFieldsInputSchema.optional(),
} satisfies Properties<DamageInput>

export const DamageInputSchema = z.object(damageInputObject)

export type DamageInputInfer = z.infer<typeof DamageInputSchema>

export const upcastLevelInputObject = {
    __kind: z.literal('UpcastLevelInput'),
    level: z.number().int().optional(),
    damage: DamageInputSchema.optional(),
    duration: UpcastFieldsInputSchema.optional(),
    range: UpcastFieldsInputSchema.optional(),
    shape: UpcastFieldsInputSchema.optional(),
    targets: z.number().int().optional(),
} satisfies Properties<UpcastLevelInput>

export const UpcastLevelInputSchema = z.object(upcastLevelInputObject)

export type UpcastLevelInputInfer = z.infer<typeof UpcastLevelInputSchema>

export const upcastInputObject = {
    __kind: z.literal('UpcastInput'),
    attributes: z.array(z.string()).optional(),
    levels: z.array(UpcastLevelInputSchema.optional()).optional(),
} satisfies Properties<UpcastInput>

export const UpcastInputSchema = z.object(upcastInputObject)

export type UpcastInputInfer = z.infer<typeof UpcastInputSchema>

export const shapeInputObject = {
    __kind: z.literal('ShapeInput'),
    id: z.string().default(""),
    size: z.number().optional(),
    unit: z.string().optional(),
} satisfies Properties<ShapeInput>

export const ShapeInputSchema = z.object(shapeInputObject)

export type ShapeInputInfer = z.infer<typeof ShapeInputSchema>

export const rangeInputObject = {
    __kind: z.literal('RangeInput'),
    id: z.string().default(""),
    minRange: z.number().int().optional(),
    maxRange: z.number().int().optional(),
    distance: z.number().int().optional(),
    unit: z.string().optional(),
} satisfies Properties<RangeInput>

export const RangeInputSchema = z.object(rangeInputObject)

export type RangeInputInfer = z.infer<typeof RangeInputSchema>

export const durationInputObject = {
    __kind: z.literal('DurationInput'),
    id: z.string().default(""),
    amount: z.number().int().optional(),
} satisfies Properties<DurationInput>

export const DurationInputSchema = z.object(durationInputObject)

export type DurationInputInfer = z.infer<typeof DurationInputSchema>

export const actionPropertyInputObject = {
    __kind: z.literal('ActionPropertyInput'),
    id: z.string().optional(),
    amount: z.number().int().optional(),
} satisfies Properties<ActionPropertyInput>

export const ActionPropertyInputSchema = z.object(actionPropertyInputObject)

export type ActionPropertyInputInfer = z.infer<typeof ActionPropertyInputSchema>

export const actionGroupInputObject = {
    __kind: z.literal('ActionGroupInput'),
    primary: ActionPropertyInputSchema.optional(),
    secondary: ActionPropertyInputSchema.optional(),
} satisfies Properties<ActionGroupInput>

export const ActionGroupInputSchema = z.object(actionGroupInputObject)

export type ActionGroupInputInfer = z.infer<typeof ActionGroupInputSchema>

export const saveAbilityInputObject = {
    __kind: z.literal('SaveAbilityInput'),
    id: z.string().default(""),
    minAmount: z.number().int().optional(),
    attributes: z.array(z.string()).optional(),
    abilityModifier: z.string().optional(),
} satisfies Properties<SaveAbilityInput>

export const SaveAbilityInputSchema = z.object(saveAbilityInputObject)

export type SaveAbilityInputInfer = z.infer<typeof SaveAbilityInputSchema>

export const spellInputObject = {
    __kind: z.literal('SpellInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().default(""),
    level: z.number().int().default(0),
    school: z.string().default(""),
    classes: z.array(z.string()).default([""]),
    attributes: z.array(z.string()).optional(),
    upcast: UpcastInputSchema.optional(),
    actions: ActionGroupInputSchema.optional(),
    targets: z.number().int().optional(),
    saveAbility: SaveAbilityInputSchema.optional(),
    conditions: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional(),
    range: RangeInputSchema.default(RangeInputSchema.parse({})),
    shape: ShapeInputSchema.default(ShapeInputSchema.parse({})),
    duration: DurationInputSchema.default(DurationInputSchema.parse({})),
    damage: DamageInputSchema.optional(),
    materialDesc: z.string().optional(),
    ownerId: z.string().optional(),
    systemId: z.string().default(""),
    masterId: z.string().optional(),
} satisfies Properties<SpellInput>

export const SpellInputSchema = z.object(spellInputObject)

export type SpellInputInfer = z.infer<typeof SpellInputSchema>

export const usesPerLevelInputObject = {
    __kind: z.literal('UsesPerLevelInput'),
    level: z.number().int().optional(),
    uses: z.number().int().optional(),
} satisfies Properties<UsesPerLevelInput>

export const UsesPerLevelInputSchema = z.object(usesPerLevelInputObject)

export type UsesPerLevelInputInfer = z.infer<typeof UsesPerLevelInputSchema>

export const chargeInputObject = {
    __kind: z.literal('ChargeInput'),
    reset: z.string().optional(),
    limit: z.string().optional(),
    ability: z.string().optional(),
    skill: z.string().optional(),
    usesPerLevel: z.array(UsesPerLevelInputSchema.optional()).optional(),
    minAmount: z.number().int().optional(),
    addAmount: z.number().int().optional(),
    setAmount: z.number().int().optional(),
    multiplier: z.number().int().optional(),
    resourcePoints: z.number().int().optional(),
} satisfies Properties<ChargeInput>

export const ChargeInputSchema = z.object(chargeInputObject)

export type ChargeInputInfer = z.infer<typeof ChargeInputSchema>

export const equipPrerequisiteInputObject = {
    __kind: z.literal('EquipPrerequisiteInput'),
    numberEquipped: z.number().int().optional(),
    category: z.string().optional(),
    equipment: z.array(z.string()).optional(),
    properties: z.array(z.string()).optional(),
} satisfies Properties<EquipPrerequisiteInput>

export const EquipPrerequisiteInputSchema = z.object(equipPrerequisiteInputObject)

export type EquipPrerequisiteInputInfer = z.infer<typeof EquipPrerequisiteInputSchema>

export const abilityScoreInputObject = {
    __kind: z.literal('AbilityScoreInput'),
    abilities: z.array(z.string()).optional(),
    score: z.number().int().optional(),
} satisfies Properties<AbilityScoreInput>

export const AbilityScoreInputSchema = z.object(abilityScoreInputObject)

export type AbilityScoreInputInfer = z.infer<typeof AbilityScoreInputSchema>

export const prerequisiteInputObject = {
    __kind: z.literal('PrerequisiteInput'),
    options: z.array(z.string()).optional(),
    skillProficiencies: z.array(z.string()).optional(),
    equipmentProficiencies: z.array(EquipPrerequisiteInputSchema).optional(),
    equipped: z.array(EquipPrerequisiteInputSchema).optional(),
    notEquipped: z.array(EquipPrerequisiteInputSchema).optional(),
    abilityScore: AbilityScoreInputSchema.optional(),
    spellsObtained: z.array(z.string()).optional(),
    featuresObtained: z.array(z.string()).optional(),
    optionsObtained: z.array(z.string()).optional(),
    size: z.array(z.string()).optional(),
} satisfies Properties<PrerequisiteInput>

export const PrerequisiteInputSchema = z.object(prerequisiteInputObject)

export type PrerequisiteInputInfer = z.infer<typeof PrerequisiteInputSchema>

export const ancestryFeatureInputObject = {
    __kind: z.literal('AncestryFeatureInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    detail: z.string().optional(),
    category: z.string().optional(),
    attributes: z.array(z.string()).optional(),
    actions: ActionGroupInputSchema.optional(),
    damage: DamageInputSchema.optional(),
    charges: ChargeInputSchema.optional(),
    optionsByLevel: z.array(z.string()).optional(),
    range: RangeInputSchema.optional(),
    shape: ShapeInputSchema.optional(),
    targets: z.number().int().optional(),
    feats: z.array(z.string()).optional(),
    modifiers: z.array(z.string()).optional(),
    proficiencies: z.array(z.string()).optional(),
    expertise: z.array(z.string()).optional(),
    senses: z.array(z.string()).optional(),
    spells: z.array(z.string()).optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
    saveAbility: SaveAbilityInputSchema.optional(),
    levelAvailable: z.string().optional(),
    options: z.array(z.string()).optional(),
} satisfies Properties<AncestryFeatureInput>

export const AncestryFeatureInputSchema = z.object(ancestryFeatureInputObject)

export type AncestryFeatureInputInfer = z.infer<typeof AncestryFeatureInputSchema>

export const ancestryOptionInputObject = {
    __kind: z.literal('AncestryOptionInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    features: z.array(AncestryFeatureInputSchema).optional(),
} satisfies Properties<AncestryOptionInput>

export const AncestryOptionInputSchema = z.object(ancestryOptionInputObject)

export type AncestryOptionInputInfer = z.infer<typeof AncestryOptionInputSchema>

export const ancestryInputObject = {
    __kind: z.literal('AncestryInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    options: z.array(AncestryOptionInputSchema).default(() => [AncestryOptionInputSchema.parse({})]),
} satisfies Properties<AncestryInput>

export const AncestryInputSchema = z.object(ancestryInputObject)

export type AncestryInputInfer = z.infer<typeof AncestryInputSchema>

export const raceSpeedInputObject = {
    __kind: z.literal('RaceSpeedInput'),
    walking: z.number().int().optional(),
    swimming: z.number().int().optional(),
    flying: z.number().int().optional(),
    climbing: z.number().int().optional(),
} satisfies Properties<RaceSpeedInput>

export const RaceSpeedInputSchema = z.object(raceSpeedInputObject)

export type RaceSpeedInputInfer = z.infer<typeof RaceSpeedInputSchema>

export const detailInputObject = {
    __kind: z.literal('DetailInput'),
    label: z.string().default(""),
    desc: z.string().optional(),
} satisfies Properties<DetailInput>

export const DetailInputSchema = z.object(detailInputObject)

export type DetailInputInfer = z.infer<typeof DetailInputSchema>

export const traitsInputObject = {
    __kind: z.literal('TraitsInput'),
    details: z.array(DetailInputSchema).optional(),
    size: z.string().optional(),
    speeds: RaceSpeedInputSchema.optional(),
} satisfies Properties<TraitsInput>

export const TraitsInputSchema = z.object(traitsInputObject)

export type TraitsInputInfer = z.infer<typeof TraitsInputSchema>

export const optionsByLevelInputObject = {
    __kind: z.literal('OptionsByLevelInput'),
    level: z.number().int().optional(),
    count: z.number().int().optional(),
    replaceCount: z.number().int().optional(),
} satisfies Properties<OptionsByLevelInput>

export const OptionsByLevelInputSchema = z.object(optionsByLevelInputObject)

export type OptionsByLevelInputInfer = z.infer<typeof OptionsByLevelInputSchema>

export const featureInputObject = {
    __kind: z.literal('FeatureInput'),
    id: z.string().default(""),
    label: z.string().optional(),
    desc: z.string().optional(),
    detail: z.string().optional(),
    category: z.string().optional(),
    attributes: z.array(z.string()).optional(),
    actions: ActionGroupInputSchema.optional(),
    damage: DamageInputSchema.optional(),
    charges: ChargeInputSchema.optional(),
    optionsByLevel: z.array(OptionsByLevelInputSchema).optional(),
    range: RangeInputSchema.optional(),
    shape: ShapeInputSchema.optional(),
    targets: z.number().int().optional(),
    feats: z.array(z.string()).optional(),
    modifiers: z.array(z.string()).optional(),
    proficiencies: z.array(z.string()).optional(),
    expertise: z.array(z.string()).optional(),
    senses: z.array(z.string()).optional(),
    spells: z.array(z.string()).optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
    saveAbility: SaveAbilityInputSchema.optional(),
    levelAvailable: z.string().optional(),
    options: z.array(z.string()).optional(),
} satisfies Properties<FeatureInput>

export const FeatureInputSchema = z.object(featureInputObject)

export type FeatureInputInfer = z.infer<typeof FeatureInputSchema>

export const raceInputObject = {
    __kind: z.literal('RaceInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    quote: z.string().optional(),
    desc: z.string().optional(),
    playable: z.string().optional(),
    category: z.string().default(""),
    lineages: z.array(z.string()).optional(),
    ancestry: AncestryInputSchema.optional(),
    details: z.array(DetailInputSchema).optional(),
    traits: TraitsInputSchema.optional(),
    features: z.array(FeatureInputSchema).optional(),
    ownerId: z.string().optional(),
    systemId: z.string().default(""),
    masterId: z.string().optional(),
} satisfies Properties<RaceInput>

export const RaceInputSchema = z.object(raceInputObject)

export type RaceInputInfer = z.infer<typeof RaceInputSchema>

export const proficiencyPropertiesInputObject = {
    __kind: z.literal('ProficiencyPropertiesInput'),
    ids: z.array(z.string()).optional(),
    category: z.string().optional(),
    properties: z.array(z.string()).optional(),
} satisfies Properties<ProficiencyPropertiesInput>

export const ProficiencyPropertiesInputSchema = z.object(proficiencyPropertiesInputObject)

export type ProficiencyPropertiesInputInfer = z.infer<typeof ProficiencyPropertiesInputSchema>

export const spellsByLevelInputObject = {
    __kind: z.literal('SpellsByLevelInput'),
    id: z.string().default(""),
    spells: z.array(z.string()).optional(),
    level: z.number().int().optional(),
    spellLevel: z.number().int().optional(),
} satisfies Properties<SpellsByLevelInput>

export const SpellsByLevelInputSchema = z.object(spellsByLevelInputObject)

export type SpellsByLevelInputInfer = z.infer<typeof SpellsByLevelInputSchema>

export const featureSpellInputObject = {
    __kind: z.literal('FeatureSpellInput'),
    id: z.string().default(""),
    ids: z.array(z.string()).optional(),
    attributes: z.array(z.string()).optional(),
    selectionCount: z.number().int().optional(),
    classLimit: z.array(z.string()).optional(),
    levelLimit: z.array(z.string()).optional(),
    attributeLimit: z.array(z.string()).optional(),
    ability: z.string().optional(),
    spellLevel: z.number().int().optional(),
    spellsByLevel: z.array(SpellsByLevelInputSchema).optional(),
    subtype: z.string().optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
    charges: ChargeInputSchema.optional(),
} satisfies Properties<FeatureSpellInput>

export const FeatureSpellInputSchema = z.object(featureSpellInputObject)

export type FeatureSpellInputInfer = z.infer<typeof FeatureSpellInputSchema>

export const featureSenseInputObject = {
    __kind: z.literal('FeatureSenseInput'),
    id: z.string().default(""),
    attributes: z.array(z.string()).optional(),
    selectionCount: z.number().int().optional(),
    subtype: z.string().optional(),
    ids: z.array(z.string()).optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
    charges: ChargeInputSchema.optional(),
} satisfies Properties<FeatureSenseInput>

export const FeatureSenseInputSchema = z.object(featureSenseInputObject)

export type FeatureSenseInputInfer = z.infer<typeof FeatureSenseInputSchema>

export const featureProficiencyInputObject = {
    __kind: z.literal('FeatureProficiencyInput'),
    id: z.string().default(""),
    subtype: z.string().optional(),
    attributes: z.array(z.string()).optional(),
    selectionCount: z.number().int().optional(),
    category: z.string().default(""),
    level: z.string().optional(),
    rounding: z.string().optional(),
    saveAbilities: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    properties: ProficiencyPropertiesInputSchema.optional(),
    equipment: ProficiencyPropertiesInputSchema.optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
} satisfies Properties<FeatureProficiencyInput>

export const FeatureProficiencyInputSchema = z.object(featureProficiencyInputObject)

export type FeatureProficiencyInputInfer = z.infer<typeof FeatureProficiencyInputSchema>

export const featureOptionInputObject = {
    __kind: z.literal('FeatureOptionInput'),
    id: z.string().default(""),
    label: z.string().optional(),
    desc: z.string().optional(),
    detail: z.string().optional(),
    category: z.string().optional(),
    attributes: z.array(z.string()).optional(),
    actions: ActionGroupInputSchema.optional(),
    damage: DamageInputSchema.optional(),
    charges: ChargeInputSchema.optional(),
    range: RangeInputSchema.optional(),
    shape: ShapeInputSchema.optional(),
    targets: z.number().int().optional(),
    feats: z.array(z.string()).optional(),
    modifiers: z.array(z.string()).optional(),
    proficiencies: z.array(z.string()).optional(),
    expertise: z.array(z.string()).optional(),
    senses: z.array(z.string()).optional(),
    spells: z.array(z.string()).optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
    saveAbility: SaveAbilityInputSchema.optional(),
    levelAvailable: z.string().optional(),
} satisfies Properties<FeatureOptionInput>

export const FeatureOptionInputSchema = z.object(featureOptionInputObject)

export type FeatureOptionInputInfer = z.infer<typeof FeatureOptionInputSchema>

export const modifierDiePerLevelInputObject = {
    __kind: z.literal('ModifierDiePerLevelInput'),
    level: z.string().optional(),
    dieConfig: z.string().optional(),
} satisfies Properties<ModifierDiePerLevelInput>

export const ModifierDiePerLevelInputSchema = z.object(modifierDiePerLevelInputObject)

export type ModifierDiePerLevelInputInfer = z.infer<typeof ModifierDiePerLevelInputSchema>

export const modifierSetPerLevelInputObject = {
    __kind: z.literal('ModifierSetPerLevelInput'),
    level: z.string().optional(),
    setAmount: z.number().int().optional(),
} satisfies Properties<ModifierSetPerLevelInput>

export const ModifierSetPerLevelInputSchema = z.object(modifierSetPerLevelInputObject)

export type ModifierSetPerLevelInputInfer = z.infer<typeof ModifierSetPerLevelInputSchema>

export const featureModifierInputObject = {
    __kind: z.literal('FeatureModifierInput'),
    id: z.string().default(""),
    subtype: z.string().optional(),
    attributes: z.array(z.string()).optional(),
    selectionCount: z.number().int().optional(),
    category: z.string().optional(),
    type: z.string().optional(),
    method: z.string().optional(),
    methodAbility: z.string().optional(),
    methodSkill: z.string().optional(),
    multiplier: z.number().int().optional(),
    maxAmount: z.number().int().optional(),
    minAmount: z.number().int().optional(),
    setAmount: z.number().int().optional(),
    dieConfig: z.string().optional(),
    feature: z.string().optional(),
    diePerLevel: z.array(ModifierDiePerLevelInputSchema).optional(),
    setPerLevel: z.array(ModifierSetPerLevelInputSchema).optional(),
    skills: z.array(z.string()).optional(),
    saveAbilities: z.array(z.string()).optional(),
    abilities: z.array(z.string()).optional(),
    speeds: z.array(z.string()).optional(),
    charge: ChargeInputSchema.optional(),
    range: z.string().optional(),
    minRange: z.number().int().optional(),
    maxRange: z.number().int().optional(),
    shape: z.string().optional(),
    size: z.number().int().optional(),
    duration: z.string().optional(),
    unit: z.string().optional(),
    conditions: z.array(z.string()).optional(),
    damageTypes: z.array(z.string()).optional(),
    damageType: z.string().optional(),
    spells: z.string().optional(),
    spellCategory: z.string().optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
} satisfies Properties<FeatureModifierInput>

export const FeatureModifierInputSchema = z.object(featureModifierInputObject)

export type FeatureModifierInputInfer = z.infer<typeof FeatureModifierInputSchema>

export const featureFeatInputObject = {
    __kind: z.literal('FeatureFeatInput'),
    id: z.string().default(""),
    attributes: z.array(z.string()).optional(),
    feats: z.array(z.string()).optional(),
    selectionCount: z.number().int().optional(),
    subtype: z.string().optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
} satisfies Properties<FeatureFeatInput>

export const FeatureFeatInputSchema = z.object(featureFeatInputObject)

export type FeatureFeatInputInfer = z.infer<typeof FeatureFeatInputSchema>

export const featureExpertiseInputObject = {
    __kind: z.literal('FeatureExpertiseInput'),
    id: z.string().default(""),
    subtype: z.string().optional(),
    attributes: z.array(z.string()).optional(),
    selectionCount: z.number().int().optional(),
    category: z.string().default(""),
    saveAbilities: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    properties: ProficiencyPropertiesInputSchema.optional(),
    equipment: ProficiencyPropertiesInputSchema.optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
} satisfies Properties<FeatureExpertiseInput>

export const FeatureExpertiseInputSchema = z.object(featureExpertiseInputObject)

export type FeatureExpertiseInputInfer = z.infer<typeof FeatureExpertiseInputSchema>

export const featInputObject = {
    __kind: z.literal('FeatInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    detail: z.string().optional(),
    category: z.string().optional(),
    attributes: z.array(z.string()).optional(),
    actions: ActionGroupInputSchema.optional(),
    damage: DamageInputSchema.optional(),
    charges: ChargeInputSchema.optional(),
    range: RangeInputSchema.optional(),
    shape: ShapeInputSchema.optional(),
    targets: z.number().int().optional(),
    modifiers: z.array(z.string()).optional(),
    proficiencies: z.array(z.string()).optional(),
    expertise: z.array(z.string()).optional(),
    senses: z.array(z.string()).optional(),
    spells: z.array(z.string()).optional(),
    prerequisites: PrerequisiteInputSchema.optional(),
    saveAbility: SaveAbilityInputSchema.optional(),
    selectionCount: z.number().int().optional(),
    levelAvailable: z.string().optional(),
    features: z.array(FeatureInputSchema).optional(),
    options: z.array(FeatureOptionInputSchema).optional(),
    ownerId: z.string().default(""),
    systemId: z.string().default(""),
    masterId: z.string().optional(),
} satisfies Properties<FeatInput>

export const FeatInputSchema = z.object(featInputObject)

export type FeatInputInfer = z.infer<typeof FeatInputSchema>

export const speedInputObject = {
    __kind: z.literal('SpeedInput'),
    amount: z.number().int().optional(),
    unit: z.string().default(""),
} satisfies Properties<SpeedInput>

export const SpeedInputSchema = z.object(speedInputObject)

export type SpeedInputInfer = z.infer<typeof SpeedInputSchema>

export const weightInputObject = {
    __kind: z.literal('WeightInput'),
    amount: z.number().optional(),
    unit: z.string().default(""),
} satisfies Properties<WeightInput>

export const WeightInputSchema = z.object(weightInputObject)

export type WeightInputInfer = z.infer<typeof WeightInputSchema>

export const capacityInputObject = {
    __kind: z.literal('CapacityInput'),
    amount: z.number().optional(),
    unit: z.string().default(""),
} satisfies Properties<CapacityInput>

export const CapacityInputSchema = z.object(capacityInputObject)

export type CapacityInputInfer = z.infer<typeof CapacityInputSchema>

export const costInputObject = {
    __kind: z.literal('CostInput'),
    amount: z.number().int().optional(),
    currency: z.string().default(""),
} satisfies Properties<CostInput>

export const CostInputSchema = z.object(costInputObject)

export type CostInputInfer = z.infer<typeof CostInputSchema>

export const containsInputObject = {
    __kind: z.literal('ContainsInput'),
    id: z.string().default(""),
    quantity: z.number().int().default(0),
} satisfies Properties<ContainsInput>

export const ContainsInputSchema = z.object(containsInputObject)

export type ContainsInputInfer = z.infer<typeof ContainsInputSchema>

export const equipmentRangeInputObject = {
    __kind: z.literal('EquipmentRangeInput'),
    minRange: z.number().int().optional(),
    maxRange: z.number().int().optional(),
    unit: z.string().default(""),
} satisfies Properties<EquipmentRangeInput>

export const EquipmentRangeInputSchema = z.object(equipmentRangeInputObject)

export type EquipmentRangeInputInfer = z.infer<typeof EquipmentRangeInputSchema>

export const equipmentInputObject = {
    __kind: z.literal('EquipmentInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    quote: z.string().optional(),
    cost: CostInputSchema.default(CostInputSchema.parse({})),
    weight: WeightInputSchema.default(WeightInputSchema.parse({})),
    capacity: CapacityInputSchema.optional(),
    maxStack: z.number().int().optional(),
    quantity: z.number().int().default(0),
    properties: z.array(z.string()).optional(),
    category: z.string().default(""),
    rarity: z.string().default(""),
    attributes: z.array(z.string()).optional(),
    damage: DamageInputSchema.optional(),
    saveAbility: SaveAbilityInputSchema.optional(),
    primaryAbility: z.string().optional(),
    secondaryAbility: z.string().optional(),
    optionalAbility: z.string().optional(),
    maxBonus: z.number().int().optional(),
    armorClass: z.number().int().optional(),
    prerequisities: PrerequisiteInputSchema.optional(),
    speed: SpeedInputSchema.optional(),
    range: EquipmentRangeInputSchema.optional(),
    contains: z.array(ContainsInputSchema).optional(),
    features: z.array(FeatureInputSchema).optional(),
    ownerId: z.string().optional(),
    systemId: z.string().default(""),
    masterId: z.string().optional(),
    rank: z.number().int().optional(),
} satisfies Properties<EquipmentInput>

export const EquipmentInputSchema = z.object(equipmentInputObject)

export type EquipmentInputInfer = z.infer<typeof EquipmentInputSchema>

export const hitpointInputObject = {
    __kind: z.literal('HitpointInput'),
    ability: z.string().default(""),
    dieConfig: z.string().optional(),
} satisfies Properties<HitpointInput>

export const HitpointInputSchema = z.object(hitpointInputObject)

export type HitpointInputInfer = z.infer<typeof HitpointInputSchema>

export const startingGoldInputObject = {
    __kind: z.literal('StartingGoldInput'),
    multiplier: z.number().int().default(0),
    currency: z.string().default(""),
    dieConfig: z.string().optional(),
} satisfies Properties<StartingGoldInput>

export const StartingGoldInputSchema = z.object(startingGoldInputObject)

export type StartingGoldInputInfer = z.infer<typeof StartingGoldInputSchema>

export const prepareLimitLevelInputObject = {
    __kind: z.literal('PrepareLimitLevelInput'),
    measurement: z.string().optional(),
    rounding: z.string().optional(),
} satisfies Properties<PrepareLimitLevelInput>

export const PrepareLimitLevelInputSchema = z.object(prepareLimitLevelInputObject)

export type PrepareLimitLevelInputInfer = z.infer<typeof PrepareLimitLevelInputSchema>

export const prepareLimitInputObject = {
    __kind: z.literal('PrepareLimitInput'),
    methods: z.array(z.string()).optional(),
    level: PrepareLimitLevelInputSchema.optional(),
} satisfies Properties<PrepareLimitInput>

export const PrepareLimitInputSchema = z.object(prepareLimitInputObject)

export type PrepareLimitInputInfer = z.infer<typeof PrepareLimitInputSchema>

export const spellcastingInputObject = {
    __kind: z.literal('SpellcastingInput'),
    magicName: z.string().optional(),
    ability: z.string().optional(),
    maxSpellLevel: z.number().int().optional(),
    attributes: z.array(z.string()).optional(),
    charges: ChargeInputSchema.optional(),
    prepareLimit: PrepareLimitInputSchema.optional(),
} satisfies Properties<SpellcastingInput>

export const SpellcastingInputSchema = z.object(spellcastingInputObject)

export type SpellcastingInputInfer = z.infer<typeof SpellcastingInputSchema>

export const spellSlotInputObject = {
    __kind: z.literal('SpellSlotInput'),
    slotCount: z.number().int().optional(),
} satisfies Properties<SpellSlotInput>

export const SpellSlotInputSchema = z.object(spellSlotInputObject)

export type SpellSlotInputInfer = z.infer<typeof SpellSlotInputSchema>

export const levelAttributeInputObject = {
    __kind: z.literal('LevelAttributeInput'),
    level: z.number().int().optional(),
    spellSlots: z.array(SpellSlotInputSchema).optional(),
    resourcePoints: z.number().int().optional(),
    spellsKnownLimit: z.number().int().optional(),
    cantripsKnownLimit: z.number().int().optional(),
} satisfies Properties<LevelAttributeInput>

export const LevelAttributeInputSchema = z.object(levelAttributeInputObject)

export type LevelAttributeInputInfer = z.infer<typeof LevelAttributeInputSchema>

export const resourceInputObject = {
    __kind: z.literal('ResourceInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    levelAvailable: z.number().int().optional(),
    charges: ChargeInputSchema.optional(),
    method: z.string().optional(),
    desc: z.string().optional(),
} satisfies Properties<ResourceInput>

export const ResourceInputSchema = z.object(resourceInputObject)

export type ResourceInputInfer = z.infer<typeof ResourceInputSchema>

export const multiclassAbilityInputObject = {
    __kind: z.literal('MulticlassAbilityInput'),
    id: z.string().optional(),
    minAmount: z.number().int().optional(),
} satisfies Properties<MulticlassAbilityInput>

export const MulticlassAbilityInputSchema = z.object(multiclassAbilityInputObject)

export type MulticlassAbilityInputInfer = z.infer<typeof MulticlassAbilityInputSchema>

export const multiclassInputObject = {
    __kind: z.literal('MulticlassInput'),
    primaryAbility: MulticlassAbilityInputSchema.optional(),
    secondaryAbility: MulticlassAbilityInputSchema.optional(),
    optionalAbility: MulticlassAbilityInputSchema.optional(),
} satisfies Properties<MulticlassInput>

export const MulticlassInputSchema = z.object(multiclassInputObject)

export type MulticlassInputInfer = z.infer<typeof MulticlassInputSchema>

export const subtypeInputObject = {
    __kind: z.literal('SubtypeInput'),
    id: z.string().default(""),
    label: z.string().default(""),
} satisfies Properties<SubtypeInput>

export const SubtypeInputSchema = z.object(subtypeInputObject)

export type SubtypeInputInfer = z.infer<typeof SubtypeInputSchema>

export const classCurrencyInputObject = {
    __kind: z.literal('ClassCurrencyInput'),
    id: z.string().default(""),
    amount: z.number().int().optional(),
} satisfies Properties<ClassCurrencyInput>

export const ClassCurrencyInputSchema = z.object(classCurrencyInputObject)

export type ClassCurrencyInputInfer = z.infer<typeof ClassCurrencyInputSchema>

export const classEquipmentInputObject = {
    __kind: z.literal('ClassEquipmentInput'),
    attributes: z.array(z.string()).optional(),
    selectionCount: z.number().int().optional(),
    category: z.string().optional(),
    equipment: z.array(z.string()).optional(),
    properties: z.array(z.string()).optional(),
    quantity: z.number().int().optional(),
    currencies: z.array(ClassCurrencyInputSchema).optional(),
} satisfies Properties<ClassEquipmentInput>

export const ClassEquipmentInputSchema = z.object(classEquipmentInputObject)

export type ClassEquipmentInputInfer = z.infer<typeof ClassEquipmentInputSchema>

export const classInputObject = {
    __kind: z.literal('ClassInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    category: z.string().default(""),
    attributes: z.array(z.string()).optional(),
    details: z.array(DetailInputSchema).optional(),
    hitpoint: HitpointInputSchema.optional(),
    startingGold: StartingGoldInputSchema.optional(),
    equipment: z.array(z.array(z.array(ClassEquipmentInputSchema))).optional(),
    proficiencies: z.array(FeatureProficiencyInputSchema).optional(),
    spellcasting: SpellcastingInputSchema.optional(),
    levelAttributes: z.array(LevelAttributeInputSchema).optional(),
    resource: ResourceInputSchema.optional(),
    multiclass: MulticlassInputSchema.optional(),
    parentClass: z.string().optional(),
    subtypes: z.array(SubtypeInputSchema).optional(),
    features: z.array(FeatureInputSchema).optional(),
    ownerId: z.string().optional(),
    systemId: z.string().default(""),
    masterId: z.string().optional(),
} satisfies Properties<ClassInput>

export const ClassInputSchema = z.object(classInputObject)

export type ClassInputInfer = z.infer<typeof ClassInputSchema>

export const characterModifierInputObject = {
    __kind: z.literal('CharacterModifierInput'),
    modifierId: z.string().default(""),
    featureId: z.string().optional(),
    classId: z.string().optional(),
    raceId: z.string().optional(),
    ancestryId: z.string().optional(),
    equipmentId: z.string().optional(),
    backgroundId: z.string().optional(),
    featId: z.string().optional(),
    optionId: z.string().optional(),
    optionIndex: z.string().optional(),
    featureLevel: z.number().int().optional(),
} satisfies Properties<CharacterModifierInput>

export const CharacterModifierInputSchema = z.object(characterModifierInputObject)

export type CharacterModifierInputInfer = z.infer<typeof CharacterModifierInputSchema>

export const characterSenseInputObject = {
    __kind: z.literal('CharacterSenseInput'),
    senseId: z.string().optional(),
    featureId: z.string().optional(),
    classId: z.string().optional(),
    raceId: z.string().optional(),
    ancestryId: z.string().optional(),
    equipmentId: z.string().optional(),
    backgroundId: z.string().optional(),
    featId: z.string().optional(),
    optionId: z.string().optional(),
    optionIndex: z.string().optional(),
    featureLevel: z.number().int().optional(),
} satisfies Properties<CharacterSenseInput>

export const CharacterSenseInputSchema = z.object(characterSenseInputObject)

export type CharacterSenseInputInfer = z.infer<typeof CharacterSenseInputSchema>

export const characterFeatInputObject = {
    __kind: z.literal('CharacterFeatInput'),
    featId: z.string().optional(),
    featureId: z.string().optional(),
    classId: z.string().optional(),
    raceId: z.string().optional(),
    ancestryId: z.string().optional(),
    equipmentId: z.string().optional(),
    backgroundId: z.string().optional(),
    optionId: z.string().optional(),
    optionIndex: z.string().optional(),
    featureLevel: z.number().int().optional(),
} satisfies Properties<CharacterFeatInput>

export const CharacterFeatInputSchema = z.object(characterFeatInputObject)

export type CharacterFeatInputInfer = z.infer<typeof CharacterFeatInputSchema>

export const characterProficiencyInputObject = {
    __kind: z.literal('CharacterProficiencyInput'),
    skill: z.string().optional(),
    language: z.string().optional(),
    saveAbility: z.string().optional(),
    property: z.string().optional(),
    equipment: z.string().optional(),
    proficiencyId: z.string().default(""),
    featureId: z.string().optional(),
    classId: z.string().optional(),
    raceId: z.string().optional(),
    ancestryId: z.string().optional(),
    equipmentId: z.string().optional(),
    backgroundId: z.string().optional(),
    featId: z.string().optional(),
    optionId: z.string().optional(),
    optionIndex: z.string().optional(),
    featureLevel: z.number().int().optional(),
} satisfies Properties<CharacterProficiencyInput>

export const CharacterProficiencyInputSchema = z.object(characterProficiencyInputObject)

export type CharacterProficiencyInputInfer = z.infer<typeof CharacterProficiencyInputSchema>

export const characterExpertiseInputObject = {
    __kind: z.literal('CharacterExpertiseInput'),
    skill: z.string().optional(),
    language: z.string().optional(),
    saveAbility: z.string().optional(),
    property: z.string().optional(),
    equipment: z.string().optional(),
    expertiseId: z.string().default(""),
    featureId: z.string().optional(),
    classId: z.string().optional(),
    raceId: z.string().optional(),
    ancestryId: z.string().optional(),
    equipmentId: z.string().optional(),
    backgroundId: z.string().optional(),
    featId: z.string().optional(),
    optionId: z.string().optional(),
    optionIndex: z.string().optional(),
    featureLevel: z.number().int().optional(),
} satisfies Properties<CharacterExpertiseInput>

export const CharacterExpertiseInputSchema = z.object(characterExpertiseInputObject)

export type CharacterExpertiseInputInfer = z.infer<typeof CharacterExpertiseInputSchema>

export const characterSpellInputObject = {
    __kind: z.literal('CharacterSpellInput'),
    id: z.string().default(""),
    level: z.number().int().default(1),
    ability: z.string().optional(),
    isRitual: z.boolean().optional(),
    countAsKnown: z.boolean().optional(),
    usesSlot: z.boolean().optional(),
    alwaysPrepared: z.boolean().optional(),
    castAtLevel: z.boolean().optional(),
    requiresConcentration: z.boolean().optional(),
    optionalAbility: z.boolean().optional(),
    featureId: z.string().optional(),
    classId: z.string().optional(),
    raceId: z.string().optional(),
    ancestryId: z.string().optional(),
    equipmentId: z.string().optional(),
    backgroundId: z.string().optional(),
    featId: z.string().optional(),
    optionId: z.string().optional(),
    optionIndex: z.string().optional(),
    featureLevel: z.number().int().optional(),
} satisfies Properties<CharacterSpellInput>

export const CharacterSpellInputSchema = z.object(characterSpellInputObject)

export type CharacterSpellInputInfer = z.infer<typeof CharacterSpellInputSchema>

export const characterFeatureOptionInputObject = {
    __kind: z.literal('CharacterFeatureOptionInput'),
    id: z.string().default(""),
    optionIndex: z.string().default(""),
    featureLevel: z.number().int().default(1),
} satisfies Properties<CharacterFeatureOptionInput>

export const CharacterFeatureOptionInputSchema = z.object(characterFeatureOptionInputObject)

export type CharacterFeatureOptionInputInfer = z.infer<typeof CharacterFeatureOptionInputSchema>

export const characterFeatureInputObject = {
    __kind: z.literal('CharacterFeatureInput'),
    id: z.string().optional(),
    options: z.array(CharacterFeatureOptionInputSchema).optional(),
    classId: z.string().optional(),
    raceId: z.string().optional(),
    ancestryId: z.string().optional(),
    equipmentId: z.string().optional(),
    backgroundId: z.string().optional(),
    featId: z.string().optional(),
    level: z.number().int().optional(),
} satisfies Properties<CharacterFeatureInput>

export const CharacterFeatureInputSchema = z.object(characterFeatureInputObject)

export type CharacterFeatureInputInfer = z.infer<typeof CharacterFeatureInputSchema>

export const rollInputObject = {
    __kind: z.literal('RollInput'),
    die: z.number().int().default(1),
    value: z.number().int().default(4),
    id: z.string().optional(),
} satisfies Properties<RollInput>

export const RollInputSchema = z.object(rollInputObject)

export type RollInputInfer = z.infer<typeof RollInputSchema>

export const rollTypeInputObject = {
    __kind: z.literal('RollTypeInput'),
    score: z.number().int().default(1),
    ability: z.string().default(""),
    rolling: z.boolean().default(false),
    applied: z.boolean().default(false),
    rolled: z.array(RollInputSchema).default(() => [RollInputSchema.parse({})]),
    kept: z.array(RollInputSchema).optional(),
} satisfies Properties<RollTypeInput>

export const RollTypeInputSchema = z.object(rollTypeInputObject)

export type RollTypeInputInfer = z.infer<typeof RollTypeInputSchema>

export const manualInputObject = {
    __kind: z.literal('ManualInput'),
    ability: z.string().optional(),
    score: z.number().int().optional(),
} satisfies Properties<ManualInput>

export const ManualInputSchema = z.object(manualInputObject)

export type ManualInputInfer = z.infer<typeof ManualInputSchema>

export const manualRolledInputObject = {
    __kind: z.literal('ManualRolledInput'),
    configuration: z.string().default(""),
    rollGroups: z.array(z.array(RollTypeInputSchema)).optional(),
    manual: z.array(ManualInputSchema).optional(),
} satisfies Properties<ManualRolledInput>

export const ManualRolledInputSchema = z.object(manualRolledInputObject)

export type ManualRolledInputInfer = z.infer<typeof ManualRolledInputSchema>

export const distributedInputObject = {
    __kind: z.literal('DistributedInput'),
    ability: z.string().default(""),
    id: z.string().default(""),
} satisfies Properties<DistributedInput>

export const DistributedInputSchema = z.object(distributedInputObject)

export type DistributedInputInfer = z.infer<typeof DistributedInputSchema>

export const pointBuyInputObject = {
    __kind: z.literal('PointBuyInput'),
    pointsLeft: z.number().int().optional(),
    distributed: z.array(DistributedInputSchema).optional(),
} satisfies Properties<PointBuyInput>

export const PointBuyInputSchema = z.object(pointBuyInputObject)

export type PointBuyInputInfer = z.infer<typeof PointBuyInputSchema>

export const standardArrayInputObject = {
    __kind: z.literal('StandardArrayInput'),
    ability: z.string().optional(),
    score: z.string().optional(),
} satisfies Properties<StandardArrayInput>

export const StandardArrayInputSchema = z.object(standardArrayInputObject)

export type StandardArrayInputInfer = z.infer<typeof StandardArrayInputSchema>

export const scoresInputObject = {
    __kind: z.literal('ScoresInput'),
    ability: z.string().default(""),
    baseScore: z.number().int().optional(),
    raceScore: z.number().int().optional(),
    classScore: z.number().int().optional(),
    calculatedScore: z.number().int().optional(),
    ModifierScore: z.number().int().optional(),
} satisfies Properties<ScoresInput>

export const ScoresInputSchema = z.object(scoresInputObject)

export type ScoresInputInfer = z.infer<typeof ScoresInputSchema>

export const characterAbilitiesInputObject = {
    __kind: z.literal('CharacterAbilitiesInput'),
    manualRolled: ManualRolledInputSchema.optional(),
    pointBuy: PointBuyInputSchema.optional(),
    standardArray: z.array(StandardArrayInputSchema).optional(),
    selectedSystem: z.string().optional(),
    scores: z.array(ScoresInputSchema).optional(),
} satisfies Properties<CharacterAbilitiesInput>

export const CharacterAbilitiesInputSchema = z.object(characterAbilitiesInputObject)

export type CharacterAbilitiesInputInfer = z.infer<typeof CharacterAbilitiesInputSchema>

export const lineageInputObject = {
    __kind: z.literal('LineageInput'),
    id: z.string().optional(),
    raceId: z.string().optional(),
} satisfies Properties<LineageInput>

export const LineageInputSchema = z.object(lineageInputObject)

export type LineageInputInfer = z.infer<typeof LineageInputSchema>

export const characterAncestryInputObject = {
    __kind: z.literal('CharacterAncestryInput'),
    id: z.string().optional(),
    raceId: z.string().optional(),
    lineage: z.array(LineageInputSchema).optional(),
} satisfies Properties<CharacterAncestryInput>

export const CharacterAncestryInputSchema = z.object(characterAncestryInputObject)

export type CharacterAncestryInputInfer = z.infer<typeof CharacterAncestryInputSchema>

export const subclassInputObject = {
    __kind: z.literal('SubclassInput'),
    id: z.string().optional(),
    subtype: z.string().optional(),
} satisfies Properties<SubclassInput>

export const SubclassInputSchema = z.object(subclassInputObject)

export type SubclassInputInfer = z.infer<typeof SubclassInputSchema>

export const classSpellInputObject = {
    __kind: z.literal('ClassSpellInput'),
    id: z.string().default(""),
    classId: z.string().optional(),
    ability: z.string().optional(),
    isRitual: z.boolean().optional(),
    countAsKnown: z.boolean().optional(),
    usesSlot: z.boolean().optional(),
    alwaysPrepared: z.boolean().optional(),
    castAtLevel: z.boolean().optional(),
    requiresConcentration: z.boolean().optional(),
    optionalAbility: z.boolean().optional(),
} satisfies Properties<ClassSpellInput>

export const ClassSpellInputSchema = z.object(classSpellInputObject)

export type ClassSpellInputInfer = z.infer<typeof ClassSpellInputSchema>

export const classSpellListInputObject = {
    __kind: z.literal('ClassSpellListInput'),
    level: z.number().int().default(1),
    spells: z.array(ClassSpellInputSchema).optional(),
} satisfies Properties<ClassSpellListInput>

export const ClassSpellListInputSchema = z.object(classSpellListInputObject)

export type ClassSpellListInputInfer = z.infer<typeof ClassSpellListInputSchema>

export const characterSpellSlotsInputObject = {
    __kind: z.literal('CharacterSpellSlotsInput'),
    level: z.number().int().default(0),
    used: z.number().int().default(0),
    classId: z.string().default(""),
} satisfies Properties<CharacterSpellSlotsInput>

export const CharacterSpellSlotsInputSchema = z.object(characterSpellSlotsInputObject)

export type CharacterSpellSlotsInputInfer = z.infer<typeof CharacterSpellSlotsInputSchema>

export const characterSpellcastingInputObject = {
    __kind: z.literal('CharacterSpellcastingInput'),
    prepared: z.array(ClassSpellListInputSchema).optional(),
    known: z.array(ClassSpellListInputSchema).optional(),
    additional: z.array(CharacterSpellInputSchema).optional(),
    spellSlots: z.array(CharacterSpellSlotsInputSchema).optional(),
} satisfies Properties<CharacterSpellcastingInput>

export const CharacterSpellcastingInputSchema = z.object(characterSpellcastingInputObject)

export type CharacterSpellcastingInputInfer = z.infer<typeof CharacterSpellcastingInputSchema>

export const characterClassInputObject = {
    __kind: z.literal('CharacterClassInput'),
    id: z.string().default(""),
    subclass: SubclassInputSchema.optional(),
    level: z.number().int().default(0),
} satisfies Properties<CharacterClassInput>

export const CharacterClassInputSchema = z.object(characterClassInputObject)

export type CharacterClassInputInfer = z.infer<typeof CharacterClassInputSchema>

export const startingEquipmentInputObject = {
    __kind: z.literal('StartingEquipmentInput'),
    id: z.string().default(""),
    selectionId: z.string().optional(),
    quantity: z.number().int().default(1),
} satisfies Properties<StartingEquipmentInput>

export const StartingEquipmentInputSchema = z.object(startingEquipmentInputObject)

export type StartingEquipmentInputInfer = z.infer<typeof StartingEquipmentInputSchema>

export const startingEquipmentGroupInputObject = {
    __kind: z.literal('StartingEquipmentGroupInput'),
    optionId: z.string().default(""),
    groupId: z.string().default(""),
    equipment: z.array(StartingEquipmentInputSchema).optional(),
} satisfies Properties<StartingEquipmentGroupInput>

export const StartingEquipmentGroupInputSchema = z.object(startingEquipmentGroupInputObject)

export type StartingEquipmentGroupInputInfer = z.infer<typeof StartingEquipmentGroupInputSchema>

export const classStartingEquipmentInputObject = {
    __kind: z.literal('ClassStartingEquipmentInput'),
    option: z.string().default(""),
    goldOption: z.string().optional(),
    totalGold: z.number().int().optional(),
    equipmentGroups: z.array(StartingEquipmentGroupInputSchema).optional(),
    addedToCharacter: z.boolean().optional(),
} satisfies Properties<ClassStartingEquipmentInput>

export const ClassStartingEquipmentInputSchema = z.object(classStartingEquipmentInputObject)

export type ClassStartingEquipmentInputInfer = z.infer<typeof ClassStartingEquipmentInputSchema>

export const backgroundStartingEquipmentInputObject = {
    __kind: z.literal('BackgroundStartingEquipmentInput'),
    equipmentGroups: z.array(StartingEquipmentGroupInputSchema).optional(),
    addedToCharacter: z.boolean().optional(),
} satisfies Properties<BackgroundStartingEquipmentInput>

export const BackgroundStartingEquipmentInputSchema = z.object(backgroundStartingEquipmentInputObject)

export type BackgroundStartingEquipmentInputInfer = z.infer<typeof BackgroundStartingEquipmentInputSchema>

export const possessionsInputObject = {
    __kind: z.literal('PossessionsInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
} satisfies Properties<PossessionsInput>

export const PossessionsInputSchema = z.object(possessionsInputObject)

export type PossessionsInputInfer = z.infer<typeof PossessionsInputSchema>

export const characterCurrencyInputObject = {
    __kind: z.literal('CharacterCurrencyInput'),
    id: z.string().default(""),
    amount: z.number().int().default(0),
} satisfies Properties<CharacterCurrencyInput>

export const CharacterCurrencyInputSchema = z.object(characterCurrencyInputObject)

export type CharacterCurrencyInputInfer = z.infer<typeof CharacterCurrencyInputSchema>

export const currencyGroupInputObject = {
    __kind: z.literal('CurrencyGroupInput'),
    currencies: z.array(CharacterCurrencyInputSchema).optional(),
    container: z.string().optional(),
} satisfies Properties<CurrencyGroupInput>

export const CurrencyGroupInputSchema = z.object(currencyGroupInputObject)

export type CurrencyGroupInputInfer = z.infer<typeof CurrencyGroupInputSchema>

export const hitpointRollValuesInputObject = {
    __kind: z.literal('HitpointRollValuesInput'),
    level: z.number().int().default(0),
    value: z.number().int().default(0),
} satisfies Properties<HitpointRollValuesInput>

export const HitpointRollValuesInputSchema = z.object(hitpointRollValuesInputObject)

export type HitpointRollValuesInputInfer = z.infer<typeof HitpointRollValuesInputSchema>

export const hitpointRollInputObject = {
    __kind: z.literal('HitpointRollInput'),
    values: z.array(HitpointRollValuesInputSchema).optional(),
    total: z.number().int().optional(),
    current: z.number().int().optional(),
} satisfies Properties<HitpointRollInput>

export const HitpointRollInputSchema = z.object(hitpointRollInputObject)

export type HitpointRollInputInfer = z.infer<typeof HitpointRollInputSchema>

export const hitpointFixedInputObject = {
    __kind: z.literal('HitpointFixedInput'),
    current: z.number().int().optional(),
    total: z.number().int().optional(),
} satisfies Properties<HitpointFixedInput>

export const HitpointFixedInputSchema = z.object(hitpointFixedInputObject)

export type HitpointFixedInputInfer = z.infer<typeof HitpointFixedInputSchema>

export const characterHitpointInputObject = {
    __kind: z.literal('CharacterHitpointInput'),
    method: z.string().default(""),
    maxOverride: z.number().int().optional(),
    maxHitpoints: z.number().int().optional(),
    temp: z.number().int().optional(),
    bonus: z.number().int().optional(),
    rolled: HitpointRollInputSchema.optional(),
    fixed: HitpointFixedInputSchema.optional(),
} satisfies Properties<CharacterHitpointInput>

export const CharacterHitpointInputSchema = z.object(characterHitpointInputObject)

export type CharacterHitpointInputInfer = z.infer<typeof CharacterHitpointInputSchema>

export const characterEquipmentObjectInputObject = {
    __kind: z.literal('CharacterEquipmentObjectInput'),
    id: z.string().default(""),
    equipmentId: z.string().default(""),
    quantity: z.number().int().default(0),
    containerId: z.string().optional(),
    containerPath: z.string().optional(),
    customName: z.string().optional(),
    notes: z.string().optional(),
} satisfies Properties<CharacterEquipmentObjectInput>

export const CharacterEquipmentObjectInputSchema = z.object(characterEquipmentObjectInputObject)

export type CharacterEquipmentObjectInputInfer = z.infer<typeof CharacterEquipmentObjectInputSchema>

export const characterEquipmentInputObject = {
    __kind: z.literal('CharacterEquipmentInput'),
    equipped: z.array(z.string()).optional(),
    attuned: z.array(z.string()).optional(),
    inventory: z.array(CharacterEquipmentObjectInputSchema).optional(),
} satisfies Properties<CharacterEquipmentInput>

export const CharacterEquipmentInputSchema = z.object(characterEquipmentInputObject)

export type CharacterEquipmentInputInfer = z.infer<typeof CharacterEquipmentInputSchema>

export const characterInputObject = {
    __kind: z.literal('CharacterInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    advancement: z.string().optional(),
    exp: z.number().int().optional(),
    hitpoint: CharacterHitpointInputSchema.optional(),
    abilities: CharacterAbilitiesInputSchema.optional(),
    race: z.string().optional(),
    ancestry: CharacterAncestryInputSchema.optional(),
    background: z.string().optional(),
    classes: z.array(CharacterClassInputSchema.optional()).optional(),
    spellcasting: CharacterSpellcastingInputSchema.optional(),
    classEquipment: ClassStartingEquipmentInputSchema.optional(),
    backgroundEquipment: BackgroundStartingEquipmentInputSchema.optional(),
    equipment: CharacterEquipmentInputSchema.default(CharacterEquipmentInputSchema.parse({})),
    currencyGroups: z.array(CurrencyGroupInputSchema).optional(),
    features: z.array(CharacterFeatureInputSchema).optional(),
    feats: z.array(CharacterFeatInputSchema).optional(),
    proficiencies: z.array(CharacterProficiencyInputSchema).optional(),
    expertise: z.array(CharacterExpertiseInputSchema).optional(),
    modifiers: z.array(CharacterModifierInputSchema).optional(),
    senses: z.array(CharacterSenseInputSchema).optional(),
    ownerId: z.string().optional(),
    systemId: z.string().default(""),
} satisfies Properties<CharacterInput>

export const CharacterInputSchema = z.object(characterInputObject)

export type CharacterInputInfer = z.infer<typeof CharacterInputSchema>

export const backgroundCurrencyInputObject = {
    __kind: z.literal('BackgroundCurrencyInput'),
    id: z.string().default(""),
    amount: z.number().int().optional(),
} satisfies Properties<BackgroundCurrencyInput>

export const BackgroundCurrencyInputSchema = z.object(backgroundCurrencyInputObject)

export type BackgroundCurrencyInputInfer = z.infer<typeof BackgroundCurrencyInputSchema>

export const backgroundEquipmentInputObject = {
    __kind: z.literal('BackgroundEquipmentInput'),
    attributes: z.array(z.string()).optional(),
    selectionCount: z.number().int().optional(),
    category: z.string().optional(),
    equipment: z.array(z.string()).optional(),
    properties: z.array(z.string()).optional(),
    quantity: z.number().int().optional(),
    currencies: z.array(BackgroundCurrencyInputSchema.optional()).optional(),
} satisfies Properties<BackgroundEquipmentInput>

export const BackgroundEquipmentInputSchema = z.object(backgroundEquipmentInputObject)

export type BackgroundEquipmentInputInfer = z.infer<typeof BackgroundEquipmentInputSchema>

export const backgroundInputObject = {
    __kind: z.literal('BackgroundInput'),
    id: z.string().default(""),
    label: z.string().default(""),
    desc: z.string().optional(),
    details: z.array(DetailInputSchema).optional(),
    equipment: z.array(z.array(z.array(BackgroundEquipmentInputSchema))).optional(),
    proficiencies: z.array(FeatureProficiencyInputSchema).optional(),
    features: z.array(FeatureInputSchema).optional(),
    ownerId: z.string().optional(),
    systemId: z.string().default(""),
    masterId: z.string().optional(),
} satisfies Properties<BackgroundInput>

export const BackgroundInputSchema = z.object(backgroundInputObject)

export type BackgroundInputInfer = z.infer<typeof BackgroundInputSchema>

