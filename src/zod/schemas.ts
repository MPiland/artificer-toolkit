import { z } from 'zod/v4'
import { FEATURE_ENUM_INPUT, DAMAGE_ENUM_INPUT, SPELL_ENUM_INPUT, FEAT_ENUM_INPUT, SECTION_ENUM_INPUT, EQUIPMENT_ENUM_INPUT, CLASSES_ENUM_INPUT } from '~/types'

export const GenericTypeInputSchema = z.lazy(() => z.object({
  __kind: z.literal('GenericTypeInput'),
  id: z.string(),
  label: z.string(),
  desc: z.string().nullish(),
  tooltip: z.string().nullish(),
  short: z.string().nullish(),
}))

export type GenericTypeInput = z.infer<typeof GenericTypeInputSchema>

export const CurrencyConversionInputSchema = z.object({
  __kind: z.literal('CurrencyConversionInput'),
  copper: z.number(),
  silver: z.number(),
  gold: z.number(),
  electrum: z.number(),
  platinum: z.number(),
})

export type CurrencyConversionInput = z.infer<typeof CurrencyConversionInputSchema>

export const CurrencyInputSchema = z.object({
  __kind: z.literal('CurrencyInput'),
  id: z.string(),
  label: z.string(),
  desc: z.string().nullish(),
  abbreviation: z.string(),
  conversions: CurrencyConversionInputSchema,
})

export type CurrencyInput = z.infer<typeof CurrencyInputSchema>

export const EquipmentCategoryPropertyInputSchema = z.object({
  __kind: z.literal('EquipmentCategoryPropertyInput'),
  id: z.string(),
  propertyId: z.string(),
  categoryId: z.string(),
})

export type EquipmentCategoryPropertyInput = z.infer<typeof EquipmentCategoryPropertyInputSchema>

export const SystemEquipmentInputSchema = z.object({
  __kind: z.literal('SystemEquipmentInput'),
  categories: z.array(GenericTypeInputSchema),
  properties: z.array(GenericTypeInputSchema),
  categoryProperties: z.array(EquipmentCategoryPropertyInputSchema),
  rarities: z.array(GenericTypeInputSchema),
})

export type SystemEquipmentInput = z.infer<typeof SystemEquipmentInputSchema>

export const ModifierCategoryTypeInputSchema = z.object({
  __kind: z.literal('ModifierCategoryTypeInput'),
  id: z.string(),
  typeId: z.string(),
  categoryId: z.string(),
})

export type ModifierCategoryTypeInput = z.infer<typeof ModifierCategoryTypeInputSchema>

export const ModifierTypeMethodInputSchema = z.object({
  __kind: z.literal('ModifierTypeMethodInput'),
  id: z.string(),
  typeId: z.string(),
  methodId: z.string(),
})

export type ModifierTypeMethodInput = z.infer<typeof ModifierTypeMethodInputSchema>

export const ModifierCategoryTypeMethodInputSchema = z.object({
  __kind: z.literal('ModifierCategoryTypeMethodInput'),
  id: z.string(),
  methodId: z.string(),
  typeId: z.string(),
  categoryId: z.string(),
})

export type ModifierCategoryTypeMethodInput = z.infer<typeof ModifierCategoryTypeMethodInputSchema>

export const SystemModifiersInputSchema = z.object({
  __kind: z.literal('SystemModifiersInput'),
  categories: z.array(GenericTypeInputSchema),
  types: z.array(GenericTypeInputSchema),
  methods: z.array(GenericTypeInputSchema),
  spellCategories: z.array(GenericTypeInputSchema),
  categoryTypes: z.array(ModifierCategoryTypeInputSchema),
  typeMethods: z.array(ModifierTypeMethodInputSchema),
  categoryMethods: z.array(ModifierCategoryTypeMethodInputSchema),
})

export type SystemModifiersInput = z.infer<typeof SystemModifiersInputSchema>

export const ProficiencyLevelInputSchema = z.object({
  __kind: z.literal('ProficiencyLevelInput'),
  id: z.string(),
  label: z.string(),
  multiplier: z.number().nullish(),
})

export type ProficiencyLevelInput = z.infer<typeof ProficiencyLevelInputSchema>

export const SystemProficiencyInputSchema = z.object({
  __kind: z.literal('SystemProficiencyInput'),
  levels: z.array(ProficiencyLevelInputSchema),
  categories: z.array(GenericTypeInputSchema),
})

export type SystemProficiencyInput = z.infer<typeof SystemProficiencyInputSchema>

export const SystemSpellInputSchema = z.object({
  __kind: z.literal('SystemSpellInput'),
  categories: z.array(GenericTypeInputSchema),
  durations: z.array(GenericTypeInputSchema),
  ranges: z.array(GenericTypeInputSchema),
  schools: z.array(GenericTypeInputSchema),
  shapes: z.array(GenericTypeInputSchema),
  requirements: z.array(GenericTypeInputSchema),
})

export type SystemSpellInput = z.infer<typeof SystemSpellInputSchema>

export const GenerateOptionInputSchema = z.object({
  __kind: z.literal('GenerateOptionInput'),
  id: z.string(),
  label: z.string(),
  reduce: z.number().int().nullish(),
})

export type GenerateOptionInput = z.infer<typeof GenerateOptionInputSchema>

export const ImperialInputSchema = z.object({
  __kind: z.literal('ImperialInput'),
  weight: z.array(GenericTypeInputSchema),
  volume: z.array(GenericTypeInputSchema),
  length: z.array(GenericTypeInputSchema),
})

export type ImperialInput = z.infer<typeof ImperialInputSchema>

