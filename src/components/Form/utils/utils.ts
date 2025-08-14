import type {
  InputMaybe,
  Class,
  CharacterInput,
  CharacterHitpointInput,
  HitpointRollValuesInput,
  HitpointRollInput,
  HitpointFixedInput,
  CharacterEquipmentObjectInput,
  SystemAttribute,
} from '~/types'
import { parseDiceRoll } from '~/components/Dice'
import { HPCalcMethods, Spells, Attributes } from '~/enums'
import { camelCase } from 'lodash-es'
import { CamelCase } from 'type-fest'
import {
  CharacterHitpointInputSchema,
  HitpointFixedInputSchema,
  HitpointRollInputSchema,
  HitpointRollValuesInputSchema,
} from '~/schemas'

export const PWD_REGEX: RegExp = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/
export const USER_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const DEL_REGEX: RegExp = /^DELETE$/
export const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
export const CUR_REGEX = /^\d*\.?\d*$/
export const DIE_REGEX = /^(\d+)d(4|6|8|10|12|20|100)?$/
export const ROLL_CONFIG_REGEX =
  /(?<quantity>\d+)?(?:d(?<die>(4|6|8|10|12|20|100))?)?(?<keep>(?<keepType>(?:kl|kh))?(?<keepCount>\d+))?(?<drop>(?<dropType>(?:dl|dh))?(?<dropCount>\d+))?(?<reroll>(?<rerollType>(?:ro|r))?(?<rerollCondition>[<>])?(?<rerollValue>\d+)?)?/

export const SECTION_STEPS = ['modifiers', 'spells', 'proficiencies', 'expertise', 'senses', 'feats'] as const

function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

