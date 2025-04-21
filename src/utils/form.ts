import {
  Background,
  Character,
  CharacterHitpoint,
  Class,
  Equipment,
  Feat,
  HitpointFixed,
  HitpointRoll,
  HitpointRollValues,
  Maybe,
  Race,
  Scores,
  Spell,
  System,
  type CharacterEquipmentObject,
} from '../../amplify/gql/types'
import { RollConfig } from '../types/components'
import { HitPointCalcMethod, ModifierCategories, ModifierSpellCategories } from '../types/enums'
import { FormDataType } from '../types/form'
import { parseDiceRoll } from './dice'
import { ToOptions, NavigateOptions } from '@tanstack/react-router'
import { FormType } from '../types/form'

const PWD_REGEX: RegExp = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/
const USER_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEL_REGEX: RegExp = /^DELETE$/
const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
const CUR_REGEX = /^\d*\.?\d*$/
const DIE_REGEX = /^(\d+)d(4|6|8|10|12|20|100)?$/
const ROLL_CONFIG_REGEX = /^(\d+)d(4|6|8|10|12|20|100)(?:(kh|kl)(\d+))?(dh|dl)?(\d+)?(?:(r|ro)([><=])?(\d+))?$/

export const stepArrayOptions = {
  id: [
    'details',
    'class',
    'race',
    'abilities',
    'traits',
    'attributes',
    'features',
    'contains',
    'proficiencies',
    'equipment',
    'startingEquipment',
    'ancestry',
    'background',
  ],
  label: [
    'Details',
    'Class',
    'Race',
    'Abilities',
    'Traits',
    'Attributes',
    'Features',
    'FeaturesContent',
    'Contains',
    'Proficiencies',
    'Equipment',
    'Starting Equipment',
    'Ancestry',
    'Background',
  ] as const,
}

function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

export function createFilterOptions<T>(
  items: Array<Maybe<T>> | undefined,
  getValue: (item: NonNullable<T>) => string,
  getLabel: (item: NonNullable<T>) => string,
  getId: (item: NonNullable<T>) => string
) {
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
  spells: 'spell',
  feats: 'feat',
  equipment: 'equipment',
  races: 'race',
  classes: 'class',
  backgrounds: 'background',
  characters: 'character',
}