export const SystemMeasurementInputSchema = z.object({
  __kind: z.literal('SystemMeasurementInput'),
  amount: z.array(GenericTypeInputSchema),
  rounding: z.array(GenericTypeInputSchema),
  imperial: ImperialInputSchema,
})

export type SystemMeasurementInput = z.infer<typeof SystemMeasurementInputSchema>

export const AbilityGenerateMethodInputSchema = z.object({
  __kind: z.literal('AbilityGenerateMethodInput'),
  id: z.string(),
  label: z.string(),
  total: z.number().int().nullish(),
  options: z.array(GenerateOptionInputSchema).nullish(),
})

export type AbilityGenerateMethodInput = z.infer<typeof AbilityGenerateMethodInputSchema>

export const SystemRulesInputSchema = z.object({
  __kind: z.literal('SystemRulesInput'),
  measurements: SystemMeasurementInputSchema,
  abilityGenerateMethod: z.array(AbilityGenerateMethodInputSchema),
})

export type SystemRulesInput = z.infer<typeof SystemRulesInputSchema>

export const ChargeOptionInputSchema = z.object({
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
})

export type ChargeOptionInput = z.infer<typeof ChargeOptionInputSchema>

export const SystemChargesInputSchema = z.object({
  __kind: z.literal('SystemChargesInput'),
  resets: z.array(ChargeOptionInputSchema),
  limits: z.array(ChargeOptionInputSchema),
})

export type SystemChargesInput = z.infer<typeof SystemChargesInputSchema>

export const CharacterSettingInputSchema = z.object({
  __kind: z.literal('CharacterSettingInput'),
  hitpointCalcMethods: z.array(GenericTypeInputSchema),
  advancementMethods: z.array(GenericTypeInputSchema),
  spellPointCalcMethods: z.array(GenericTypeInputSchema),
  startingEquipmentOptions: z.array(GenericTypeInputSchema),
})

export type CharacterSettingInput = z.infer<typeof CharacterSettingInputSchema>

export const SystemActionInputSchema = z.object({
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
})

export type SystemActionInput = z.infer<typeof SystemActionInputSchema>

export const SystemAttributeInputSchema = z.object({
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
})

export type SystemAttributeInput = z.infer<typeof SystemAttributeInputSchema>

export const SystemCategoryInputSchema = z.object({
  __kind: z.literal('SystemCategoryInput'),
  id: z.string(),
  label: z.string(),
  features: z.boolean(),
  classes: z.boolean(),
  races: z.boolean(),
})

export type SystemCategoryInput = z.infer<typeof SystemCategoryInputSchema>

export const SystemSenseInputSchema = z.object({
  __kind: z.literal('SystemSenseInput'),
  id: z.string(),
  label: z.string(),
  creatureDesc: z.string().nullish(),
  monsterDesc: z.string().nullish(),
  type: z.array(z.string().nullish()).nullish(),
})

export type SystemSenseInput = z.infer<typeof SystemSenseInputSchema>

export const SystemSkillInputSchema = z.object({
  __kind: z.literal('SystemSkillInput'),
  id: z.string(),
  label: z.string(),
  desc: z.string().nullish(),
  abilityId: z.string(),
})

export type SystemSkillInput = z.infer<typeof SystemSkillInputSchema>

export const SystemPrerequisiteInputSchema = z.object({
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
})

export type SystemPrerequisiteInput = z.infer<typeof SystemPrerequisiteInputSchema>

export const SystemInputSchema = z.object({
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
})

export type SystemInput = z.infer<typeof SystemInputSchema>

export const UpcastFieldsInputSchema = z.object({
  __kind: z.literal('UpcastFieldsInput'),
  id: z.string().nullish(),
  size: z.number().nullish(),
  unit: z.string().nullish(),
  amount: z.number().int().nullish(),
  minRange: z.number().int().nullish(),
  maxRange: z.number().int().nullish(),
  distance: z.number().int().nullish(),
})

export type UpcastFieldsInput = z.infer<typeof UpcastFieldsInputSchema>

export const SetPerLevelInputSchema = z.object({
  __kind: z.literal('SetPerLevelInput'),
  level: z.string().nullish(),
  primary: z.number().int().nullish(),
  secondary: z.number().int().nullish(),
  bonus: z.number().int().nullish(),
})

export type SetPerLevelInput = z.infer<typeof SetPerLevelInputSchema>

export const DamagePoolInputSchema = z.object({
  __kind: z.literal('DamagePoolInput'),
  attribute: z.string().nullish(),
  setAmount: z.number().int().nullish(),
  multiplier: z.number().int().nullish(),
  minAmount: z.number().int().nullish(),
  maxAmount: z.number().int().nullish(),
  ability: z.string().nullish(),
  option: z.string().nullish(),
})

export type DamagePoolInput = z.infer<typeof DamagePoolInputSchema>

export const DamageFieldsInputSchema = z.lazy(() => z.object({
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
}))

export type DamageFieldsInput = z.infer<typeof DamageFieldsInputSchema>

export const DiePerLevelInputSchema = z.object({
  __kind: z.literal('DiePerLevelInput'),
  level: z.string().nullish(),
  primary: DamageFieldsInputSchema.nullish(),
  secondary: DamageFieldsInputSchema.nullish(),
  bonus: DamageFieldsInputSchema.nullish(),
})

export type DiePerLevelInput = z.infer<typeof DiePerLevelInputSchema>

