import { get, truncate } from 'lodash'

export const getValueFromState = (
  inputItem: any,
  stateItem: any,
  truncateNum?: number
): string => {
  const shouldTruncate: boolean = !!truncateNum

  const processItem = (
    item: any,
    state: any,
    shouldTruncate: boolean
  ): string | null => {
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
      const joinedValues: string = nestedValues
        .filter((valueItem: string | null) => valueItem != null)
        .join(' ')
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
          sortedValues.sort((a: any, b: any) =>
            a.value.toString().localeCompare(b.value.toString())
          )
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
          return shouldTruncate
            ? truncate(value.value, { length: truncateNum })
            : value.value
        } else {
          return shouldTruncate
            ? truncate(value, { length: truncateNum })
            : value
        }
      }
    }
  }

  if (inputItem && inputItem.name) {
    const nameItems: Array<any> = Array.isArray(inputItem.name[0])
      ? inputItem.name
      : [inputItem.name]

    let finalValue: string | null = null

    nameItems.forEach((nameItem: any) => {
      const value: string | null = processItem(
        nameItem,
        stateItem,
        shouldTruncate
      )
      if (value != null) {
        finalValue = finalValue == null ? value : finalValue + ' / ' + value
      }
    })

    return finalValue != null ? finalValue : '---'
  }

  return '---'
}
