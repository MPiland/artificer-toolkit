import { get, truncate } from 'lodash'

export const getValueFromState = (inputItem, stateItem, truncateNum) => {
  const shouldTruncate = !!truncateNum

  const processItem = (item, state, shouldTruncate) => {
    if (!item || !state) {
      return null
    }

    if (Array.isArray(item)) {
      const nestedValues = item.map((nestedItem) =>
        processItem(nestedItem, state, shouldTruncate)
      )
      if (nestedValues.every((valueItem) => valueItem == null)) {
        return null
      }
      const joinedValues = nestedValues
        .filter((valueItem) => valueItem != null)
        .join(' ')
      return joinedValues.length > 0 ? joinedValues : null
    } else {
      const value = get(state, item)
      if (value == null) {
        return null
      }
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return null
        } else if (value.length === 1) {
          const truncatedValue = shouldTruncate
            ? truncate(value[0].value, {
                length: truncateNum,
                omission: '',
              })
            : value[0].value
          return truncatedValue
        } else {
          const sortedValues = [...value]
          sortedValues.sort((a, b) =>
            a.value.toString().localeCompare(b.value.toString())
          )
          return sortedValues
            .map((nestedValue) =>
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
        return shouldTruncate ? truncate(value, { length: truncateNum }) : value
      }
    }
  }

  if (inputItem && inputItem.name) {
    const nameItems = Array.isArray(inputItem.name[0])
      ? inputItem.name
      : [inputItem.name]

    let finalValue = null

    nameItems.forEach((nameItem) => {
      const value = processItem(nameItem, stateItem, shouldTruncate)
      if (value != null) {
        finalValue = finalValue == null ? value : finalValue + ' / ' + value
      }
    })

    return finalValue != null ? finalValue : '---'
  }

  return '---'
}
