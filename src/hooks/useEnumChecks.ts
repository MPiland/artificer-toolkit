import { FeatureDataType, FormDataType, SectionDataType, GQL, Enum } from '@/types'

type EnumCheck = FormDataType | FeatureDataType | GQL.Damage | SectionDataType

const useEnumChecks = ({ data }: { data?: EnumCheck }) => {
  if (!data) return {}
  // Attributes
  const isSpellcaster = 'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.spellcaster)
  const doesDamage = 'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.doesDamage)
  const canUpcast = 'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.canUpcast)
  const hasPrerequisites =
    'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.prerequisites)
  const hasResourcePoints =
    'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.hasResourcePoints)
  const isAction = 'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.isAction)
  const requiresSave = 'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.requiresSave)
  const limitUse = 'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.limitUse)
  const primaryAbility =
    'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.primaryAbility)
  const secondaryAbility =
    'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.secondaryAbility)
  const optionalAbility =
    'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.optionalAbility)
  const appliesCondition =
    'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.appliesCondition)
  const stackable = 'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.stackable)
  const secondaryAction =
    'attributes' in data && data?.attributes?.some((attr) => attr === Enum.Attributes.secondaryAction)
  const containsEquipment =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.containsEquipment)
  const hasRange = 'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.hasRange)
  const addAbilityModifier =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.addAbilityModifier)
  const limitTargets =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.limitTargets)
  const secondaryDamage =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.secondaryDamage)
  const bonusDamage =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.bonusDamage)
  const limitKnownSpells =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((attribute) => attribute === Enum.Attributes.limitKnownSpells)
  const magicName =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((attribute) => attribute === Enum.Attributes.magicName)
  const preparesSpells =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((attribute) => attribute === Enum.Attributes.preparesSpells)
  const usesSpellbook =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((attribute) => attribute === Enum.Attributes.usesSpellbook)
  const spellsByLevel =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.spellsByLevel)
  const classLimit =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.classLimit)
  const levelLimit =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.levelLimit)
  const attributeLimit =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.attributeLimit)
  const castAtLevel =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.castAtLevel)
  const subtypeSpecific =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.subtypeSpecific)
  const providesOptions =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.providesOptions)
  const selectCountByLevel =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.selectCountByLevel)
  const replaceAtLevel =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Enum.Attributes.replaceAtLevel)

  // Prerequisites
  const notEquipped =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.notEquipped)
  const equipped =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.equipped)
  const equipmentProficiency =
    'prerequisites' in data &&
    data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.equipmentProficiency)
  const abilityScore =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.abilityScore)
  const skillProficiency =
    'prerequisites' in data &&
    data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.skillProficiency)
  const notProficient =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.notProficient)
  const spellsObtained =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.spellsObtained)
  const optionsObtained =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.optionsObtained)
  const featuresObtained =
    'prerequisites' in data &&
    data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.featuresObtained)
  const characterSize =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Enum.Prerequisites.characterSize)

  // Equipment Categories
  const isWeapon = 'category' in data && data?.category === Enum.EquipmentCategories.weapon
  const isArmor = 'category' in data && data?.category === Enum.EquipmentCategories.armor
  const isShield = 'category' in data && data?.category === Enum.EquipmentCategories.shield
  const isAdventuringGear = 'category' in data && data?.category === Enum.EquipmentCategories.adventuringGear
  const isTool = 'category' in data && data?.category === Enum.EquipmentCategories.tool

  // Equipment Properties
  const isSpecial =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === Enum.EquipmentProperties.special)
  const isHeavyArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === Enum.EquipmentProperties.heavyArmor)
  const isMediumArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === Enum.EquipmentProperties.mediumArmor)
  const isLightArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === Enum.EquipmentProperties.lightArmor)
  const isVersatile =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === Enum.EquipmentProperties.versatile)
  const isTwoHanded =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === Enum.EquipmentProperties.twoHanded)
  const isFinesse =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === Enum.EquipmentProperties.finesse)

  // Charges Resets
  const resetsOnLongRest = 'reset' in data && data?.reset === Enum.ChargesResets.longRest
  const resetsOnShortRest = 'reset' in data && data?.reset === Enum.ChargesResets.shortRest
  const resetsManually = 'reset' in data && data?.reset === Enum.ChargesResets.manual

  // Charges Limits
  const limitByProficiency = 'limit' in data && data?.limit === Enum.ChargesLimits.proficiency
  const limitBySkill = 'limit' in data && data?.limit === Enum.ChargesLimits.skill
  const limitByAbilityMod = 'limit' in data && data?.limit === Enum.ChargesLimits.abilityScoreModifier
  const limitBySetAmount = 'limit' in data && data?.limit === Enum.ChargesLimits.setAmount
  const limitByPoolAmount = 'limit' in data && data?.limit === Enum.ChargesLimits.poolAmount
  const limitByResourcePoints = 'limit' in data && data?.limit === Enum.ChargesLimits.resourcePoints
  const limitBySetPerLevel = 'limit' in data && data?.limit === Enum.ChargesLimits.setPerLevel
  const limitByUsesPerLevel = 'limit' in data && data?.limit === Enum.ChargesLimits.usesPerLevel
  const limitByAbility = 'limit' in data && data?.limit === Enum.ChargesLimits.ability

  // Resources
  const resourceSetPerLevel = 'resource' in data && data?.resource?.method === Enum.Attributes.setPerLevel

  // Actions

  const specialPrimaryAction = 'actions' in data && data?.actions?.primary?.id === Enum.Actions.special
  const specialSecondaryAction = 'actions' in data && data?.actions?.secondary?.id === Enum.Actions.special

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