export const navigatePath = ({
  form,
  type,
  action,
  id,
  label,
}: {
  form: FormType
  type: 'form' | 'view'
  action?: 'new' | 'edit'
  id?: string
  label?: string
}): {
  to: ToOptions['to']
  params: NavigateOptions['params']
  mask?: {
    to: ToOptions['to']
    params: NavigateOptions['params']
  }
} => {
  switch (form) {
    case 'spells': {
      switch (type) {
        case 'form': {
          return {
            to: `/${form}/$action/$_spellId`,
            params: {
              action: action,
              _spellId: label || undefined,
            },
            mask: {
              to: `/${form}/$action/$_spellId`,
              params: {
                action: action,
                _spellId: id || undefined,
              },
            },
          }
        }
        case 'view': {
          return {
            to: `/${form}/$spellId`,
            params: {
              spellId: label || undefined,
            },
            mask: {
              to: `/${form}/$spellId`,
              params: {
                spellId: id || undefined,
              },
            },
          }
        }
      }
      break
    }
    case 'feats': {
      switch (type) {
        case 'form': {
          return {
            to: `/${form}/$action/$_featId`,
            params: {
              action: action,
              _featId: label || undefined,
            },
            mask: {
              to: `/${form}/$action/$_featId`,
              params: {
                action: action,
                _featId: id || undefined,
              },
            },
          }
        }
        case 'view': {
          return {
            to: `/${form}/$featId`,
            params: {
              featId: label || undefined,
            },
            mask: {
              to: `/${form}/$featId`,
              params: {
                featId: id || undefined,
              },
            },
          }
        }
      }
      break
    }
    case 'equipment': {
      switch (type) {
        case 'form': {
          return {
            to: `/${form}/$action/$_equipmentId`,
            params: {
              action: action,
              _equipmentId: label || undefined,
            },
            mask: {
              to: `/${form}/$action/$_equipmentId`,
              params: {
                action: action,
                _equipmentId: id || undefined,
              },
            },
          }
        }
        case 'view': {
          return {
            to: `/${form}/$equipmentId`,
            params: {
              equipmentId: label || undefined,
            },
            mask: {
              to: `/${form}/$equipmentId`,
              params: {
                equipmentId: id || undefined,
              },
            },
          }
        }
      }
      break
    }
    case 'races': {
      switch (type) {
        case 'form': {
          return {
            to: `/${form}/$action/$_raceId`,
            params: {
              action: action,
              _raceId: label || undefined,
            },
            mask: {
              to: `/${form}/$action/$_raceId`,
              params: {
                action: action,
                _raceId: id || undefined,
              },
            },
          }
        }
        case 'view': {
          return {
            to: `/${form}/$raceId`,
            params: {
              raceId: label || undefined,
            },
            mask: {
              to: `/${form}/$raceId`,
              params: {
                raceId: id || undefined,
              },
            },
          }
        }
      }
      break
    }
    case 'classes': {
      switch (type) {
        case 'form': {
          return {
            to: `/${form}/$action/$_classId`,
            params: {
              action: action,
              _classId: label || undefined,
            },
            mask: {
              to: `/${form}/$action/$_classId`,
              params: {
                action: action,
                _classId: id || undefined,
              },
            },
          }
        }
        case 'view': {
          return {
            to: `/${form}/$classId`,
            params: {
              classId: label || undefined,
            },
            mask: {
              to: `/${form}/$classId`,
              params: {
                _classId: id || undefined,
              },
            },
          }
        }
      }
      break
    }
    case 'backgrounds': {
      switch (type) {
        case 'form': {
          return {
            to: `/${form}/$action/$_backgroundId`,
            params: {
              action: action,
              _backgroundId: id || undefined,
            },
            mask: {
              to: `/${form}/$action/$_backgroundId`,
              params: {
                action: action,
                _backgroundId: id || undefined,
              },
            },
          }
        }
        case 'view': {
          return {
            to: `/${form}/$backgroundId`,
            params: {
              backgroundId: label || undefined,
            },
            mask: {
              to: `/${form}/$backgroundId`,
              params: {
                backgroundId: id || undefined,
              },
            },
          }
        }
      }
      break
    }
    case 'characters': {
      switch (type) {
        case 'form': {
          return {
            to: `/${form}/$action/$_characterId`,
            params: {
              action: action,
              _characterId: label || undefined,
            },
            mask: {
              to: `/${form}/$action/$_characterId`,
              params: {
                action: action,
                _characterId: id || undefined,
              },
            },
          }
        }
        case 'view': {
          return {
            to: `/${form}/$characterId`,
            params: {
              characterId: label || undefined,
            },
            mask: {
              to: `/${form}/$characterId`,
              params: {
                characterId: id || undefined,
              },
            },
          }
        }
      }
      break
    }
    default: {
      return {
        to: '/',
        params: {},
      }
    }
  }
}

export const getModifierProperties = ({
  category,
}: {
  category: keyof typeof ModifierCategories | keyof typeof ModifierSpellCategories
}) => {
  switch (category) {
    case 'conditionSave':
    case 'conditions':
      return 'conditions'
    case 'unarmedDamage':
    case 'meleeDamage':
    case 'rangeDamage':
    case 'spellDamage':
    case 'damageSave':
    case 'damageTypes':
      return 'damageTypes'
    case 'speeds':
      return 'speeds'
    case 'spell':
      return 'spell'
    case 'saveAbilities':
      return 'saveAbilities'
    case 'abilityScores':
      return 'abilities'
    case 'spellRange':
      return 'range'
    case 'spellDuration':
      return 'duration'
    case 'spellShape':
      return 'shape'
  }
}

export const getKeyFromId = <T extends { [K in string]: string }>(id: string, enumObject: T): keyof T => {
  const name = Object.keys(enumObject).find((key) => enumObject[key] === id) as keyof T
  return name
}

