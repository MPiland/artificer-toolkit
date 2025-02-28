import { ModifierCategories, ModifierSpellCategories } from '../types/enums'

const PWD_REGEX: RegExp = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/s
const USER_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEL_REGEX: RegExp = /^DELETE$/
const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
const CUR_REGEX = /^\d*\.?\d*$/
const DIE_REGEX = /^(\d+)d(4|6|8|10|12|20|100)?$/
const ROLL_CONFIG_REGEX = /^(\d+)d(4|6|8|10|12|20|100)(?:(kh|kl)(\d+))?(dh|dl)?(\d+)?(?:(r|ro)([><=])?(\d+))?$/

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

export const validate = (resetValidation: boolean = false): boolean => {
  if (resetValidation) {
    document.dispatchEvent(new CustomEvent('setErrorState', { detail: false }))
  }

  let isValid: boolean = true

  const requiredDropdowns: NodeListOf<Element> = document.querySelectorAll('[aria-required]')

  requiredDropdowns.forEach((element: Element) => {
    if (element && element.getAttribute('aria-required') === 'true') {
      let isValidDropdown: boolean
      if (element.hasAttribute('data-atapp-options')) {
        isValidDropdown = element.getAttribute('data-atapp-options') === 'true' ? true : false

        element.dispatchEvent(
          new CustomEvent('setErrorState', {
            detail: isValidDropdown ? false : true,
          })
        )
        isValid = isValid && isValidDropdown
      }
    }
  })

  const requiredInputs: NodeListOf<Element> = document.querySelectorAll('[required]')

  requiredInputs.forEach((element: Element) => {
    if (element) {
      let isValidInput: boolean

      const value: string = (element as HTMLInputElement).value
      const valid: boolean = value !== '' && element.hasAttribute('required')

      if (element.hasAttribute('data-atapp-validation')) {
        const validation: string | null = element.getAttribute('data-atapp-validation')

        isValidInput =
          valid &&
          ((validation === 'user' && USER_REGEX.test(value)) ||
            (validation === 'pwd' && PWD_REGEX.test(value)) ||
            (validation === 'del' && DEL_REGEX.test(value)) ||
            (validation === 'num' && NUM_REGEX.test(value)) ||
            (validation === 'cur' && CUR_REGEX.test(value)) ||
            (validation === 'die' && DIE_REGEX.test(value)) ||
            (validation === 'roll' && ROLL_CONFIG_REGEX.test(value)))

        element.dispatchEvent(
          new CustomEvent('setErrorState', {
            detail: isValidInput ? false : true,
          })
        )
        isValid = isValidInput && isValid
      } else {
        element.dispatchEvent(
          new CustomEvent('setErrorState', {
            detail: valid ? false : true,
          })
        )
        isValid = isValid && valid
      }
    }
  })

  return isValid
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
