import { Actions, Attributes, ChargesLimits, ChargesResets, EquipCats, EquipProps, Prerequisites } from '@/enums'

const useEnumChecks = () => {
  const getAttributes = ({ attributes }: { attributes: string[] }) => {
    const isSpellcaster = attributes?.some((attr) => attr === Attributes.SPELLCASTER)
    const doesDamage = attributes?.some((attr) => attr === Attributes.DOES_DAMAGE)
    const canUpcast = attributes?.some((attr) => attr === Attributes.CAN_UPCAST)
    const hasPrerequisites = attributes?.some((attr) => attr === Attributes.PREREQUISITES)
    const hasResourcePoints = attributes?.some((attr) => attr === Attributes.HAS_RESOURCE_POINTS)
    const isAction = attributes?.some((attr) => attr === Attributes.IS_ACTION)
    const requiresSave = attributes?.some((attr) => attr === Attributes.REQUIRES_SAVE)
    const limitUse = attributes?.some((attr) => attr === Attributes.LIMIT_USE)
    const primaryAbility = attributes?.some((attr) => attr === Attributes.PRIMARY_ABILITY)
    const secondaryAbility = attributes?.some((attr) => attr === Attributes.SECONDARY_ABILITY)
    const optionalAbility = attributes?.some((attr) => attr === Attributes.OPTIONAL_ABILITY)
    const appliesCondition = attributes?.some((attr) => attr === Attributes.APPLIES_CONDITION)
    const stackable = attributes?.some((attr) => attr === Attributes.STACKABLE)
    const secondaryAction = attributes?.some((attr) => attr === Attributes.SECONDARY_ACTION)
    const containsEquipment = attributes?.some((att) => att === Attributes.CONTAINS_EQUIPMENT)
    const hasRange = attributes?.some((att) => att === Attributes.HAS_RANGE)
    const addAbilityModifier = attributes?.some((att) => att === Attributes.ADD_ABILITY_MODIFIER)
    const limitTargets = attributes?.some((att) => att === Attributes.LIMIT_TARGETS)
    const secondaryDamage = attributes?.some((att) => att === Attributes.SECONDARY_DAMAGE)
    const bonusDamage = attributes?.some((att) => att === Attributes.BONUS_DAMAGE)
    const limitKnownSpells = attributes?.some((att) => att === Attributes.LIMIT_KNOWN_SPELLS)
    const magicName = attributes?.some((att) => att === Attributes.MAGIC_NAME)
    const preparesSpells = attributes?.some((att) => att === Attributes.PREPARES_SPELLS)
    const usesSpellbook = attributes?.some((att) => att === Attributes.USES_SPELLBOOK)
    const spellsByLevel = attributes?.some((att) => att === Attributes.SPELLS_BY_LEVEL)
    const classLimit = attributes?.some((att) => att === Attributes.CLASS_LIMIT)
    const levelLimit = attributes?.some((att) => att === Attributes.LEVEL_LIMIT)
    const attributeLimit = attributes?.some((att) => att === Attributes.ATTRIBUTE_LIMIT)
    const castAtLevel = attributes?.some((att) => att === Attributes.CAST_AT_LEVEL)
    const subtypeSpecific = attributes?.some((att) => att === Attributes.SUBTYPE_SPECIFIC)
    const providesOptions = attributes?.some((att) => att === Attributes.PROVIDES_OPTIONS)
    const selectCountByLevel = attributes?.some((att) => att === Attributes.SELECT_COUNT_BY_LEVEL)
    const replaceAtLevel = attributes?.some((att) => att === Attributes.REPLACE_AT_LEVEL)
    return {
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
    }
  }
  const getPrerequisites = ({ prerequisites }: { prerequisites: { options: string[] } }) => {
    const notEquipped = prerequisites?.options?.some((preq) => preq === Prerequisites.NOT_EQUIPPED)
    const equipped = prerequisites?.options?.some((preq) => preq === Prerequisites.EQUIPPED)
    const equipmentProficiency = prerequisites?.options?.some((preq) => preq === Prerequisites.EQUIPMENT_PROFICIENCY)
    const abilityScore = prerequisites?.options?.some((preq) => preq === Prerequisites.ABILITY_SCORE)
    const skillProficiency = prerequisites?.options?.some((preq) => preq === Prerequisites.SKILL_PROFICIENCY)
    const notProficient = prerequisites?.options?.some((preq) => preq === Prerequisites.NOT_PROFICIENT)
    const spellsObtained = prerequisites?.options?.some((preq) => preq === Prerequisites.SPELLS_OBTAINED)
    const optionsObtained = prerequisites?.options?.some((preq) => preq === Prerequisites.OPTIONS_OBTAINED)
    const featuresObtained = prerequisites?.options?.some((preq) => preq === Prerequisites.FEATURES_OBTAINED)
    const characterSize = prerequisites?.options?.some((preq) => preq === Prerequisites.CHARACTER_SIZE)

    return {
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
    }
  }

  const getEquipCategories = ({ category }: { category: string }) => {
    const isWeapon = category === EquipCats.WEAPON
    const isArmor = category === EquipCats.ARMOR
    const isShield = category === EquipCats.SHIELD
    const isAdventuringGear = category === EquipCats.ADVENTURING_GEAR
    const isTool = category === EquipCats.TOOL

    return {
      isWeapon,
      isArmor,
      isShield,
      isAdventuringGear,
      isTool,
    }
  }

  const getEquipProperties = ({ properties }: { properties: string[] }) => {
    const isSpecial = properties?.some((prop) => prop === EquipProps.SPECIAL)
    const isHeavyArmor = properties?.some((prop) => prop === EquipProps.HEAVY_ARMOR)
    const isMediumArmor = properties?.some((prop) => prop === EquipProps.MEDIUM_ARMOR)
    const isLightArmor = properties?.some((prop) => prop === EquipProps.LIGHT_ARMOR)
    const isVersatile = properties?.some((prop) => prop === EquipProps.VERSATILE)
    const isTwoHanded = properties?.some((prop) => prop === EquipProps.TWO_HANDED)
    const isFinesse = properties?.some((prop) => prop === EquipProps.FINESSE)

    return {
      isSpecial,
      isHeavyArmor,
      isMediumArmor,
      isLightArmor,
      isVersatile,
      isTwoHanded,
      isFinesse,
    }
  }

  const getChargeResets = ({ reset }: { reset: string }) => {
    const resetsOnLongRest = reset === ChargesResets.LONG_REST
    const resetsOnShortRest = reset === ChargesResets.SHORT_REST
    const resetsManually = reset === ChargesResets.MANUAL

    return {
      resetsOnLongRest,
      resetsOnShortRest,
      resetsManually,
    }
  }

  const getChargeLimits = ({ limit }: { limit: string }) => {
    const limitByProficiency = limit === ChargesLimits.PROFICIENCY
    const limitBySkill = limit === ChargesLimits.SKILL
    const limitByAbilityMod = limit === ChargesLimits.ABILITY_SCORE_MODIFIER
    const limitBySetAmount = limit === ChargesLimits.SET_AMOUNT
    const limitByPoolAmount = limit === ChargesLimits.POOL_AMOUNT
    const limitByResourcePoints = limit === ChargesLimits.RESOURCE_POINTS
    const limitBySetPerLevel = limit === ChargesLimits.SET_PER_LEVEL
    const limitByUsesPerLevel = limit === ChargesLimits.USES_PER_LEVEL
    const limitByAbility = limit === ChargesLimits.ABILITY

    return {
      limitByProficiency,
      limitBySkill,
      limitByAbilityMod,
      limitBySetAmount,
      limitByPoolAmount,
      limitByResourcePoints,
      limitBySetPerLevel,
      limitByUsesPerLevel,
      limitByAbility,
    }
  }

  const getResourceMethods = ({ method }: { method: string }) => {
    const resourceSetPerLevel = method === Attributes.SET_PER_LEVEL

    return { resourceSetPerLevel }
  }

  const getActions = ({ actions }: { actions: { primary: { id: string }; secondary: { id: string } } }) => {
    const specialPrimaryAction = actions?.primary?.id === Actions.SPECIAL
    const specialSecondaryAction = actions?.secondary?.id === Actions.SPECIAL

    return {
      specialPrimaryAction,
      specialSecondaryAction,
    }
  }

  return {
    getAttributes,
    getPrerequisites,
    getEquipCategories,
    getEquipProperties,
    getChargeResets,
    getChargeLimits,
    getResourceMethods,
    getActions,
  }
}

export default useEnumChecks