export const validateForm = (resetValidation: boolean = false): { isValid: boolean; invalidFields: string[] } => {
  if (resetValidation) {
    document.dispatchEvent(new CustomEvent('setErrorState', { detail: false }))
  }

  const invalidFields: string[] = []

  // Validate required dropdowns
  const requiredDropdowns: NodeListOf<Element> = document.querySelectorAll('[aria-required]')
  requiredDropdowns.forEach((element: Element) => {
    if (element && element.getAttribute('aria-required') === 'true') {
      if (element.hasAttribute('data-atapp-options')) {
        const isValidDropdown = element.getAttribute('data-atapp-options') === 'true'

        element.dispatchEvent(
          new CustomEvent('setErrorState', {
            detail: !isValidDropdown,
          })
        )

        if (!isValidDropdown) {
          const name = element.getAttribute('name')
          if (name) invalidFields.push(name)
        }
      }
    }
  })

  // Validate required inputs
  const requiredInputs: NodeListOf<Element> = document.querySelectorAll('[required]')
  requiredInputs.forEach((element: Element) => {
    if (element) {
      const value: string = (element as HTMLInputElement).value
      const name = element.getAttribute('name')
      const isRequired = element.hasAttribute('required')
      let isValidInput = value !== '' && isRequired

      if (element.hasAttribute('data-atapp-validation')) {
        const validation: string | null = element.getAttribute('data-atapp-validation')

        if (isValidInput) {
          isValidInput =
            (validation === 'user' && USER_REGEX.test(value)) ||
            (validation === 'pwd' && PWD_REGEX.test(value)) ||
            (validation === 'del' && DEL_REGEX.test(value)) ||
            (validation === 'num' && NUM_REGEX.test(value)) ||
            (validation === 'cur' && CUR_REGEX.test(value)) ||
            (validation === 'die' && DIE_REGEX.test(value)) ||
            (validation === 'roll' && ROLL_CONFIG_REGEX.test(value))
        }
      }

      element.dispatchEvent(
        new CustomEvent('setErrorState', {
          detail: !isValidInput,
        })
      )

      if (!isValidInput && name) {
        invalidFields.push(name)
      }
    }
  })

  return {
    isValid: invalidFields.length === 0,
    invalidFields,
  }
}