export const DamageInputSchema = z.lazy(() => z.object({
  __kind: z.literal('DamageInput'),
  attributes: z.array(z.string()).nullish(),
  damageSave: z.array(z.string()).nullish(),
  setPerLevel: z.array(SetPerLevelInputSchema).nullish(),
  diePerLevel: z.array(DiePerLevelInputSchema).nullish(),
  primary: DamageFieldsInputSchema.nullish(),
  secondary: DamageFieldsInputSchema.nullish(),
  bonus: DamageFieldsInputSchema.nullish(),
  versatile: DamageFieldsInputSchema.nullish(),
}))

export type DamageInput = z.infer<typeof DamageInputSchema>

export const UpcastLevelInputSchema = z.object({
  __kind: z.literal('UpcastLevelInput'),
  level: z.number().int().nullish(),
  damage: DamageInputSchema.nullish(),
  duration: UpcastFieldsInputSchema.nullish(),
  range: UpcastFieldsInputSchema.nullish(),
  shape: UpcastFieldsInputSchema.nullish(),
  targets: z.number().int().nullish(),
})

export type UpcastLevelInput = z.infer<typeof UpcastLevelInputSchema>

export const UpcastInputSchema = z.object({
  __kind: z.literal('UpcastInput'),
  attributes: z.array(z.string()).nullish(),
  levels: z.array(UpcastLevelInputSchema.nullish()).nullish(),
})

export type UpcastInput = z.infer<typeof UpcastInputSchema>

export const ShapeInputSchema = z.lazy(() => z.object({
  __kind: z.literal('ShapeInput'),
  id: z.string(),
  size: z.number().nullish(),
  unit: z.string().nullish(),
}))

export type ShapeInput = z.infer<typeof ShapeInputSchema>

export const RangeInputSchema = z.lazy(() => z.object({
  __kind: z.literal('RangeInput'),
  id: z.string(),
  minRange: z.number().int().nullish(),
  maxRange: z.number().int().nullish(),
  distance: z.number().int().nullish(),
  unit: z.string().nullish(),
}))

export type RangeInput = z.infer<typeof RangeInputSchema>

export const DurationInputSchema = z.object({
  __kind: z.literal('DurationInput'),
  id: z.string(),
  amount: z.number().int().nullish(),
})

export type DurationInput = z.infer<typeof DurationInputSchema>

export const ActionPropertyInputSchema = z.object({
  __kind: z.literal('ActionPropertyInput'),
  id: z.string().nullish(),
  amount: z.number().int().nullish(),
})

export type ActionPropertyInput = z.infer<typeof ActionPropertyInputSchema>

export const ActionGroupInputSchema = z.lazy(() => z.object({
  __kind: z.literal('ActionGroupInput'),
  primary: ActionPropertyInputSchema.nullish(),
  secondary: ActionPropertyInputSchema.nullish(),
}))

export type ActionGroupInput = z.infer<typeof ActionGroupInputSchema>

export const SaveAbilityInputSchema = z.lazy(() => z.object({
  __kind: z.literal('SaveAbilityInput'),
  id: z.string(),
  minAmount: z.number().int().nullish(),
  attributes: z.array(z.string()).nullish(),
  abilityModifier: z.string().nullish(),
}))

export type SaveAbilityInput = z.infer<typeof SaveAbilityInputSchema>

export const SpellInputSchema = z.object({
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
})

export type SpellInput = z.infer<typeof SpellInputSchema>

export const UsesPerLevelInputSchema = z.object({
  __kind: z.literal('UsesPerLevelInput'),
  level: z.number().int().nullish(),
  uses: z.number().int().nullish(),
})

export type UsesPerLevelInput = z.infer<typeof UsesPerLevelInputSchema>

export const ChargeInputSchema = z.lazy(() => z.object({
  __kind: z.literal('ChargeInput'),
  reset: z.string().nullish(),
  limit: z.string().nullish(),
  ability: z.string().nullish(),
  skill: z.string().nullish(),
  usesPerLevel: z.array(UsesPerLevelInputSchema.nullish()).nullish(),
  minAmount: z.number().int().nullish(),
  addAmount: z.number().int().nullish(),
  setAmount: z.number().int().nullish(),
  multiplier: z.number().int().nullish(),
  resourcePoints: z.number().int().nullish(),
}))

export type ChargeInput = z.infer<typeof ChargeInputSchema>

export const OptionsByLevelInputSchema = z.object({
  __kind: z.literal('OptionsByLevelInput'),
  level: z.number().int().nullish(),
  count: z.number().int().nullish(),
  replaceCount: z.number().int().nullish(),
})

export type OptionsByLevelInput = z.infer<typeof OptionsByLevelInputSchema>

export const EquipPrerequisiteInputSchema = z.object({
  __kind: z.literal('EquipPrerequisiteInput'),
  numberEquipped: z.number().int().nullish(),
  category: z.string().nullish(),
  equipment: z.array(z.string()).nullish(),
  properties: z.array(z.string()).nullish(),
})

export type EquipPrerequisiteInput = z.infer<typeof EquipPrerequisiteInputSchema>

export const AbilityScoreInputSchema = z.object({
  __kind: z.literal('AbilityScoreInput'),
  abilities: z.array(z.string()).nullish(),
  score: z.number().int().nullish(),
})

export type AbilityScoreInput = z.infer<typeof AbilityScoreInputSchema>

export const PrerequisiteInputSchema = z.lazy(() => z.object({
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
}))

export type PrerequisiteInput = z.infer<typeof PrerequisiteInputSchema>

export const FeatureFeatInputSchema = z.lazy(() => z.object({
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
}))

export type FeatureFeatInput = z.infer<typeof FeatureFeatInputSchema>

export const ModifierDiePerLevelInputSchema = z.object({
  __kind: z.literal('ModifierDiePerLevelInput'),
  level: z.number().int(),
  dieConfig: z.string(),
})

