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
import { FeatureDataType, FormDataType } from '../types/form'

export const useEnumChecks = ({ data }: { data: FormDataType | FeatureDataType | Damage }) => {
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

  // Prerequisites
  const notEquippedPrerequisite =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.notEquipped)
  const equippedPrerequisite =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.equipped)
  const equipmentProficiencyPrerequisite =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.equipmentProficiency)
  const abilityScorePrerequisite =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.abilityScore)
  const skillProficiencyPrerequisite =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.skillProficiency)
  const notProficientPrerequisite =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.notProficient)
  const spellsKnownPrerequisite =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.spellsKnown)
  const characterSizePrerequisite =
    'prerequisites' in data && data?.prerequisites?.options?.some((preq) => preq === Prerequisites.characterSize)

  // Equipment Categories
  const isWeapon = 'category' in data && data?.category === EquipmentCategories.weapon
  const isArmor = 'category' in data && data?.category === EquipmentCategories.armor
  const isShield = 'category' in data && data?.category === EquipmentCategories.shield
  const isAdventuringGear = 'category' in data && data?.category === EquipmentCategories.adventuringGear
  const isTool = 'category' in data && data?.category === EquipmentCategories.tool

  // Equipment Properties
  const isSpecial = 'properties' in data && data?.properties?.some((prop) => prop === EquipmentProperties.special)
  const isHeavyArmor = 'properties' in data && data?.properties?.some((prop) => prop === EquipmentProperties.heavyArmor)
  const isMediumArmor =
    'properties' in data && data?.properties?.some((prop) => prop === EquipmentProperties.mediumArmor)
  const isLightArmor = 'properties' in data && data?.properties?.some((prop) => prop === EquipmentProperties.lightArmor)
  const isVersatile = 'properties' in data && data?.properties?.some((prop) => prop === EquipmentProperties.versatile)
  const isTwoHanded = 'properties' in data && data?.properties?.some((prop) => prop === EquipmentProperties.twoHanded)
  const isFinesse = 'properties' in data && data?.properties?.some((prop) => prop === EquipmentProperties.finesse)

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

    // Prerequisites
    notEquippedPrerequisite,
    equippedPrerequisite,
    equipmentProficiencyPrerequisite,
    abilityScorePrerequisite,
    skillProficiencyPrerequisite,
    spellsKnownPrerequisite,
    characterSizePrerequisite,
    notProficientPrerequisite,

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
