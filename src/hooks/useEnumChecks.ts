import { Damage } from '../../amplify/gql/types'
import {
  Actions,
  Attributes,
  ChargesLimits,
  ChargesResets,
  EquipmentCategories,
  EquipmentProperties,
  Prerequisites,
} from '../types/enums'
import { FeatureDataType, FormDataType, SectionDataType } from '../types/form'

type EnumCheck = FormDataType | FeatureDataType | Damage | SectionDataType

export const useEnumChecks = ({ data }: { data?: EnumCheck }) => {
  if (!data) return {}
  // Attributes
  const isSpellcaster = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.spellcaster)
  const doesDamage = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.doesDamage)
  const canUpcast = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.canUpcast)
  const hasPrerequisites = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.prerequisites)
  const hasResourcePoints =
    'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.hasResourcePoints)
  const isAction = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.isAction)
  const requiresSave = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.requiresSave)
  const limitUse = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.limitUse)
  const primaryAbility = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.primaryAbility)
  const secondaryAbility =
    'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.secondaryAbility)
  const optionalAbility = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.optionalAbility)
  const appliesCondition =
    'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.appliesCondition)
  const stackable = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.stackable)
  const secondaryAction = 'attributes' in data && data?.attributes?.some((attr) => attr === Attributes.secondaryAction)
  const containsEquipment =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.containsEquipment)
  const hasRange = 'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.hasRange)
  const addAbilityModifier =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.addAbilityModifier)
  const limitTargets =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.limitTargets)
  const secondaryDamage =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.secondaryDamage)
  const bonusDamage =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.bonusDamage)
  const limitKnownSpells =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((attribute) => attribute === Attributes.limitKnownSpells)
  const magicName =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((attribute) => attribute === Attributes.magicName)
  const preparesSpells =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((attribute) => attribute === Attributes.preparesSpells)
  const usesSpellbook =
    'spellcasting' in data &&
    data.spellcasting != null &&
    'attributes' in data.spellcasting &&
    data?.spellcasting?.attributes?.some((attribute) => attribute === Attributes.usesSpellbook)
  const spellsByLevel =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.spellsByLevel)
  const classLimit = 'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.classLimit)
  const levelLimit = 'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.levelLimit)
  const attributeLimit =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.attributeLimit)
  const castAtLevel =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.castAtLevel)
  const subtypeSpecific =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.subtypeSpecific)
  const providesOptions =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.providesOptions)
  const selectCountByLevel =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.selectCountByLevel)
  const replaceAtLevel =
    'attributes' in data && data?.attributes?.some((attribute) => attribute === Attributes.replaceAtLevel)

  // Prerequisites
  const notEquipped =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.notEquipped)
  const equipped =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.equipped)
  const equipmentProficiency =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.equipmentProficiency)
  const abilityScore =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.abilityScore)
  const skillProficiency =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.skillProficiency)
  const notProficient =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.notProficient)
  const spellsObtained =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.spellsObtained)
  const optionsObtained =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.optionsObtained)
  const featuresObtained =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.featuresObtained)
  const characterSize =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.characterSize)

  // Equipment Categories
  const isWeapon = 'category' in data && data?.category === EquipmentCategories.weapon
  const isArmor = 'category' in data && data?.category === EquipmentCategories.armor
  const isShield = 'category' in data && data?.category === EquipmentCategories.shield
  const isAdventuringGear = 'category' in data && data?.category === EquipmentCategories.adventuringGear
  const isTool = 'category' in data && data?.category === EquipmentCategories.tool

  // Equipment Properties
  const isSpecial =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipmentProperties.special)
  const isHeavyArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipmentProperties.heavyArmor)
  const isMediumArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipmentProperties.mediumArmor)
  const isLightArmor =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipmentProperties.lightArmor)
  const isVersatile =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipmentProperties.versatile)
  const isTwoHanded =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipmentProperties.twoHanded)
  const isFinesse =
    'properties' in data && (data.properties as string[])?.some((prop) => prop === EquipmentProperties.finesse)

  // Charges Resets
  const resetsOnLongRest = 'reset' in data && data?.reset === ChargesResets.longRest
  const resetsOnShortRest = 'reset' in data && data?.reset === ChargesResets.shortRest
  const resetsManually = 'reset' in data && data?.reset === ChargesResets.manual

  // Charges Limits
  const limitByProficiency = 'limit' in data && data?.limit === ChargesLimits.proficiency
  const limitBySkill = 'limit' in data && data?.limit === ChargesLimits.skill
  const limitByAbilityMod = 'limit' in data && data?.limit === ChargesLimits.abilityScoreModifier
  const limitBySetAmount = 'limit' in data && data?.limit === ChargesLimits.setAmount
  const limitByPoolAmount = 'limit' in data && data?.limit === ChargesLimits.poolAmount
  const limitByResourcePoints = 'limit' in data && data?.limit === ChargesLimits.resourcePoints
  const limitBySetPerLevel = 'limit' in data && data?.limit === ChargesLimits.setPerLevel
  const limitByUsesPerLevel = 'limit' in data && data?.limit === ChargesLimits.usesPerLevel
  const limitByAbility = 'limit' in data && data?.limit === ChargesLimits.ability

  // Resources
  const resourceSetPerLevel = 'resource' in data && data?.resource?.method === Attributes.setPerLevel

  // Actions

  const specialPrimaryAction = 'actions' in data && data?.actions?.primary?.id === Actions.special
  const specialSecondaryAction = 'actions' in data && data?.actions?.secondary?.id === Actions.special

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