export type ModifierDiePerLevelInput = z.infer<typeof ModifierDiePerLevelInputSchema>

export const ModifierSetPerLevelInputSchema = z.object({
  __kind: z.literal('ModifierSetPerLevelInput'),
  level: z.number().int(),
  setAmount: z.number().int(),
})

export type ModifierSetPerLevelInput = z.infer<typeof ModifierSetPerLevelInputSchema>

export const FeatureModifierInputSchema = z.lazy(() => z.object({
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
}))

export type FeatureModifierInput = z.infer<typeof FeatureModifierInputSchema>

export const ProficiencyPropertiesInputSchema = z.lazy(() => z.object({
  __kind: z.literal('ProficiencyPropertiesInput'),
  ids: z.array(z.string()).nullish(),
  category: z.string().nullish(),
  properties: z.array(z.string()).nullish(),
}))

export type ProficiencyPropertiesInput = z.infer<typeof ProficiencyPropertiesInputSchema>

export const FeatureProficiencyInputSchema = z.lazy(() => z.object({
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
}))

export type FeatureProficiencyInput = z.infer<typeof FeatureProficiencyInputSchema>

export const FeatureExpertiseInputSchema = z.lazy(() => z.object({
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
}))

export type FeatureExpertiseInput = z.infer<typeof FeatureExpertiseInputSchema>

export const FeatureSenseInputSchema = z.lazy(() => z.object({
  __kind: z.literal('FeatureSenseInput'),
  id: z.string(),
  attributes: z.array(z.string()).nullish(),
  selectionCount: z.number().int().nullish(),
  subtype: z.string().nullish(),
  ids: z.array(z.string()).nullish(),
  prerequisites: PrerequisiteInputSchema.nullish(),
  charges: ChargeInputSchema.nullish(),
  ownerId: z.string(),
  systemId: z.string(),
  masterId: z.string().nullish(),
}))

export type FeatureSenseInput = z.infer<typeof FeatureSenseInputSchema>

export const SpellsByLevelInputSchema = z.object({
  __kind: z.literal('SpellsByLevelInput'),
  id: z.string(),
  ids: z.array(z.string()).nullish(),
  level: z.number().int().nullish(),
  spellLevel: z.number().int().nullish(),
})

export type SpellsByLevelInput = z.infer<typeof SpellsByLevelInputSchema>

export const FeatureSpellInputSchema = z.lazy(() => z.object({
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
}))

export type FeatureSpellInput = z.infer<typeof FeatureSpellInputSchema>

export const FeatureOptionInputSchema = z.object({
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
  feats: z.array(FeatureFeatInputSchema).nullish(),
  modifiers: z.array(FeatureModifierInputSchema).nullish(),
  proficiencies: z.array(FeatureProficiencyInputSchema).nullish(),
  expertise: z.array(FeatureExpertiseInputSchema).nullish(),
  senses: z.array(FeatureSenseInputSchema).nullish(),
  spells: z.array(FeatureSpellInputSchema).nullish(),
  prerequisites: PrerequisiteInputSchema.nullish(),
  saveAbility: SaveAbilityInputSchema.nullish(),
  levelAvailable: z.string().nullish(),
  ownerId: z.string(),
  systemId: z.string(),
  masterId: z.string().nullish(),
})

export type FeatureOptionInput = z.infer<typeof FeatureOptionInputSchema>

export const FeatureInputSchema = z.lazy(() => z.object({
  __kind: z.literal('FeatureInput'),
  id: z.string(),
  label: z.string(),
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
  feats: z.array(FeatureFeatInputSchema).nullish(),
  modifiers: z.array(FeatureModifierInputSchema).nullish(),
  proficiencies: z.array(FeatureProficiencyInputSchema).nullish(),
  expertise: z.array(FeatureExpertiseInputSchema).nullish(),
  senses: z.array(FeatureSenseInputSchema).nullish(),
  spells: z.array(FeatureSpellInputSchema).nullish(),
  prerequisites: PrerequisiteInputSchema.nullish(),
  saveAbility: SaveAbilityInputSchema.nullish(),
  levelAvailable: z.string().nullish(),
  options: z.array(FeatureOptionInputSchema).nullish(),
  ownerId: z.string(),
  systemId: z.string(),
  masterId: z.string().nullish(),
}))

export type FeatureInput = z.infer<typeof FeatureInputSchema>

export const AncestryOptionInputSchema = z.object({
  __kind: z.literal('AncestryOptionInput'),
  id: z.string(),
  label: z.string(),
  desc: z.string().nullish(),
  features: z.array(FeatureInputSchema).nullish(),
  ownerId: z.string(),
  systemId: z.string(),
  masterId: z.string().nullish(),
})

export type AncestryOptionInput = z.infer<typeof AncestryOptionInputSchema>

export const AncestryInputSchema = z.object({
  __kind: z.literal('AncestryInput'),
  id: z.string(),
  label: z.string(),
  desc: z.string().nullish(),
  options: z.array(AncestryOptionInputSchema),
})

export type AncestryInput = z.infer<typeof AncestryInputSchema>

export const RaceSpeedInputSchema = z.object({
  __kind: z.literal('RaceSpeedInput'),
  walking: z.number().int().nullish(),
  swimming: z.number().int().nullish(),
  flying: z.number().int().nullish(),
  climbing: z.number().int().nullish(),
})

export type RaceSpeedInput = z.infer<typeof RaceSpeedInputSchema>

export const DetailInputSchema = z.lazy(() => z.object({
  __kind: z.literal('DetailInput'),
  label: z.string(),
  desc: z.string().nullish(),
}))

