import { FeatureDataType, FormDataType, SectionDataType, Damage } from '@/types'
import { Actions, Attributes, ChargesLimits, ChargesResets, EquipCats, EquipProps, Prerequisites } from '@/enums'

type EnumCheck = FormDataType | FeatureDataType | Damage | SectionDataType

const useEnumChecks = ({ data }: { data?: EnumCheck }) => {
  if (!data) return {}
  // Attributes
  const isSpellcaster = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.SPELLCASTER)
  const doesDamage = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.DOES_DAMAGE)
  const canUpcast = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.CAN_UPCAST)
  const hasPrerequisites = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.PREREQUISITES)
  const hasResourcePoints =
    'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.HAS_RESOURCE_POINTS)
  const isAction = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.IS_ACTION)
  const requiresSave = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.REQUIRES_SAVE)
  const limitUse = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.LIMIT_USE)
  const primaryAbility = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.PRIMARY_ABILITY)
  const secondaryAbility =
    'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.SECONDARY_ABILITY)
  const optionalAbility = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.OPTIONAL_ABILITY)
  const appliesCondition =
    'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.APPLIES_CONDITION)
  const stackable = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.STACKABLE)
  const secondaryAction = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.SECONDARY_ACTION)
  const containsEquipment =
    'attributes' in data && data?.attributes?.some((att) => att === Attributes.CONTAINS_EQUIPMENT)
  const hasRange = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.HAS_RANGE)
  const addAbilityModifier =
    'attributes' in data && data?.attributes?.some((att) => att === Attributes.ADD_ABILITY_MODIFIER)
  const limitTargets = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.LIMIT_TARGETS)
  const secondaryDamage = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.SECONDARY_DAMAGE)
  const bonusDamage = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.BONUS_DAMAGE)
  const limitKnownSpells =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((att) => att === Attributes.LIMIT_KNOWN_SPELLS)
  const magicName =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((att) => att === Attributes.MAGIC_NAME)
  const preparesSpells =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((att) => att === Attributes.PREPARES_SPELLS)
  const usesSpellbook =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((att) => att === Attributes.USES_SPELLBOOK)
  const spellsByLevel = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.SPELLS_BY_LEVEL)
  const classLimit = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.CLASS_LIMIT)
  const levelLimit = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.LEVEL_LIMIT)
  const attributeLimit = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.ATTRIBUTE_LIMIT)
  const castAtLevel = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.CAST_AT_LEVEL)
  const subtypeSpecific = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.SUBTYPE_SPECIFIC)
  const providesOptions = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.PROVIDES_OPTIONS)
  const selectCountByLevel =
    'attributes' in data && data?.attributes?.some((att) => att === Attributes.SELECT_COUNT_BY_LEVEL)
  const replaceAtLevel = 'attributes' in data && data?.attributes?.some((att) => att === Attributes.REPLACE_AT_LEVEL)

  // Prerequisites
  const notEquipped =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.NOT_EQUIPPED)
  const equipped =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.EQUIPPED)
  const equipmentProficiency =
    'prerequisites' in data &&
    data?.prerequisites?.options?.some((preq) => preq === Prerequisites.EQUIPMENT_PROFICIENCY)
  const abilityScore =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.ABILITY_SCORE)
  const skillProficiency =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.SKILL_PROFICIENCY)
  const notProficient =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.NOT_PROFICIENT)
  const spellsObtained =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.SPELLS_OBTAINED)
  const optionsObtained =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.OPTIONS_OBTAINED)
  const featuresObtained =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.FEATURES_OBTAINED)
  const characterSize =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.CHARACTER_SIZE)

  // Equipment Categories
  const isWeapon = 'category' in data && data?.category === EquipCats.WEAPON
  const isArmor = 'category' in data && data?.category === EquipCats.ARMOR
  const isShield = 'category' in data && data?.category === EquipCats.SHIELD
  const isAdventuringGear = 'category' in data && data?.category === EquipCats.ADVENTURING_GEAR
  const isTool = 'category' in data && data?.category === EquipCats.TOOL

  // Equipment Properties
  const isSpecial = 'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipProps.SPECIAL)
  const isHeavyArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipProps.HEAVY_ARMOR)
  const isMediumArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipProps.MEDIUM_ARMOR)
  const isLightArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipProps.LIGHT_ARMOR)
  const isVersatile =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipProps.VERSATILE)
  const isTwoHanded =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipProps.TWO_HANDED)
  const isFinesse = 'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipProps.FINESSE)

  // Charges Resets
  const resetsOnLongRest = 'reset' in data && data?.reset === ChargesResets.LONG_REST
  const resetsOnShortRest = 'reset' in data && data?.reset === ChargesResets.SHORT_REST
  const resetsManually = 'reset' in data && data?.reset === ChargesResets.MANUAL

  // Charges Limits
  const limitByProficiency = 'limit' in data && data?.limit === ChargesLimits.PROFICIENCY
  const limitBySkill = 'limit' in data && data?.limit === ChargesLimits.SKILL
  const limitByAbilityMod = 'limit' in data && data?.limit === ChargesLimits.ABILITY_SCORE_MODIFIER
  const limitBySetAmount = 'limit' in data && data?.limit === ChargesLimits.SET_AMOUNT
  const limitByPoolAmount = 'limit' in data && data?.limit === ChargesLimits.POOL_AMOUNT
  const limitByResourcePoints = 'limit' in data && data?.limit === ChargesLimits.RESOURCE_POINTS
  const limitBySetPerLevel = 'limit' in data && data?.limit === ChargesLimits.SET_PER_LEVEL
  const limitByUsesPerLevel = 'limit' in data && data?.limit === ChargesLimits.USES_PER_LEVEL
  const limitByAbility = 'limit' in data && data?.limit === ChargesLimits.ABILITY

  // Resources
  const resourceSetPerLevel = 'resource' in data && data?.resource?.method === Attributes.SET_PER_LEVEL

  // Actions
  const specialPrimaryAction = 'actions' in data && data?.actions?.primary?.id === Actions.SPECIAL
  const specialSecondaryAction = 'actions' in data && data?.actions?.secondary?.id === Actions.SPECIAL

  return {
    // Attributes
    isSpellcaster,
    doesDamage,
    canUpcast,
    hasPrerequisites,
    hasResourcePoints,
    isAction,
    requiresSave,
    limitUse,
    primaryAbility,
    secondaryAbility,
    optionalAbility,
    secondaryAction,
    appliesCondition,
    stackable,
    containsEquipment,
    hasRange,
    addAbilityModifier,
    limitTargets,
    bonusDamage,
    secondaryDamage,
    limitKnownSpells,
    spellsByLevel,
    levelLimit,
    attributeLimit,
    classLimit,
    castAtLevel,
    subtypeSpecific,
    providesOptions,
    magicName,
    preparesSpells,
    selectCountByLevel,
    replaceAtLevel,
    usesSpellbook,

    // Prerequisites
    notEquipped,
    equipped,
    equipmentProficiency,
    abilityScore,
    skillProficiency,
    spellsObtained,
    characterSize,
    notProficient,
    featuresObtained,
    optionsObtained,

    // Equipment Categories
    isWeapon,
    isArmor,
    isShield,
    isAdventuringGear,
    isTool,

    // Equipment Properties
    isSpecial,
    isHeavyArmor,
    isMediumArmor,
    isLightArmor,
    isVersatile,
    isTwoHanded,
    isFinesse,

    // Charges
    resetsOnLongRest,
    resetsOnShortRest,
    resetsManually,
    limitByProficiency,
    limitBySkill,
    limitByAbilityMod,
    limitBySetAmount,
    limitByPoolAmount,
    limitByResourcePoints,
    limitBySetPerLevel,
    limitByUsesPerLevel,
    limitByAbility,

    // Resources
    resourceSetPerLevel,

    // Actions
    specialPrimaryAction,
    specialSecondaryAction,
  }
}

export default useEnumChecks
