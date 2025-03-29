import { get, truncate } from 'lodash'
import { FormDataType, SectionName } from '../types/form'
import { ProficiencyCategories } from '../types/enums'

export const getValueFromState = ({
  input,
  state,
  getSourceData,
  truncateNum,
}: {
  input: any
  state: any
  getSourceData?: (sourceType: string) => any
  truncateNum?: number
}): string => {
  const shouldTruncate: boolean = !!truncateNum

  const flattenData = (obj: any): any[] => {
    const result: any[] = []

    const process = (item: any) => {
      if (Array.isArray(item)) {
        item.forEach((i) => process(i))
      } else if (typeof item === 'object' && item !== null) {
        if (item.id && item.value && item.label) {
          result.push(item)
        }
        Object.values(item).forEach((val) => process(val))
      }
    }

    process(obj)
    return result
  }

  const processItem = (item: any, state: any, shouldTruncate: boolean): string | null | undefined => {
    let label: any
    if (!item || !state) {
      return null
    }

    if (Array.isArray(item)) {
      const nestedValues: Array<string | null | undefined> = item.map((nestedItem: any) =>
        processItem(nestedItem, state, shouldTruncate)
      )
      if (nestedValues.every((valueItem) => valueItem == null)) {
        return null
      }
      const joinedValues = nestedValues.filter((value) => value != null).join(' ')
      return joinedValues.length > 0 ? joinedValues : null
    } else {
      if (typeof item === 'object' && item.path && item.source) {
        const value = get(state, item.path)
        if (!value) return null

        const sourceData = (getSourceData && getSourceData(item.source.type)) || null
        if (!sourceData) return null

        // If we have a field, look in that specific field of the source data
        const rawData = item.source.field ? get(sourceData, item.source.field) : sourceData

        let lookupData = rawData

        if (rawData && !Array.isArray(rawData)) {
          lookupData = flattenData(rawData)
        }

        if (Array.isArray(value)) {
          label = value
            .map((id) => {
              const data = lookupData?.find((lookupItem: any) => {
                return lookupItem.id === id
              })?.label

              return data
            })
            .filter(Boolean)
            .join(' / ')
        } else {
          label = lookupData?.find((item: any) => item.id === value)?.label || null
        }

        return label
      } else {
        label = get(state, item)
      }
      if (label == null) {
        return null
      }
      if (Array.isArray(label)) {
        if (label.length === 0) {
          return null
        } else if (label.length === 1) {
          const truncatedValue: string =
            shouldTruncate ?
              truncate(label[0], {
                length: truncateNum,
                omission: '',
              })
            : label[0]
          return truncatedValue
        } else {
          const sortedValues: Array<any> = [...label]
          sortedValues.sort((a: any, b: any) => {
            return a.toString().localeCompare(b.toString())
          })
          return sortedValues
            .map((nestedValue: any) =>
              shouldTruncate ?
                truncate(nestedValue.name, {
                  length: truncateNum,
                  omission: '',
                })
              : nestedValue.name
            )
            .join(' / ')
        }
      } else {
        if (label) {
          return shouldTruncate ? truncate(label, { length: truncateNum }) : label
        }
      }
    }
  }

  if (input && input.name) {
    const nameItems: Array<any> = Array.isArray(input.name[0]) ? input.name : [input.name]

    let finalValue: string | null = null

    nameItems.forEach((nameItem: any) => {
      const value: string | null | undefined = processItem(nameItem, state, shouldTruncate)
      if (value != null) {
        finalValue = finalValue == null ? value : finalValue + ' / ' + value
      }
    })

    return finalValue != null ? finalValue : '---'
  }

  return '---'
}

export const numberToWords = (number: number) => {
  const units = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  const teens = [
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ]
  const tens = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  if (number === 0) return 'zero'

  let result = ''

  // Handle billions
  if (Math.floor(number / 1000000000) > 0) {
    result += numberToWords(Math.floor(number / 1000000000)) + ' billion, '
    number %= 1000000000
  }

  // Handle millions
  if (Math.floor(number / 1000000) > 0) {
    result += numberToWords(Math.floor(number / 1000000)) + ' million, '
    number %= 1000000
  }

  // Handle thousands
  if (Math.floor(number / 1000) > 0) {
    result += numberToWords(Math.floor(number / 1000)) + ' thousand, '
    number %= 1000
  }

  // Handle hundreds
  if (Math.floor(number / 100) > 0) {
    result += numberToWords(Math.floor(number / 100)) + ' hundred '
    number %= 100
    if (number > 0) result += 'and '
  }

  if (number > 0) {
    if (result !== '') result += 'and '

    if (number < 10) result += units[number]
    else if (number < 20) result += teens[number - 10]
    else {
      result += tens[Math.floor(number / 10)]
      if (number % 10 > 0) result += '-' + units[number % 10]
    }
  }

  return result.trim().replace(/,$/, '')
}

export const routeRoot = (typename: FormDataType['__typename']) => {
  let routeString: string = ''
  switch (typename) {
    case 'Character':
      routeString = 'characters'
      break
    case 'Class':
      routeString = 'classes'
      break
    case 'Feat':
      routeString = 'feats'
      break
    case 'Equipment':
      routeString = 'equipment'
      break
    case 'Background':
      routeString = 'backgrounds'
      break
    case 'Race':
      routeString = 'races'
      break
    case 'Spell':
      routeString = 'spells'
      break
  }

  return routeString
}

export const sectionIdKey = (sectionStep: Exclude<SectionName, 'options'>) => {
  const idMap = {
    feats: 'featId',
    proficiencies: 'proficiencyId',
    expertise: 'expertiseId',
    modifiers: 'modifierId',
    senses: 'senseId',
    spells: 'spellId',
  } as const

  return idMap[sectionStep]
}

export const typenameMap = {
  feats: {
    typename: 'CharacterFeat',
    id: 'featId',
  },
  proficiencies: {
    typename: 'CharacterProficiency',
    id: 'proficiencyId',
  },
  expertise: {
    typename: 'CharacterExpertise',
    id: 'expertiseId',
  },
  modifiers: {
    typename: 'CharacterModifier',
    id: 'modifierId',
  },
  senses: {
    typename: 'CharacterSense',
    id: 'senseId',
  },
} as const

// Make the function generic to properly narrow the return type
export function typename<T extends keyof typeof typenameMap, P extends keyof (typeof typenameMap)[T]>(
  sectionStep: T,
  type: P
): (typeof typenameMap)[T][P] {
  return typenameMap[sectionStep][type]
}

export const proficiencyKey = (category: Exclude<keyof typeof ProficiencyCategories, 'initiative'>) => {
  switch (category) {
    case 'skills':
      return 'skill'
    case 'properties':
      return 'property'
    case 'languages':
      return 'language'
    case 'equipment':
      return 'equipment'
    case 'saveAbilities':
      return 'saveAbility'
  }
}