export const createFilterOptions = <T>(
  items: Array<InputMaybe<T>> | undefined,
  getValue: (item: NonNullable<T>) => string,
  getLabel: (item: NonNullable<T>) => string,
  getId: (item: NonNullable<T>) => string
): {
  value: string
  label: string
  id: string
}[] => {
  return (items || [])
    .filter(isNonNullable)
    .map((item) => ({
      value: getValue(item),
      label: getLabel(item),
      id: getId(item),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export const formSingularMap = {
  spells: 'SpellInput',
  feats: 'FeatInput',
  equipment: 'EquipmentInput',
  races: 'RaceInput',
  classes: 'ClassInput',
  backgrounds: 'BackgroundInput',
  characters: 'CharacterInput',
} as const

// This function now returns the key transformed into camelCase at runtime, while preserving type safety
export const getKeyFromId = <T extends Record<string, string>, K extends keyof T & string>(
  id: string,
  enumObject: T
): CamelCase<K> => {
  // Find the original key in snake_case
  const original = (Object.keys(enumObject) as K[]).find((k) => enumObject[k] === id)

  // Return the key transformed to camelCase (via runtime string replacement)
  const camelCaseKey = camelCase(original)
  return camelCaseKey as CamelCase<K>
}

export const calculateModifier = (score: number, type: 'bonus' | 'modifier'): string => {
  let scoreString: string = ''
  if (!score) {
    return '--'
  }
  if (type === 'bonus') {
    if (score > 0) {
      scoreString += '+'
    }
    if (score < 0) {
      scoreString += '-'
    }

    scoreString += `${score}`
  }
  if (type === 'modifier') {
    const subtracted = score - 10
    const modifier = Math.round(subtracted / 2)
    if (modifier > 0) {
      scoreString += '+'
    }
    if (modifier < 0) {
      scoreString += '-'
    }

    scoreString += `${Math.abs(modifier)}`
  }

  return scoreString
}

export const calculateHitpoints = (formData?: CharacterInput | null, primaryClass?: Class): CharacterHitpointInput | undefined => {
  if (!formData || !primaryClass) return
  const abilityScore = formData?.abilities?.scores?.find(
    (score) => score.ability === primaryClass?.hitpoint?.ability
  )?.calculatedScore
  // Set the Character hitpoints
  const abilityModifierCalc = calculateModifier(abilityScore || 0, 'modifier')

  let abilityModifier: number = 0

  if (abilityModifierCalc !== '--') {
    abilityModifier = Number(abilityModifierCalc)
  }

  const hitpoint: CharacterHitpointInput = CharacterHitpointInputSchema.parse({
    maxOverride: formData?.hitpoint?.maxOverride || null,
    method: formData?.hitpoint?.method || HPCalcMethods.MANUAL,
    temp: formData?.hitpoint?.temp || null,
    bonus: formData?.hitpoint?.bonus || null,
    maxHitpoints: formData?.hitpoint?.maxHitpoints || null,
  })

  const { die = null } = parseDiceRoll(primaryClass?.hitpoint?.dieConfig || '') || {}
  const classLevel = formData?.classes?.[0]?.level

  if (classLevel && die) {
    let total: number = 0
    let maxHitpoints: number = 0
    const values: HitpointRollValuesInput[] = []
    for (let i = 1; i <= classLevel; i++) {
      let levelValue
      if (i === 1) {
        // First level gets max die value
        levelValue = die
      } else {
        // Other levels get average
        levelValue = Math.floor(die / 2) + 1
      }

      total += levelValue
      maxHitpoints += levelValue + Number(abilityModifier)
      values.push(
        HitpointRollValuesInputSchema.parse({
          level: i,
          value: levelValue,
        })
      )
    }

    const rolled: HitpointRollInput = HitpointRollInputSchema.parse({
      values: [...(formData?.hitpoint?.rolled?.values || [])],
      total: formData?.hitpoint?.rolled?.total || null,
      current: formData?.hitpoint?.rolled?.current || null,
    })

    const fixed: HitpointFixedInput = HitpointFixedInputSchema.parse({
      current: formData?.hitpoint?.fixed?.current || null,
      total: formData?.hitpoint?.fixed?.total || null,
    })

    if (!rolled.values?.length) {
      rolled.values = values
    }

    if (rolled.values?.length < classLevel) {
      for (let i = rolled.values.length + 1; i <= classLevel; i++) {
        const levelValue = i === 1 ? die : Math.floor(die / 2) + 1
        rolled.values.push(
          HitpointRollValuesInputSchema.parse({
            level: i,
            value: levelValue,
          })
        )
      }
    }

    if (formData?.hitpoint?.method === HPCalcMethods.FIXED) {
      maxHitpoints = total + Number(abilityModifier) * classLevel
      hitpoint.maxHitpoints = maxHitpoints + (formData?.hitpoint?.bonus || 0)
    }

    if (formData?.hitpoint?.method === HPCalcMethods.MANUAL) {
      maxHitpoints = 0
      total = 0
      rolled.values?.forEach((value) => {
        total += value.value
        maxHitpoints += value.value + Number(abilityModifier)
      })

      rolled.total = total
      hitpoint.maxHitpoints = maxHitpoints + (formData?.hitpoint?.bonus || 0)
    }

    if (fixed.total === null || fixed.total === undefined) {
      fixed.total = total
    }

    if (fixed.current === null || fixed.current === undefined) {
      fixed.current = hitpoint.maxHitpoints
    }

    if (rolled.current === null || rolled.current === undefined) {
      rolled.current = hitpoint.maxHitpoints
    }

    hitpoint.rolled = rolled
    hitpoint.fixed = fixed

    if (formData?.hitpoint?.maxOverride !== null && formData?.hitpoint?.maxOverride !== undefined) {
      hitpoint.maxHitpoints = formData?.hitpoint?.maxOverride
    }
  }

  return hitpoint
}

export const isEquipmentInInventory = (equipmentId: string, inventory: CharacterEquipmentObjectInput[]): boolean => {
  if (!inventory || inventory.length === 0) return false

  // Check direct Equipment IDs
  if (inventory.some((item) => item.id === equipmentId)) return true

  return false
}

export const getUpcastOptions = ({
  systemAttributes,
  formAttributes,
  range,
  duration,
  shape,
}: {
  systemAttributes: SystemAttribute[]
  formAttributes: string[] | undefined | null
  range: string | undefined
  duration: string | undefined
  shape: string | undefined
}) => {
  const options = [
    ...systemAttributes.filter((attribute) => attribute?.spells?.length && attribute?.spells.includes(Spells.UPCAST)),
  ]

  if (!formAttributes?.some((attribute) => attribute === Attributes.DOES_DAMAGE)) {
    options.filter((option) => option.id !== Attributes.PRIMARY_DAMAGE)
  }

  if (!formAttributes?.some((attribute) => attribute === Attributes.PRIMARY_DAMAGE)) {
    options.filter((option) => option.id !== Attributes.SECONDARY_DAMAGE)
  }

  if (!formAttributes?.some((attribute) => attribute === Attributes.PRIMARY_DAMAGE)) {
    options.filter((option) => option.id !== Attributes.BONUS_DAMAGE)
  }

  if (!formAttributes?.some((attribute) => attribute === Attributes.LIMIT_TARGETS)) {
    options.filter((option) => option.id !== Attributes.TARGETS)
  }

  if (!range) {
    options.filter((option) => option.id !== Attributes.RANGE)
  }

  if (!shape) {
    options.filter((option) => option.id !== Attributes.SHAPE)
  }

  if (!duration) {
    options.filter((option) => option.id !== Attributes.DURATION)
  }

  return options
}
