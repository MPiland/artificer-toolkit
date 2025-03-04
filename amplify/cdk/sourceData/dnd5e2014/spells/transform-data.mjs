import fs from 'fs'

const outputPath = './spells.json'

const data = JSON.parse(fs.readFileSync('./spellData.json', 'utf8'))

const valueToIdCache = new Map()

const mapping = {
  'dieValue': {
    replace: (obj) => obj.value,
  },
  'amount': {
    replace: (obj) => Number(obj),
  },
  'setAmount': {
    replace: (obj) => Number(obj),
  },
  'maxAmount': {
    replace: (obj) => Number(obj),
  },
  'minAmount': {
    replace: (obj) => Number(obj),
  },
  'action': {
    newKey: 'primary',
    moveTo: 'actions',
  },
  'secondaryAction': {
    newKey: 'secondary',
    moveTo: 'actions',
  },
  'school': {
    replace: (obj) => findIdInLookup(obj.value, '../system/spellSchools.json'),
  },
  'requirements': {
    replace: (obj) => findIdInLookup(obj.value, '../system/spellRequirements.json'),
  },
  'unit': {
    replace: (obj) => findIdInLookup(obj.value, '../system/rules.json'),
  },
  'classes': {
    replace: (obj) => {
      if (obj.value === 'all') {
        return obj.value
      }
      return findIdInLookup(obj.value, ['../classes/base/classData.json', '../classes/sub/subclassData.json'])
    },
  },
  'subtypes': {
    replace: (obj) => {
      if (obj.value === 'all') {
        return obj.value
      }
      return findIdInLookup(obj.value, ['../classes/base/classData.json', '../classes/sub/subclassData.json'])
    },
  },
  'duration': {
    type: {
      replace: (obj) => findIdInLookup(obj.value, '../system/spellDurations.json'),
      newKey: 'id',
    },
  },
  'levelAttribute': {
    newKey: 'levels',
  },

  '*': {
    type: {
      replace: (obj) => {
        if (obj.value === 'all' || obj.value === 'matchWeapon') {
          return obj.value
        }
        if (typeof obj !== 'object') {
          return obj
        }
        return findIdInLookup(obj.value, [
          '../system/actions.json',
          '../system/abilities.json',
          '../system/skills.json',
          '../system/languages.json',
          '../system/conditions.json',
          '../system/speeds.json',
          '../system/modifierTypes.json',
          '../system/conditions.json',
          '../system/systemCategories.json',
          '../system/spellRanges.json',
          '../system/spellShapes.json',
          '../system/damageTypes.json',
          '../system/spellCategories.json',
          '../system/spellDurations.json',
        ])
      },
      newKey: {
        fn: (obj) => (Array.isArray(obj) ? 'ids' : 'id'),
        excludeParent: ['modifiers'],
      },
    },
    attribute: {
      replace: (obj) => {
        if (obj._id === null) {
          return obj.value
        }
        return findIdInLookup(obj.value, '../system/systemAttributes.json')
      },
      newKey: 'attributes',
    },
    absorbKey: {
      key: (obj) => {
        for (const key in obj) {
          if (key.endsWith('id') || key.endsWith('ids')) {
            return key
          }
        }
      },
      excludeParent: ['duration', 'range', 'shape', 'saveAbility', 'primary', 'secondary', 'bonus', 'versatile'],
    },
  },
}

const merge = [
  {
    targetKey: 'dieConfig',
    sourceKeys: ['dieCount', 'dieValue'],
    mergeFunction: (obj) => `${obj?.dieCount}d${obj?.dieValue.value}`,
  },
]

function findIdInLookup(targetValue, filepath) {
  if (Array.isArray(filepath)) {
    for (const path of filepath) {
      if (typeof path === 'string') {
        const cacheKey = `${path}:${targetValue}`
        if (valueToIdCache.has(cacheKey)) {
          return valueToIdCache.get(cacheKey)
        }

        const id = findIdInLookup(targetValue, path)
        if (id) {
          valueToIdCache.set(cacheKey, id)
          return id
        }
      }
    }
  } else {
    const cacheKey = `${filepath}:${targetValue}`
    if (valueToIdCache.has(cacheKey)) {
      return valueToIdCache.get(cacheKey)
    }

    const lookupData = JSON.parse(fs.readFileSync(filepath, 'utf8'))

    const foundId = (function findId(data) {
      if (Array.isArray(data)) {
        for (const item of data) {
          const id = findId(item)
          if (id) return id
        }
      } else if (typeof data === 'object' && data !== null) {
        if (data.value === targetValue && data.id) {
          valueToIdCache.set(cacheKey, data.id)
          return data.id
        }
        for (const key in data) {
          const id = findId(data[key])
          if (id) return id
        }
      }
      return null
    })(lookupData)

    return foundId
  }
}

