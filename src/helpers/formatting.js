import { get, truncate } from 'lodash'

export const getValueFromState = (inputItem, stateItem, truncateNum) => {
  const shouldTruncate = !truncateNum ? false : true

  const processItem = (item, state, shouldTruncate) => {
    if (!item || !state) {
      return '---'
    }

    if (Array.isArray(item)) {
      const nestedValues = item.map((nestedItem) =>
        processItem(nestedItem, state, shouldTruncate)
      )
      if (nestedValues.every((valueItem) => !valueItem || valueItem == null)) {
        return '---'
      }
      return nestedValues.join(' ')
    } else {
      const value = get(state, item)
      if (Array.isArray(value)) {
        if (value.length > 0) {
          if (value.length > 1) {
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
          } else {
            const truncatedValue = shouldTruncate
              ? truncate(value[0].value, {
                  length: truncateNum,
                  omission: '',
                })
              : value[0].value
            return truncatedValue
          }
        } else {
          return '---'
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
    return nameItems
      .map((nameItem) => {
        const value = processItem(nameItem, stateItem, shouldTruncate)
        return value != null ? value : '---'
      })
      .join(' / ')
  }

  return '---'
}