export type DetailInput = z.infer<typeof DetailInputSchema>

export const TraitsInputSchema = z.object({
  __kind: z.literal('TraitsInput'),
  details: z.array(DetailInputSchema).nullish(),
  size: z.string().nullish(),
  speeds: RaceSpeedInputSchema.nullish(),
})

export type TraitsInput = z.infer<typeof TraitsInputSchema>

export const RaceInputSchema = z.object({
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
  features: z.array(FeatureInputSchema).nullish(),
  ownerId: z.string().nullish(),
  systemId: z.string(),
  masterId: z.string().nullish(),
})

export type RaceInput = z.infer<typeof RaceInputSchema>

export const EquipmentCurrencyInputSchema = z.object({
  __kind: z.literal('EquipmentCurrencyInput'),
  id: z.string(),
  amount: z.number().int().nullish(),
})

export type EquipmentCurrencyInput = z.infer<typeof EquipmentCurrencyInputSchema>

export const EquipmentOptionItemInputSchema = z.lazy(() => z.object({
  __kind: z.literal('EquipmentOptionItemInput'),
  attributes: z.array(z.string()).nullish(),
  selectionCount: z.number().int().nullish(),
  category: z.string().nullish(),
  equipment: z.array(z.string()).nullish(),
  properties: z.array(z.string()).nullish(),
  quantity: z.number().int().nullish(),
  currencies: z.array(EquipmentCurrencyInputSchema).nullish(),
}))

export type EquipmentOptionItemInput = z.infer<typeof EquipmentOptionItemInputSchema>

export const FeatInputSchema = z.object({
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
  modifiers: z.array(FeatureModifierInputSchema).nullish(),
  proficiencies: z.array(FeatureProficiencyInputSchema).nullish(),
  expertise: z.array(FeatureExpertiseInputSchema).nullish(),
  senses: z.array(FeatureSenseInputSchema).nullish(),
  spells: z.array(FeatureSpellInputSchema).nullish(),
  prerequisites: PrerequisiteInputSchema.nullish(),
  saveAbility: SaveAbilityInputSchema.nullish(),
  selectionCount: z.number().int().nullish(),
  levelAvailable: z.string().nullish(),
  features: z.array(FeatureInputSchema).nullish(),
  ownerId: z.string(),
  systemId: z.string(),
  masterId: z.string().nullish(),
})

export type FeatInput = z.infer<typeof FeatInputSchema>

export const SpeedInputSchema = z.object({
  __kind: z.literal('SpeedInput'),
  amount: z.number().int().nullish(),
  unit: z.string(),
})

export type SpeedInput = z.infer<typeof SpeedInputSchema>

export const WeightInputSchema = z.object({
  __kind: z.literal('WeightInput'),
  amount: z.number().nullish(),
  unit: z.string(),
})

export type WeightInput = z.infer<typeof WeightInputSchema>

export const CapacityInputSchema = z.object({
  __kind: z.literal('CapacityInput'),
  amount: z.number().nullish(),
  unit: z.string(),
})

export type CapacityInput = z.infer<typeof CapacityInputSchema>

export const CostInputSchema = z.object({
  __kind: z.literal('CostInput'),
  amount: z.number().int().nullish(),
  currency: z.string(),
})

export type CostInput = z.infer<typeof CostInputSchema>

export const ContainsInputSchema = z.object({
  __kind: z.literal('ContainsInput'),
  id: z.string(),
  quantity: z.number().int(),
})

export type ContainsInput = z.infer<typeof ContainsInputSchema>

export const EquipmentRangeInputSchema = z.object({
  __kind: z.literal('EquipmentRangeInput'),
  minRange: z.number().int().nullish(),
  maxRange: z.number().int().nullish(),
  unit: z.string(),
})

export type EquipmentRangeInput = z.infer<typeof EquipmentRangeInputSchema>

export const EquipmentInputSchema = z.object({
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
  features: z.array(FeatureInputSchema).nullish(),
  ownerId: z.string(),
  systemId: z.string(),
  masterId: z.string().nullish(),
  rank: z.number().int().nullish(),
})

export type EquipmentInput = z.infer<typeof EquipmentInputSchema>

export const HitpointInputSchema = z.object({
  __kind: z.literal('HitpointInput'),
  ability: z.string(),
  dieConfig: z.string().nullish(),
})

export type HitpointInput = z.infer<typeof HitpointInputSchema>

export const StartingGoldInputSchema = z.object({
  __kind: z.literal('StartingGoldInput'),
  multiplier: z.number().int(),
  currency: z.string(),
  dieConfig: z.string().nullish(),
})

export type StartingGoldInput = z.infer<typeof StartingGoldInputSchema>

export const PrepareLimitLevelInputSchema = z.object({
  __kind: z.literal('PrepareLimitLevelInput'),
  measurement: z.string().nullish(),
  rounding: z.string().nullish(),
})

export type PrepareLimitLevelInput = z.infer<typeof PrepareLimitLevelInputSchema>

export const PrepareLimitInputSchema = z.object({
  __kind: z.literal('PrepareLimitInput'),
  methods: z.array(z.string()).nullish(),
  level: PrepareLimitLevelInputSchema.nullish(),
})

export type PrepareLimitInput = z.infer<typeof PrepareLimitInputSchema>

export const SpellcastingInputSchema = z.object({
  __kind: z.literal('SpellcastingInput'),
  magicName: z.string().nullish(),
  ability: z.string().nullish(),
  maxSpellLevel: z.number().int().nullish(),
  attributes: z.array(z.string()).nullish(),
  charges: ChargeInputSchema.nullish(),
  prepareLimit: PrepareLimitInputSchema.nullish(),
})