const processData = (data, currentMapping = mapping, parentKey = null) => {
  if (Array.isArray(data)) {
    return data.map((item) => processData(item, mapping, parentKey))
  }
  if (typeof data === 'object' && data !== null) {
    let transformedData = {}

    for (const key in data) {
      if (data[key] !== null) {
        let value = data[key]
        let keyMap = key

        merge.forEach((mergeObj) => {
          if (Array.isArray(value)) {
            value = value.map((item) => {
              if (typeof item === 'object') {
                for (const objKey in item) {
                  if (mergeObj.sourceKeys.includes(objKey)) {
                    return mergeKeys(item, mergeObj)
                  }
                }
              }
              return item
            })
          } else {
            for (const objKey in value) {
              if (mergeObj.sourceKeys.includes(objKey)) {
                value = mergeKeys(value, mergeObj)
              }
            }
          }
        })

        // Recursively process the value to apply mappings to nested properties
        if (Array.isArray(value)) {
          transformedData[key] = value.map((item) => {
            if (Array.isArray(item)) {
              return item.map((subItem) => {
                if (Array.isArray(subItem)) {
                  return subItem.map((innerItem) => {
                    return processData(innerItem, currentMapping, key)
                  })
                } else {
                  return processData(subItem, currentMapping, key)
                }
              })
            } else {
              return processData(item, currentMapping, key)
            }
          })
        } else if (typeof value === 'object' && value !== null) {
          transformedData[key] = processData(value, currentMapping, key)
        } else {
          transformedData[key] = value
        }

        // Apply specific mapping if exists
        const specificMapping = currentMapping[key]
        if (specificMapping) {
          if (Array.isArray(transformedData[key])) {
            // Apply the mapping to each item in the array
            transformedData[key] = transformedData[key].map((item) => {
              return replaceKey(item, specificMapping, key)
            })
          } else {
            transformedData[key] = replaceKey(transformedData[key], specificMapping, key)
          }
        }

        // Apply wildcard mapping if exists for this key
        const wildcardMapping = mapping['*']?.[key]
        if (wildcardMapping) {
          if (Array.isArray(transformedData[key])) {
            transformedData[key] = transformedData[key].map((item) => {
              return replaceKey(item, wildcardMapping, key)
            })
          } else {
            transformedData[key] = replaceKey(transformedData[key], wildcardMapping, key)
          }
        }

        if (specificMapping && specificMapping?.newKey) {
          if (typeof specificMapping.newKey === 'object') {
            if (!specificMapping?.newKey.excludeParent || !specificMapping?.newKey.excludeParent?.includes(parentKey)) {
              keyMap = specificMapping.newKey.fn(transformedData[key])
            }
          } else {
            keyMap = specificMapping.newKey
          }
        } else if (wildcardMapping && wildcardMapping?.newKey) {
          if (typeof wildcardMapping.newKey === 'object') {
            if (!wildcardMapping?.newKey.excludeParent?.includes(parentKey)) {
              keyMap = wildcardMapping.newKey.fn(transformedData[key])
            }
          } else {
            keyMap = wildcardMapping.newKey
          }
        }

        if (keyMap !== key) {
          transformedData[keyMap] = transformedData[key]
          delete transformedData[key]
          if (currentMapping[keyMap] && typeof transformedData[keyMap] === 'object') {
            transformedData[keyMap] = processData(transformedData[keyMap], currentMapping, keyMap)
          }
        }

        const moveTo =
          (specificMapping && specificMapping.moveTo) || (wildcardMapping && wildcardMapping?.moveTo) || null

        if (moveTo) {
          // Create a nested object if it doesn't exist
          transformedData[moveTo] = transformedData[moveTo] || {}
          // Move the value to the nested object
          transformedData[moveTo][keyMap] = transformedData[keyMap]
          // Remove the original key
          delete transformedData[keyMap]
        }
      } else {
        transformedData[key] = data[key]
      }
    }

    transformedData = moveKey(transformedData, mapping)

    return transformedData
  }

  return data
}

function moveKey(data, mapping) {
  if (Array.isArray(data)) {
    return data.map((item) => moveKey(item, mapping))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      const mappingKey = mapping[key] || mapping['*']
      if (mappingKey && mappingKey?.absorbKey) {
        if (!mappingKey?.absorbKey?.excludeParent || !mappingKey?.absorbKey?.excludeParent?.includes(key)) {
          const absorbKey = mappingKey.absorbKey.key(data[key])
          if (absorbKey && data[key]?.[absorbKey] && Object.keys(data[key]).length === 1) {
            const newData = data[key][absorbKey]
            data[key] = newData
          }
        }
      } else if (mapping?.[key] && !mapping[key]?.elevate && !mapping[key]?.absorbKey) {
        for (let mapKey in mapping[key]) {
          const nestedKey = mapping[key][mapKey]
          const newKey = nestedKey.newKey || mapKey
          if (data[key]?.[newKey] && nestedKey.elevate) {
            data[newKey] = data[key]?.[newKey]
            delete data[key]?.[newKey]
            if (Object.keys(data[key]).length === 0) {
              delete data[key]
            }
          }
        }
      } else if (typeof data[key] === 'object') {
        data[key] = moveKey(data[key], mapping) // Recursive call for nested objects
      }
    }
    return data
  }
  return data
}

function replaceKey(data, mapping, parentKey = null) {
  if (data == null) {
    return
  }

  let transformedValue = JSON.parse(JSON.stringify(data))

  if (mapping?.replace) {
    transformedValue = mapping.replace(transformedValue)
  } else {
    transformedValue = processData(data, mapping, parentKey)
  }

  return transformedValue || data
}

function mergeKeys(data, mergeConfig) {
  const { targetKey, sourceKeys, mergeFunction } = mergeConfig
  const allKeysExist = sourceKeys.every((key) => {
    const keyParts = key.split('.')
    let value = data
    for (const part of keyParts) {
      if (!value || !value[part]) return false
      value = value[part]
    }
    return true
  })

  if (allKeysExist) {
    const mergedValue = mergeFunction(data)
    const result = { ...data, [targetKey]: mergedValue }
    sourceKeys.forEach((key) => delete result[key])

    return result
  }

  return data
}

const updateData = processData(data)

fs.writeFileSync(outputPath, JSON.stringify(updateData, null, 2))
