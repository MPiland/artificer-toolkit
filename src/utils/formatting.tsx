import { get, truncate } from 'lodash'

export const getValueFromState = (inputItem: any, stateItem: any, truncateNum?: number): string => {
  const shouldTruncate: boolean = !!truncateNum

  const processItem = (item: any, state: any, shouldTruncate: boolean): string | null => {
    if (!item || !state) {
      return null
    }

    if (Array.isArray(item)) {
      const nestedValues: Array<string | null> = item.map((nestedItem: any) =>
        processItem(nestedItem, state, shouldTruncate)
      )
      if (nestedValues.every((valueItem: string | null) => valueItem == null)) {
        return null
      }
      const joinedValues: string = nestedValues.filter((valueItem: string | null) => valueItem != null).join(' ')
      return joinedValues.length > 0 ? joinedValues : null
    } else {
      const value: any = get(state, item)
      if (value == null) {
        return null
      }
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return null
        } else if (value.length === 1) {
          const truncatedValue: string = shouldTruncate
            ? truncate(value[0].value, {
                length: truncateNum,
                omission: '',
              })
            : value[0].value
          return truncatedValue
        } else {
          const sortedValues: Array<any> = [...value]
          sortedValues.sort((a: any, b: any) => a.value.toString().localeCompare(b.value.toString()))
          return sortedValues
            .map((nestedValue: any) =>
              shouldTruncate
                ? truncate(nestedValue.value, {
                    length: truncateNum,
                    omission: '',
                  })
                : nestedValue.value
            )
            .join(' / ')
        }
      } else {
        if (value.value) {
          return shouldTruncate ? truncate(value.value, { length: truncateNum }) : value.value
        } else {
          return shouldTruncate ? truncate(value, { length: truncateNum }) : value
        }
      }
    }
  }

  if (inputItem && inputItem.name) {
    const nameItems: Array<any> = Array.isArray(inputItem.name[0]) ? inputItem.name : [inputItem.name]

    let finalValue: string | null = null

    nameItems.forEach((nameItem: any) => {
      const value: string | null = processItem(nameItem, stateItem, shouldTruncate)
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

export const titleText = (title: string) => {
  let titleText: string = ''
  switch (title) {
    case 'characters':
      titleText = 'character'
      break
    case 'classes':
      titleText = 'class'
      break
    case 'feats':
      titleText = 'feat'
      break
    case 'items':
      titleText = 'item'
      break
    case 'backgrounds':
      titleText = 'background'
      break
    case 'races':
      titleText = 'race'
      break
    case 'spells':
      titleText = 'spell'
      break
    case 'options':
      titleText = 'option'
      break
  }

  return titleText
}