export type SpellcastingInput = z.infer<typeof SpellcastingInputSchema>

export const SpellSlotInputSchema = z.object({
  __kind: z.literal('SpellSlotInput'),
  slotCount: z.number().int().nullish(),
})

export type SpellSlotInput = z.infer<typeof SpellSlotInputSchema>

export const LevelAttributeInputSchema = z.object({
  __kind: z.literal('LevelAttributeInput'),
  level: z.number().int().nullish(),
  spellSlots: z.array(SpellSlotInputSchema).nullish(),
  resourcePoints: z.number().int().nullish(),
  spellsKnownLimit: z.number().int().nullish(),
  cantripsKnownLimit: z.number().int().nullish(),
})

export type LevelAttributeInput = z.infer<typeof LevelAttributeInputSchema>

export const ResourceInputSchema = z.object({
  __kind: z.literal('ResourceInput'),
  id: z.string(),
  label: z.string(),
  levelAvailable: z.number().int().nullish(),
  charges: ChargeInputSchema.nullish(),
  method: z.string().nullish(),
  desc: z.string().nullish(),
})

export type ResourceInput = z.infer<typeof ResourceInputSchema>

export const MulticlassAbilityInputSchema = z.object({
  __kind: z.literal('MulticlassAbilityInput'),
  id: z.string().nullish(),
  minAmount: z.number().int().nullish(),
})

export type MulticlassAbilityInput = z.infer<typeof MulticlassAbilityInputSchema>

export const ClassProficiencyInputSchema = z.lazy(() => z.object({
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
}))

export type ClassProficiencyInput = z.infer<typeof ClassProficiencyInputSchema>

export const MulticlassInputSchema = z.object({
  __kind: z.literal('MulticlassInput'),
  primaryAbility: MulticlassAbilityInputSchema.nullish(),
  secondaryAbility: MulticlassAbilityInputSchema.nullish(),
  optionalAbility: MulticlassAbilityInputSchema.nullish(),
  proficiencies: z.array(ClassProficiencyInputSchema).nullish(),
})

export type MulticlassInput = z.infer<typeof MulticlassInputSchema>

export const SubtypeInputSchema = z.object({
  __kind: z.literal('SubtypeInput'),
  id: z.string(),
  label: z.string(),
})

export type SubtypeInput = z.infer<typeof SubtypeInputSchema>

export const ClassInputSchema = z.object({
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
  features: z.array(FeatureInputSchema).nullish(),
  ownerId: z.string(),
  systemId: z.string(),
  masterId: z.string().nullish(),
})

export type ClassInput = z.infer<typeof ClassInputSchema>

export const CharacterModifierInputSchema = z.object({
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
})

export type CharacterModifierInput = z.infer<typeof CharacterModifierInputSchema>

export const CharacterSenseInputSchema = z.object({
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
})

export type CharacterSenseInput = z.infer<typeof CharacterSenseInputSchema>

export const CharacterFeatInputSchema = z.object({
  __kind: z.literal('CharacterFeatInput'),
  id: z.string(),
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
})

export type CharacterFeatInput = z.infer<typeof CharacterFeatInputSchema>

export const CharacterProficiencyInputSchema = z.object({
  __kind: z.literal('CharacterProficiencyInput'),
  id: z.string(),
  skill: z.string().nullish(),
  language: z.string().nullish(),
  saveAbility: z.string().nullish(),
  property: z.string().nullish(),
  equipment: z.string().nullish(),
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
})

export type CharacterProficiencyInput = z.infer<typeof CharacterProficiencyInputSchema>

export const CharacterExpertiseInputSchema = z.object({
  __kind: z.literal('CharacterExpertiseInput'),
  id: z.string(),
  skill: z.string().nullish(),
  language: z.string().nullish(),
  saveAbility: z.string().nullish(),
  property: z.string().nullish(),
  equipment: z.string().nullish(),
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
})

export type CharacterExpertiseInput = z.infer<typeof CharacterExpertiseInputSchema>

export const CharacterSpellInputSchema = z.object({
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
})

export type CharacterSpellInput = z.infer<typeof CharacterSpellInputSchema>

export const CharacterFeatureOptionInputSchema = z.object({
  __kind: z.literal('CharacterFeatureOptionInput'),
  id: z.string(),
  optionIndex: z.string(),
  featureLevel: z.number().int(),
})

export type CharacterFeatureOptionInput = z.infer<typeof CharacterFeatureOptionInputSchema>

export const CharacterFeatureInputSchema = z.object({
  __kind: z.literal('CharacterFeatureInput'),
  id: z.string(),
  options: z.array(CharacterFeatureOptionInputSchema).nullish(),
  classId: z.string().nullish(),
  raceId: z.string().nullish(),
  ancestryId: z.string().nullish(),
  equipmentId: z.string().nullish(),
  backgroundId: z.string().nullish(),
  featId: z.string().nullish(),
  level: z.number().int().nullish(),
})

export type CharacterFeatureInput = z.infer<typeof CharacterFeatureInputSchema>

export const RollInputSchema = z.object({
  __kind: z.literal('RollInput'),
  die: z.number().int(),
  value: z.number().int(),
  id: z.string().nullish(),
})

export type RollInput = z.infer<typeof RollInputSchema>

export const RollTypeInputSchema = z.object({
  __kind: z.literal('RollTypeInput'),
  score: z.number().int(),
  ability: z.string(),
  rolling: z.boolean(),
  applied: z.boolean(),
  rolled: z.array(RollInputSchema),
  kept: z.array(RollInputSchema).nullish(),
})

