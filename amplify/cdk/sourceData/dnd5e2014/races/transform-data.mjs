import fs from 'fs'

const outputPath = './races.json'

const data = JSON.parse(fs.readFileSync('./raceData.json', 'utf8'))

const mapping = {
  'action': {
    newKey: 'primary',
    moveTo: 'actions',
  },
  'school': {
    replace: (obj) => findIdInLookup(obj.value, '../system/spellSchools.json'),
  },
  'requirement': {
    options: {
      replace: (obj) => findIdInLookup(obj?.value, '../system/systemPrerequisites.json'),
    },
    newKey: 'prerequisites',
  },
  'requirements': {
    options: {
      replace: (obj) => findIdInLookup(obj?.value, '../system/systemPrerequisites.json'),
    },
    newKey: 'prerequisites',
  },
  'prerequisites': {
    options: {
      replace: (obj) => findIdInLookup(obj?.value, '../system/systemPrerequisites.json'),
    },
  },
  'unit': {
    replace: (obj) => findIdInLookup(obj.value, '../system/rules.json'),
  },
  'charges': {
    limit: {
      replace: (obj) => findIdInLookup(obj.value, '../system/systemCharges.json'),
    },
    reset: {
      replace: (obj) => findIdInLookup(obj.value, '../system/systemCharges.json'),
    },
  },
  'playable': {
    replace: (obj) => obj.value,
  },
  'conditionSave': {
    replace: (obj) => findIdInLookup(obj.value, '../system/conditions.json'),
  },
  'detail': {
    newKey: 'details',
  },
  'size': {
    replace: (obj) => findIdInLookup(obj.value, '../system/sizes.json'),
  },
  'classLimit': {
    replace: (obj) => findIdInLookup(obj.value, ['../classes/base/classData.json', '../classes/sub/subclassData.json']),
  },
  'proficiencies': {
    level: {
      replace: (obj) => findIdInLookup(obj.value, '../system/proficiencyLevels.json'),
    },
    items: {
      newKey: 'equipment',
    },
  },
  'spells': {
    ability: {
      replace: (obj) => findIdInLookup(obj.value, '../system/abilities.json'),
    },
  },
  'spellsByLevel': {
    spells: {
      replace: (obj) => findIdInLookup(obj.value, '../spells/spellData.json'),
    },
    level: {
      replace: (obj) => {
        if (obj.value) {
          return Number(obj.value)
        } else {
          return obj
        }
      },
    },
  },
  'lineage': {
    replace: (obj) => findIdInLookup(obj.value, './raceData.json'),
  },
  'features': {
    modifier: {
      type: {
        replace: (obj) => findIdInLookup(obj.value, '../system/modifierTypes.json'),
      },
      newKey: 'modifiers',
    },
    spells: {
      newKey: 'featureSpells',
    },
    senses: {
      newKey: 'senses',
    },
    proficiencies: {
      level: {
        replace: (obj) => findIdInLookup(obj.value, '../system/proficiencyLevels.json'),
      },
      newKey: 'proficiencies',
    },
    expertise: {
      newKey: 'expertise',
    },
    feats: {
      newKey: 'feats',
    },
  },
  'options': {
    modifier: {
      type: {
        replace: (obj) => findIdInLookup(obj.value, '../system/modifierTypes.json'),
      },
      newKey: 'modifiers',
    },
    spell: {
      newKey: 'featureSpells',
    },
    sense: {
      newKey: 'senses',
    },
    proficiencies: {
      level: {
        replace: (obj) => findIdInLookup(obj.value, '../system/proficiencyLevels.json'),
      },
      newKey: 'proficiencies',
    },
    expertise: {
      newKey: 'expertise',
    },
    feats: {
      newKey: 'feats',
    },
  },
  'modifiers': {
    mode: {
      replace: (obj) => findIdInLookup(obj.value, '../system/modifierTypes.json'),
      newKey: 'type',
    },
    damage: {
      type: {
        replace: (obj) => {
          if (obj?.value === 'all' || obj?.value === 'matchWeapon') {
            return obj?.value
          }
          return findIdInLookup(obj.value, '../system/damageTypes.json')
        },
      },
      absorbKey: {
        key: (obj) => {
          for (const key in obj) {
            if (key.endsWith('id') || key.endsWith('ids')) {
              return key
            }
          }
        },
      },
      newKey: 'damageTypes',
    },
  },
  'ability': {
    replace: (obj) => findIdInLookup(obj.value, '../system/abilities.json'),
  },
  'items': {
    newKey: 'equipment',
  },
  'damage': {
    primary: {
      type: {
        replace: (obj) => {
          if (obj?.value === 'all' || obj?.value === 'matchWeapon') {
            return obj?.value
          }
          return findIdInLookup(obj.value, '../system/damageTypes.json')
        },
        newKey: 'id',
      },
    },
    secondary: {
      type: {
        replace: (obj) => {
          if (obj?.value === 'all' || obj?.value === 'matchWeapon') {
            return obj?.value
          }
          return findIdInLookup(obj.value, '../system/damageTypes.json')
        },
        newKey: 'id',
      },
    },
    bonus: {
      type: {
        replace: (obj) => {
          if (obj?.value === 'all' || obj?.value === 'matchWeapon') {
            return obj?.value
          }
          return findIdInLookup(obj.value, '../system/damageTypes.json')
        },
        newKey: 'id',
      },
    },
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
          '../system/spellShapes.json',
          '../system/equipmentProperties.json',
          '../equipment/equipmentData.json',
          '../system/modifierTypes.json',
          '../system/conditions.json',
          '../system/systemCategories.json',
          '../system/senses.json',
          '../system/damageTypes.json',
          '../system/spellRanges.json',
        ])
      },
      newKey: {
        fn: (obj) => (Array.isArray(obj) ? 'ids' : 'id'),
        excludeParent: ['modifiers'],
      },
    },
    category: {
      replace: (obj) =>
        findIdInLookup(obj.value, [
          '../system/equipmentCategories.json',
          '../system/modifierCategories.json',
          '../system/spellCategories.json',
          '../system/systemCategories.json',
          '../system/proficiencyCategories.json',
        ]),
    },
    method: {
      replace: (obj) => findIdInLookup(obj.value, ['../system/modifierMethods.json', '../system/systemCharges.json']),
    },
    attribute: {
      replace: (obj) => findIdInLookup(obj.value, '../system/systemAttributes.json'),
      newKey: {
        fn: () => 'attributes',
        excludeParent: ['primary'],
      },
    },
    levelLimit: {
      replace: (obj) => Number(obj.label),
    },
    absorbKey: {
      key: (obj) => {
        for (const key in obj) {
          if (key.endsWith('id') || key.endsWith('ids')) {
            return key
          }
        }
      },
      excludeParent: [
        'duration',
        'range',
        'shape',
        'saveAbility',
        'primary',
        'secondary',
        'bonus',
        'versatile',
        'equipment',
        'modifiers',
      ],
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
        const id = findIdInLookup(targetValue, path)
        if (id) return id
      }
    }
  } else {
    // 1. Create a cache on the function itself (if it doesn't exist)
    findIdInLookup.cache = findIdInLookup.cache || {}

    // 2. Check if the result for this file and targetValue is already cached
    if (findIdInLookup.cache[filepath]?.[targetValue]) {
      const cacheValue = findIdInLookup.cache[filepath][targetValue]
      return cacheValue
    }

    const lookupData = JSON.parse(fs.readFileSync(filepath, 'utf8'))

    // 3. Recursive call to find the ID (this is the core logic)
    const foundId = (function findId(data) {
      if (Array.isArray(data)) {
        for (const item of data) {
          const id = findId(item)
          if (id) return id
        }
      } else if (typeof data === 'object' && data !== null) {
        if (data.value === targetValue) {
          return data.id // Found a match!
        } else {
          for (const key in data) {
            const id = findId(data[key])
            if (id) return id
          }
        }
      }
      return null
    })(lookupData) // Immediately invoke the function with lookupData

    // 4. Cache the result for future lookups
    findIdInLookup.cache[filepath] = findIdInLookup.cache[filepath] || {}
    findIdInLookup.cache[filepath][targetValue] = foundId

    return foundId
  }
}