export const calculateModifier = (score: number, type: 'bonus' | 'modifier') => {
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

export const calculateHitpoints = (formData: Character, primaryClass: Class) => {
  const abilityScore = formData?.abilities?.scores?.find(
    (score) => score.ability === primaryClass.hitpoint?.ability
  )?.calculatedScore
  // Set the character hitpoints
  const abilityModifierCalc = calculateModifier(abilityScore || 0, 'modifier')

  let abilityModifier: number = 0

  if (abilityModifierCalc !== '--') {
    abilityModifier = Number(abilityModifierCalc)
  }

  const hitpoint: CharacterHitpoint = {
    __typename: 'CharacterHitpoint',
    maxOverride: formData?.hitpoint?.maxOverride || null,
    method: formData?.hitpoint?.method || HitPointCalcMethod.manual,
    temp: formData?.hitpoint?.temp || null,
    bonus: formData?.hitpoint?.bonus || null,
    maxHitpoints: formData?.hitpoint?.maxHitpoints || null,
  }

  const { die = null } = parseDiceRoll(primaryClass?.hitpoint?.dieConfig as RollConfig) || {}
  const classLevel = formData?.classes?.[0]?.level

  if (classLevel && die) {
    let total: number = 0
    let maxHitpoints: number = 0
    const values: HitpointRollValues[] = []
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
      values.push({
        __typename: 'HitpointRollValues',
        level: i,
        value: levelValue,
      })
    }

    const rolled: HitpointRoll = {
      __typename: 'HitpointRoll',
      values: [...(formData?.hitpoint?.rolled?.values || [])],
      total: formData?.hitpoint?.rolled?.total || null,
      current: formData?.hitpoint?.rolled?.current || null,
    }

    const fixed: HitpointFixed = {
      __typename: 'HitpointFixed',
      current: formData?.hitpoint?.fixed?.current || null,
      total: formData?.hitpoint?.fixed?.total || null,
    }

    if (!rolled.values?.length) {
      rolled.values = values
    }

    if (rolled.values?.length < classLevel) {
      for (let i = rolled.values.length + 1; i <= classLevel; i++) {
        const levelValue = i === 1 ? die : Math.floor(die / 2) + 1
        rolled.values.push({
          __typename: 'HitpointRollValues',
          level: i,
          value: levelValue,
        })
      }
    }

    if (formData?.hitpoint?.method === HitPointCalcMethod.fixed) {
      maxHitpoints = total + Number(abilityModifier) * classLevel
      hitpoint.maxHitpoints = maxHitpoints + (formData?.hitpoint?.bonus || 0)
    }

    if (formData?.hitpoint?.method === HitPointCalcMethod.manual) {
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

export const createFormObject = (
  form: string,
  userId: string,
  systemId: string,
  category?: string,
  abilities?: System['abilities']
) => {
  switch (form) {
    case 'classes': {
      const classObject: Class = {
        id: '',
        ownerId: userId,
        systemId: systemId,
        label: '',
        value: '',
        category: category as string,
        __typename: 'Class',
      }
      return classObject
      break
    }
    case 'spells': {
      const spellObject: Spell = {
        id: '',
        ownerId: userId,
        systemId: systemId,
        label: '',
        value: '',
        school: '',
        level: 0,
        classes: [],
        range: {
          __typename: 'Range',
          id: '',
        },
        duration: {
          __typename: 'Duration',
          id: '',
        },
        __typename: 'Spell',
      }
      return spellObject
      break
    }
    case 'equipment': {
      const equipmentObject: Equipment = {
        id: '',
        ownerId: userId,
        systemId: systemId,
        label: '',
        value: '',
        category: '',
        __typename: 'Equipment',
        quantity: 0,
        rarity: '',
      }
      return equipmentObject
      break
    }
    case 'feats': {
      const featObject: Feat = {
        id: '',
        ownerId: userId,
        systemId: systemId,
        label: '',
        value: '',
        category: '',
        __typename: 'Feat',
      }
      return featObject
      break
    }
    case 'backgrounds': {
      const backgroundObject: Background = {
        id: '',
        ownerId: userId,
        systemId: systemId,
        label: '',
        value: '',
        __typename: 'Background',
      }
      return backgroundObject
      break
    }
    case 'characters': {
      const abilityScores: Array<Scores> = []
      abilities?.forEach((ability) => {
        if (ability) {
          abilityScores.push({
            __typename: 'Scores',
            ability: ability?.id,
            baseScore: 0,
            calculatedScore: 0,
            raceScore: 0,
            classScore: 0,
          })
        }
      })
      const characterObject: Character = {
        id: '',
        ownerId: userId,
        systemId: systemId,
        label: '',
        value: '',
        abilities: {
          __typename: 'CharacterAbilities',
          scores: abilityScores,
        },
        hitpoint: {
          __typename: 'CharacterHitpoint',
          maxHitpoints: undefined,
          maxOverride: undefined,
          method: '',
          temp: undefined,
          bonus: undefined,
          rolled: {
            __typename: 'HitpointRoll',
            values: [],
            total: undefined,
            current: undefined,
          },
          fixed: {
            __typename: 'HitpointFixed',
            total: undefined,
            current: undefined,
          },
        },
        __typename: 'Character',
        features: [],
        modifiers: [],
        proficiencies: [],
        feats: [],
        expertise: [],
        senses: [],
      }
      return characterObject
      break
    }
    case 'races': {
      const raceObject: Race = {
        id: '',
        ownerId: userId,
        systemId: systemId,
        label: '',
        value: '',
        category: category as string,
        playable: '',
        __typename: 'Race',
      }
      return raceObject
      break
    }
    default:
      return {}
  }
}

export const isEquipmentInInventory = (equipmentId: string, inventory: CharacterEquipmentObject[]): boolean => {
  if (!inventory || inventory.length === 0) return false

  // Check direct equipment IDs
  if (inventory.some((item) => item.id === equipmentId)) return true

  return false
}

export type SourcePropertyMapReturn = ReturnType<typeof sourcePropertyMap>

export const sourcePropertyMap = (data: Character) => ({
  classId: (id: string) =>
    data?.__typename === 'Character' && data?.classes?.some((c) => c.id === id || c.subclass?.id === id),
  raceId: (id: string) => data?.__typename === 'Character' && id === data?.race,
  ancestryId: (id: string) => data?.__typename === 'Character' && id === data?.ancestry?.id,
  featId: (id: string) => data?.__typename === 'Character' && data?.feats?.some((f) => f.featId === id),
  equipmentId: (id: string) =>
    data?.__typename === 'Character' && isEquipmentInInventory(id, data?.equipment?.inventory || []),
  backgroundId: (id: string) => data?.__typename === 'Character' && data?.background === id,
})

// Helper function to recursively remove __typename fields from a Spell object
export const removeTypename = <T extends FormDataType>(data: T): Omit<FormDataType, '__typename'> => {
  // Create a deep copy first
  const deepCopy = JSON.parse(JSON.stringify(data))

  // Function to recursively remove __typename
  function removeTypenameRecursive(obj: any) {
    if (!obj || typeof obj !== 'object') return

    // Delete __typename if it exists
    if ('__typename' in obj) {
      delete obj.__typename
    }

    // Process arrays
    if (Array.isArray(obj)) {
      obj.forEach((item) => {
        if (item && typeof item === 'object') {
          removeTypenameRecursive(item)
        }
      })
    } else {
      // Process object properties
      Object.values(obj).forEach((value) => {
        if (value && typeof value === 'object') {
          removeTypenameRecursive(value)
        }
      })
    }
  }

  // Remove __typename fields from the copy
  removeTypenameRecursive(deepCopy)

  // Return the cleaned object
  return deepCopy
}