export type RollTypeInput = z.infer<typeof RollTypeInputSchema>

export const ManualInputSchema = z.object({
  __kind: z.literal('ManualInput'),
  ability: z.string().nullish(),
  score: z.number().int().nullish(),
})

export type ManualInput = z.infer<typeof ManualInputSchema>

export const ManualRolledInputSchema = z.object({
  __kind: z.literal('ManualRolledInput'),
  configuration: z.string(),
  rollGroups: z.array(z.array(RollTypeInputSchema)).nullish(),
  manual: z.array(ManualInputSchema).nullish(),
})

export type ManualRolledInput = z.infer<typeof ManualRolledInputSchema>

export const DistributedInputSchema = z.object({
  __kind: z.literal('DistributedInput'),
  ability: z.string(),
  id: z.string(),
})

export type DistributedInput = z.infer<typeof DistributedInputSchema>

export const PointBuyInputSchema = z.object({
  __kind: z.literal('PointBuyInput'),
  pointsLeft: z.number().int().nullish(),
  distributed: z.array(DistributedInputSchema).nullish(),
})

export type PointBuyInput = z.infer<typeof PointBuyInputSchema>

export const StandardArrayInputSchema = z.object({
  __kind: z.literal('StandardArrayInput'),
  ability: z.string().nullish(),
  score: z.string().nullish(),
})

export type StandardArrayInput = z.infer<typeof StandardArrayInputSchema>

export const ScoresInputSchema = z.object({
  __kind: z.literal('ScoresInput'),
  ability: z.string(),
  baseScore: z.number().int().nullish(),
  raceScore: z.number().int().nullish(),
  classScore: z.number().int().nullish(),
  calculatedScore: z.number().int().nullish(),
  modifierScore: z.number().int().nullish(),
})

export type ScoresInput = z.infer<typeof ScoresInputSchema>

export const CharacterAbilitiesInputSchema = z.object({
  __kind: z.literal('CharacterAbilitiesInput'),
  manualRolled: ManualRolledInputSchema.nullish(),
  pointBuy: PointBuyInputSchema.nullish(),
  standardArray: z.array(StandardArrayInputSchema).nullish(),
  selectedSystem: z.string().nullish(),
  scores: z.array(ScoresInputSchema).nullish(),
})

export type CharacterAbilitiesInput = z.infer<typeof CharacterAbilitiesInputSchema>

export const LineageInputSchema = z.object({
  __kind: z.literal('LineageInput'),
  id: z.string(),
  raceId: z.string(),
})

export type LineageInput = z.infer<typeof LineageInputSchema>

export const CharacterAncestryInputSchema = z.object({
  __kind: z.literal('CharacterAncestryInput'),
  id: z.string(),
  raceId: z.string(),
  lineage: z.array(LineageInputSchema).nullish(),
})

export type CharacterAncestryInput = z.infer<typeof CharacterAncestryInputSchema>

export const SubclassInputSchema = z.object({
  __kind: z.literal('SubclassInput'),
  id: z.string(),
  subtype: z.string().nullish(),
})

export type SubclassInput = z.infer<typeof SubclassInputSchema>

export const ClassSpellInputSchema = z.object({
  __kind: z.literal('ClassSpellInput'),
  id: z.string(),
  classId: z.string(),
  ability: z.string().nullish(),
  isRitual: z.boolean().nullish(),
  countAsKnown: z.boolean().nullish(),
  usesSlot: z.boolean().nullish(),
  alwaysPrepared: z.boolean().nullish(),
  castAtLevel: z.boolean().nullish(),
  requiresConcentration: z.boolean().nullish(),
  optionalAbility: z.boolean().nullish(),
})

export type ClassSpellInput = z.infer<typeof ClassSpellInputSchema>

export const ClassSpellListInputSchema = z.object({
  __kind: z.literal('ClassSpellListInput'),
  level: z.number().int(),
  spells: z.array(ClassSpellInputSchema).nullish(),
})

export type ClassSpellListInput = z.infer<typeof ClassSpellListInputSchema>

export const CharacterSpellSlotsInputSchema = z.object({
  __kind: z.literal('CharacterSpellSlotsInput'),
  level: z.number().int(),
  used: z.number().int(),
  classId: z.string(),
})

export type CharacterSpellSlotsInput = z.infer<typeof CharacterSpellSlotsInputSchema>

export const CharacterSpellcastingInputSchema = z.object({
  __kind: z.literal('CharacterSpellcastingInput'),
  prepared: z.array(ClassSpellListInputSchema).nullish(),
  known: z.array(ClassSpellListInputSchema).nullish(),
  additional: z.array(CharacterSpellInputSchema).nullish(),
  spellSlots: z.array(CharacterSpellSlotsInputSchema).nullish(),
})

export type CharacterSpellcastingInput = z.infer<typeof CharacterSpellcastingInputSchema>

export const CharacterClassInputSchema = z.object({
  __kind: z.literal('CharacterClassInput'),
  id: z.string(),
  subclass: SubclassInputSchema.nullish(),
  level: z.number().int(),
})

export type CharacterClassInput = z.infer<typeof CharacterClassInputSchema>

export const StartingEquipmentInputSchema = z.object({
  __kind: z.literal('StartingEquipmentInput'),
  id: z.string(),
  selectionId: z.string().nullish(),
  quantity: z.number().int(),
})

export type StartingEquipmentInput = z.infer<typeof StartingEquipmentInputSchema>

export const StartingEquipmentGroupInputSchema = z.lazy(() => z.object({
  __kind: z.literal('StartingEquipmentGroupInput'),
  optionId: z.string(),
  groupId: z.string(),
  equipment: z.array(StartingEquipmentInputSchema).nullish(),
}))