const processObject = (data, mapping, parentKey = null) => {
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

        // Apply specific mapping if exists
        const specificMapping = mapping[key]
        if (specificMapping) {
          if (Array.isArray(value)) {
            // Apply the mapping to each item in the array
            value = value.map((item) => replaceData(item, specificMapping))
          } else {
            value = replaceData(value, specificMapping)
          }
        }

        // Apply wildcard mapping if exists for this key
        const wildcardMapping = mapping['*']?.[key]
        if (wildcardMapping) {
          if (Array.isArray(value)) {
            // Apply the wildcard mapping to each item in the array
            value = value.map((item) => replaceData(item, wildcardMapping))
          } else {
            value = replaceData(value, wildcardMapping)
          }
        }

        if (specificMapping && specificMapping?.newKey) {
          if (typeof specificMapping.newKey === 'object') {
            if (!specificMapping?.newKey.excludeParent || !specificMapping?.newKey.excludeParent?.includes(parentKey)) {
              keyMap = specificMapping.newKey.fn(value)
            }
          } else {
            keyMap = specificMapping.newKey
          }
        } else if (wildcardMapping && wildcardMapping?.newKey) {
          if (typeof wildcardMapping.newKey === 'object') {
            if (!wildcardMapping?.newKey.excludeParent?.includes(parentKey)) {
              keyMap = wildcardMapping.newKey.fn(value)
            }
          } else {
            keyMap = wildcardMapping.newKey
          }
        }

        // Recursively process the value to apply mappings to nested properties
        if (Array.isArray(value)) {
          transformedData[keyMap] = value.map((item) => transformData(item, mapping, key))
        } else if (typeof value === 'object' && value !== null) {
          transformedData[keyMap] = transformData(value, mapping, key)
        } else {
          transformedData[keyMap] = value
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

function transformData(data, mapping, parentKey = null) {
  if (Array.isArray(data)) {
    return data.map((item) => processObject(item, mapping, parentKey))
  } else if (typeof data === 'object' && data !== null) {
    return processObject(data, mapping, parentKey)
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

function replaceData(data, mapping) {
  if (data == null) {
    return
  }

  let transformedValue = JSON.parse(JSON.stringify(data))

  if (mapping?.replace) {
    transformedValue = mapping.replace(transformedValue)
  } else {
    transformedValue = transformData(data, mapping)
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

const updateData = transformData(data, mapping)

fs.writeFileSync(outputPath, JSON.stringify(updateData, null, 2))
