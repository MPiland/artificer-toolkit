const PWD_REGEX: RegExp = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,20}$/s
const USER_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEL_REGEX: RegExp = /^DELETE$/
const NUM_REGEX = /^(\d+)(, ?\d+)*(,)?$/
const CUR_REGEX = /^\d*\.?\d*$/

import { SectionOptionsType } from './types'
import { get, set, startCase } from 'lodash'

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

export const getSectionOptions = ({
  section,
  sectionName,
  feature,
  optionIndex,
  state,
  builders,
  spells,
  items,
  featureType,
  featureLevel,
}: SectionOptionsType): {
  categoryName: string
  options: any[]
  label: string
  inputPathName: string
  exist: any
} => {
  // Initiation section index used to set the section option index selected on the form state
  let sectionIndex: number = 0

  // Initiate the path name used to set the path to find and set the section option selected by user
  let pathName = ''

  // Initiate the options array to be populated the options for dropdown
  let options: any[] = []

  const categoryName: string = section?.category?.name

  if (categoryName) {
    //eslint-disable-next-line
    const { _id: _, type, properties, maxValue, ...sectionFields } = section[categoryName]

    pathName += `${sectionName}.${categoryName}`

    sectionIndex = state[sectionName]?.[categoryName]?.length ?? 0

    options = [...type]

    if (options.some((tItem: any) => tItem.name === 'all')) {
      if (categoryName === 'items') {
        if (items) {
          if (properties?.type?.length > 0) {
            options = items
              .filter((item: any) =>
                properties?.type?.some((pProperty: any) =>
                  item?.properties?.type?.some((iProperty: any) => iProperty._id === pProperty._id)
                )
              )
              .map((typeItem: any) => ({
                ...typeItem,
                sectionFields,
              }))
          }
        }
      }
      if (builders && builders[categoryName]?.type) {
        if (categoryName === 'abilities') {
          const stateValue = get(state, 'abilities.scores')

          //If modifier has a maxValue allowed, then filter out options that exceed that maxValue
          options = builders[categoryName]?.type
            .filter((ability: any) =>
              Array.isArray(stateValue) && stateValue.length > 0
                ? stateValue.some((stateAbility: any) => {
                    if (ability._id === stateAbility._id) {
                      if (maxValue) {
                        return stateAbility.calculatedScore < maxValue
                      } else {
                        return true
                      }
                    }
                    return false
                  })
                : ability
            )
            .map((ability: any) => {
              const abilityObject = {
                ...ability,
                method: section[categoryName].method,
                mode: section[categoryName].mode,
              }

              if (section[categoryName].method.name === 'setValue') {
                set(abilityObject, 'setValue', section[categoryName].setValue)
              }

              return abilityObject
            })
        } else if (sectionName === 'proficiencies') {
          options = builders[categoryName].type
            .filter((typeItem: any) =>
              state?.proficiencies?.[categoryName]?.length > 0
                ? !state?.proficiencies?.[categoryName]?.some(
                    (pItem: any) => pItem._id === typeItem._id && pItem.level.name === 'full'
                  )
                : typeItem
            )
            .map((typeItem: any) => ({
              ...typeItem,
              ...sectionFields,
            }))
        } else if (sectionName === 'expertise') {
          if (state?.proficiencies?.[categoryName]?.length > 0) {
            options = builders[categoryName].type
              .filter((typeItem: any) =>
                state?.proficiencies?.[categoryName]?.some(
                  (pItem: any) => pItem._id === typeItem._id && pItem.level.name === 'full'
                )
              )
              .map((typeItem: any) => ({
                ...typeItem,
                ...sectionFields,
              }))
          } else {
            options = []
          }
        } else {
          options = builders[categoryName].type.map((typeItem: any) => ({
            ...typeItem,
            ...sectionFields,
          }))
        }
      }
    } else {
      options = options.map((typeItem: any) => ({
        ...typeItem,
        ...sectionFields,
      }))

      if (sectionName === 'proficiencies') {
        options = options.filter((typeItem: any) =>
          state?.proficiencies?.[categoryName]?.length > 0
            ? !state?.proficiencies?.[categoryName]?.some(
                (pItem: any) => pItem._id === typeItem._id && pItem.level.name === 'full'
              )
            : typeItem
        )
      } else if (sectionName === 'expertise') {
        if (state?.proficiencies?.[categoryName]?.length > 0) {
          options = options.filter((typeItem: any) =>
            state?.proficiencies?.[categoryName]?.some(
              (pItem: any) => pItem._id === typeItem._id && pItem.level.name === 'full'
            )
          )
        } else {
          options = []
        }
      }
    }

    // Filter out spellAbility as an option for setting ability proficiencies
    if (categoryName === 'abilities') {
      options = options.filter((option: any) => option.name !== 'spellAbility')
    }
  } else {
    sectionIndex = state[sectionName]?.length > 0 ? state[sectionName]?.length : 0

    if (sectionName === 'options') {
      pathName += `features.${optionIndex}.${sectionName}`
      if (featureType) {
        if (featureType === 'class') {
          const classIndex = state.class.findIndex((uClass: any) => uClass._id === feature.classId)
          const featureIndex = state.class[classIndex]?.features?.findIndex((cFeature: any) => {
            if (cFeature._id === section._id) {
              if (featureLevel) {
                return cFeature.levelAvailable === featureLevel
              } else {
                return true
              }
            }
            return false
          })
          pathName = `class.${classIndex}.features.${featureIndex}.${sectionName}`

          sectionIndex = state.class[classIndex]?.features?.[featureIndex]?.options?.length ?? 0
        }
        if (featureType === 'race') {
          const featureIndex = state.race?.features?.findIndex((rFeature: any) => rFeature._id === section._id)

          pathName += `race.features.${featureIndex}.${sectionName}`

          if (featureIndex === -1) {
            pathName += `race.features.0.${sectionName}`
          }

          sectionIndex = state.race?.features?.findIndex((uFeature: any) => uFeature._id === feature._id)
        }
      }

      options = section?.options
    } else if (sectionName === 'spells' && spells) {
      const spellAbility = section.ability
      const isRitual = section.attribute?.some((attribute: any) => attribute.name === 'isRitual')
      const usesSlot = section.attribute?.some((attribute: any) => attribute.name === 'usesSlot')
      const isPrepared = section.attribute?.some((attribute: any) => attribute.name === 'isPrepared')
      const requiresConcentration = section.attribute?.some(
        (attribute: any) => attribute.name === 'requiresConcentration'
      )
      const castAtLevel = section.attribute?.some((attribute: any) => attribute.name === 'castAtLevel')
      const optionalAbility = section.attribute?.some((attribute: any) => attribute.name === 'optionalAbility')

      if (section?.type?.some((type: any) => type.name === 'all')) {
        options = spells.map((spell: any) => {
          const spellObject = {
            classes: spell.classes,
            name: spell.name,
            value: spell.value,
            _id: spell._id,
            level: spell.level,
            desc: spell.desc,
            isRitual,
            usesSlot,
            isPrepared,
            requiresConcentration,
            castAtLevel,
            optionalAbility,
          }
          if (spellAbility) {
            set(spellObject, 'ability', spellAbility)
          }
          return spellObject
        })
      }

      if (section.attribute?.some((attribute: any) => attribute.name === 'classLimit')) {
        options = options.filter((spell: any) =>
          spell.classes?.some((uClass: any) => section.classLimit?.some((lClass: any) => lClass._id === uClass._id))
        )
      }

      if (section.attribute?.some((attribute: any) => attribute.name === 'levelLimit')) {
        options = options.filter((spell: any) => String(section.levelLimit.value) === String(spell.level))
      }

      pathName = 'spellList.additional'

      if (featureType) {
        if (featureType === 'class') {
          let classIndex = state.class.findIndex((uClass: any) => uClass._id === feature.classId)

          if (classIndex === -1) {
            classIndex = state.class.findIndex((uClass: any) => uClass.subclass._id === feature.classId)
          }

          pathName = `class.${classIndex}.` + pathName
        }
      }
    } else {
      options = section?.type
      console.log({options})
      pathName += `${sectionName}`
    }
  }

  // Inject any other necessary fields into the options for useage in other logic
  options = options.map((option: any) => {
    const optionObject = { ...option, optionIndex: optionIndex }

    if (feature?.featureId) {
      set(optionObject, 'featureId', feature?._id)
    }
    if (featureType === 'race') {
      set(optionObject, 'raceId', feature?.raceId)
    }
    if (featureType === 'class') {
      set(optionObject, 'classId', feature?.classId)
    }

    return optionObject
  })

  // Creating dropdown label based on the category name and or section name
  let label = ''
  if (section?.category?.length === 1) {
    label = section?.category[0]?.value
  } else {
    label = section?.category?.value ?? startCase(sectionName)
  }

  // Find if array already has data populated on the form state
  const existArray: any[] = get(state, `${pathName}`) ?? []

  // Find the index of the existing item or else return -1
  const existIndex: number = existArray?.findIndex((formOption: any) => {
    return formOption?.optionIndex === optionIndex
  })

  // If there is an existing index, return the existing object otherwise return null
  const exist: any = existIndex !== -1 ? existArray?.[existIndex] : null

  // Complete the name for the event handler to pass to the reducer to update the form state
  // If it found an existing item, use the existing item index other wise use the next number after the last array item to populate the array with a selection
  const inputPathName: string = pathName + `.${exist ? existIndex : sectionIndex}`

  return { categoryName, options, label, inputPathName, exist }
}

export const sectionData = ({
  section,
  sectionObject,
  item,
  itemType,
  builders,
  feature,
}: {
  section: any
  sectionObject: any
  item: any
  itemType: 'race' | 'ancestry' | 'class'
  builders: any
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
        builders[categoryName]?.type.forEach((oType: any) => {
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

