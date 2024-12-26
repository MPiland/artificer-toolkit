import { ModifierCategories, ModifierSpellCategories } from '../types/enums'

const PWD_REGEX: RegExp = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/s
const USER_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEL_REGEX: RegExp = /^DELETE$/
const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
const CUR_REGEX = /^\d*\.?\d*$/

import { get, set } from 'lodash'

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
  return Object.keys(enumObject).find((key) => enumObject[key] === id)?.[0] as keyof T
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
            (validation === 'cur' && CUR_REGEX.test(value)))

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

export const excludeFields = (obj: any, ...fields: any) => {
  const newObj = { ...obj }
  fields.forEach((field: any) => {
    delete newObj[field]
  })
  return newObj
}

export const sectionData = ({
  section,
  sectionObject,
  item,
  itemType,
  system,
  feature,
}: {
  section: any
  sectionObject: any
  item: any
  itemType: 'race' | 'ancestry' | 'class'
  system: any
  feature?: any
}): { section: any; sectionObject: any; item: any; itemType: 'race' | 'ancestry' | 'class'; feature?: any } => {
  const sectionArray: any[] = []
  const categoryName = section?.category?.name

  if (categoryName && section[categoryName] != null) {
    if (section[categoryName]?.type?.length > 0) {
      const exist = get(sectionObject, categoryName)
      if (exist?.length > 0) {
        sectionArray.push(...exist)
      }

      const { _id, type, ...sectionFields } = section[categoryName]

      if (type?.some((oType: any) => oType.name === 'all')) {
        system[categoryName]?.type.forEach((oType: any) => {
          if (!sectionArray.some((sectionItem: any) => sectionItem._id === oType._id)) {
            const typeObject: any = { ...oType, [`${itemType}Id`]: item?._id, ...sectionFields, sectionId: _id }
            if (feature) {
              set(typeObject, 'featureId', feature?._id)
            }

            sectionArray.push(typeObject)
          }
        })
      } else {
        type?.forEach((oType: any) => {
          if (
            !sectionArray.some((sectionItem: any) => sectionItem.sectionId === _id && sectionItem._id === oType._id)
          ) {
            const typeObject: any = { ...oType, [`${itemType}Id`]: item?._id, ...sectionFields, sectionId: _id }
            if (feature) {
              set(typeObject, 'featureId', feature?._id)
            }

            sectionArray.push(typeObject)
          }
        })
      }

      if (sectionArray?.length > 0) {
        set(sectionObject, categoryName, sectionArray)
      }
    } else {
      const exist = sectionObject[categoryName]
      if (exist?.length > 0) {
        sectionArray.push(...exist)
      }

      if (
        !sectionArray.some(
          (arrayItem: any) => arrayItem._id === section[categoryName]?._id && arrayItem?.[`${itemType}Id`] === item?._id
        )
      ) {
        const typeObject: any = { ...section[categoryName], [`${itemType}Id`]: item?._id }
        if (feature) {
          set(typeObject, 'featureId', feature?._id)
        }

        sectionArray.push(typeObject)
        if (sectionArray?.length > 0) {
          set(sectionObject, categoryName, sectionArray)
        }
      }
    }
  }
  if (section.type?.length > 0) {
    const exist = sectionObject
    if (exist?.length > 0) {
      sectionArray.push(...exist)
    }
    section?.type?.map((oType: any) => {
      if (!sectionArray.some((section: any) => section._id === oType._id)) {
        const typeObject: any = { ...oType, [`${itemType}Id`]: item?._id, featureId: feature?._id }

        sectionArray.push(typeObject)
      }
    })

    sectionObject = [...sectionArray]
  }

  return sectionObject
}