export type StartingEquipmentGroupInput = z.infer<typeof StartingEquipmentGroupInputSchema>

export const ClassStartingEquipmentInputSchema = z.object({
  __kind: z.literal('ClassStartingEquipmentInput'),
  option: z.string(),
  goldOption: z.string().nullish(),
  totalGold: z.number().int().nullish(),
  equipmentGroups: z.array(StartingEquipmentGroupInputSchema).nullish(),
  addedToCharacter: z.boolean().nullish(),
})

export type ClassStartingEquipmentInput = z.infer<typeof ClassStartingEquipmentInputSchema>

export const BackgroundStartingEquipmentInputSchema = z.object({
  __kind: z.literal('BackgroundStartingEquipmentInput'),
  equipmentGroups: z.array(StartingEquipmentGroupInputSchema).nullish(),
  addedToCharacter: z.boolean().nullish(),
})

export type BackgroundStartingEquipmentInput = z.infer<typeof BackgroundStartingEquipmentInputSchema>

export const PossessionsInputSchema = z.object({
  __kind: z.literal('PossessionsInput'),
  id: z.string(),
  label: z.string(),
  desc: z.string().nullish(),
})

export type PossessionsInput = z.infer<typeof PossessionsInputSchema>

export const CharacterCurrencyInputSchema = z.object({
  __kind: z.literal('CharacterCurrencyInput'),
  id: z.string(),
  amount: z.number().int(),
})

export type CharacterCurrencyInput = z.infer<typeof CharacterCurrencyInputSchema>

export const CurrencyGroupInputSchema = z.object({
  __kind: z.literal('CurrencyGroupInput'),
  currencies: z.array(CharacterCurrencyInputSchema).nullish(),
  container: z.string().nullish(),
})

export type CurrencyGroupInput = z.infer<typeof CurrencyGroupInputSchema>

export const HitpointRollValuesInputSchema = z.object({
  __kind: z.literal('HitpointRollValuesInput'),
  level: z.number().int(),
  value: z.number().int(),
})

export type HitpointRollValuesInput = z.infer<typeof HitpointRollValuesInputSchema>

export const HitpointRollInputSchema = z.object({
  __kind: z.literal('HitpointRollInput'),
  values: z.array(HitpointRollValuesInputSchema).nullish(),
  total: z.number().int().nullish(),
  current: z.number().int().nullish(),
})

export type HitpointRollInput = z.infer<typeof HitpointRollInputSchema>

export const HitpointFixedInputSchema = z.object({
  __kind: z.literal('HitpointFixedInput'),
  current: z.number().int().nullish(),
  total: z.number().int().nullish(),
})

export type HitpointFixedInput = z.infer<typeof HitpointFixedInputSchema>

export const CharacterHitpointInputSchema = z.object({
  __kind: z.literal('CharacterHitpointInput'),
  method: z.string(),
  maxOverride: z.number().int().nullish(),
  maxHitpoints: z.number().int().nullish(),
  temp: z.number().int().nullish(),
  bonus: z.number().int().nullish(),
  rolled: HitpointRollInputSchema.nullish(),
  fixed: HitpointFixedInputSchema.nullish(),
})

export type CharacterHitpointInput = z.infer<typeof CharacterHitpointInputSchema>

export const CharacterEquipmentObjectInputSchema = z.object({
  __kind: z.literal('CharacterEquipmentObjectInput'),
  id: z.string(),
  equipmentId: z.string(),
  quantity: z.number().int(),
  containerId: z.string().nullish(),
  containerPath: z.string().nullish(),
  customName: z.string().nullish(),
  notes: z.string().nullish(),
})

export type CharacterEquipmentObjectInput = z.infer<typeof CharacterEquipmentObjectInputSchema>

export const CharacterEquipmentInputSchema = z.object({
  __kind: z.literal('CharacterEquipmentInput'),
  equipped: z.array(z.string()).nullish(),
  attuned: z.array(z.string()).nullish(),
  inventory: z.array(CharacterEquipmentObjectInputSchema).nullish(),
})

export type CharacterEquipmentInput = z.infer<typeof CharacterEquipmentInputSchema>

export const CharacterInputSchema = z.object({
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
  equipment: CharacterEquipmentInputSchema.nullish(),
  currencyGroups: z.array(CurrencyGroupInputSchema).nullish(),
  features: z.array(CharacterFeatureInputSchema).nullish(),
  feats: z.array(CharacterFeatInputSchema).nullish(),
  proficiencies: z.array(CharacterProficiencyInputSchema).nullish(),
  expertise: z.array(CharacterExpertiseInputSchema).nullish(),
  modifiers: z.array(CharacterModifierInputSchema).nullish(),
  senses: z.array(CharacterSenseInputSchema).nullish(),
  ownerId: z.string(),
  systemId: z.string(),
})

export type CharacterInput = z.infer<typeof CharacterInputSchema>

export const BackgroundInputSchema = z.object({
  __kind: z.literal('BackgroundInput'),
  id: z.string(),
  label: z.string(),
  desc: z.string().nullish(),
  details: z.array(DetailInputSchema).nullish(),
  equipment: z.array(z.array(z.array(EquipmentOptionItemInputSchema))).nullish(),
  proficiencies: z.array(FeatureProficiencyInputSchema).nullish(),
  features: z.array(FeatureInputSchema).nullish(),
  ownerId: z.string(),
  systemId: z.string(),
  masterId: z.string().nullish(),
})

export type BackgroundInput = z.infer<typeof BackgroundInputSchema>

