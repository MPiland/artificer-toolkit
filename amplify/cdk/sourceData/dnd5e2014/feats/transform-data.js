import fs from 'fs'

const TRANSFORMATION_TYPES = {
  REPLACE: 'replace',
  NEW_KEY: 'newKey',
  ELEVATE: 'elevate',
  ABSORB_KEY: 'absorbKey',
}

const outputPath = './feats.json'

const data = JSON.parse(fs.readFileSync('./featData.json', 'utf8'))

const mapping = {
  'requirement': {
    option: {
      replace: (obj) => findIdInLookup(obj.value, '../system/systemPrerequisites.json'),
    },
    newKey: 'prerequisites',
  },
  '*': {
    attribute: {
      replace: (obj) => findIdInLookup(obj.value, '../system/systemAttributes.json'),
      newKey: 'attributes',
    },
    ability: {
      replace: (obj) => findIdInLookup(obj.value, '../system/abilities.json'),
    },
  },
}

// Function to recursively find the ID in lookup data with caching
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

// Enhanced recursive transformation function
function transformData(data, mapping, parentKey = null) {
  if (Array.isArray(data)) {
    return data.map((item) => processObject(item, mapping, parentKey))
  } else if (typeof data === 'object' && data !== null) {
    return processObject(data, mapping, parentKey)
  }
  return data
}

const processObject = (data, mapping, parentKey = null) => {
  if (typeof data === 'object' && data !== null) {
    let transformedData = {}

    for (const key in data) {
      if (data[key] !== null) {
        let value = data[key]
        let keyMap = key

        // Apply specific mapping if exists
        const specificMapping = mapping[key]
        if (specificMapping) {
          if (Array.isArray(value)) {
            // Apply the mapping to each item in the array
            value = value.map((item) => applyTransformations(item, specificMapping))
          } else {
            value = applyTransformations(value, specificMapping)
          }
        }

        // Apply wildcard mapping if exists for this key
        const wildcardMapping = mapping['*']
        if (wildcardMapping && wildcardMapping[key]) {
          if (Array.isArray(value)) {
            // Apply the wildcard mapping to each item in the array
            value = value.map((item) => applyTransformations(item, wildcardMapping[key]))
          } else {
            value = applyTransformations(value, wildcardMapping[key])
          }
        }

        if (specificMapping && specificMapping?.newKey) {
          if (!specificMapping?.excludeParent?.includes(parentKey)) {
            if (typeof specificMapping.newKey === 'function') {
              keyMap = specificMapping.newKey(value)
            } else {
              keyMap = specificMapping.newKey
            }
          }
        } else if (wildcardMapping && wildcardMapping?.[key] && wildcardMapping[key]?.newKey) {
          if (!wildcardMapping?.[key]?.excludeParent?.includes(parentKey)) {
            if (typeof wildcardMapping[key].newKey === 'function') {
              keyMap = wildcardMapping[key].newKey(value)
            } else {
              keyMap = wildcardMapping[key].newKey
            }
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
          (specificMapping && specificMapping.moveTo) || (wildcardMapping && wildcardMapping[key]?.moveTo) || null

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

const applyTransformations = (field, mapping) => {
  if (field !== null) {
    let transformedItem = JSON.parse(JSON.stringify(field))

    // If mapping has a replace function, apply it
    if (mapping[TRANSFORMATION_TYPES.REPLACE]) {
      transformedItem = mapping[TRANSFORMATION_TYPES.REPLACE](transformedItem)
    } else {
      // If mapping is nested, process the field with this mapping
      transformedItem = transformData(transformedItem, mapping)
    }

    return transformedItem !== null ? transformedItem : field
  }
  return field
}

function moveKey(data, mapping) {
  if (Array.isArray(data)) {
    return data.map((item) => moveKey(item, mapping))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      const mappingKey = mapping[key] || mapping['*']
      if (mappingKey && mappingKey?.absorbKey) {
        if (!mappingKey?.excludeParent || !mappingKey?.excludeParent?.includes(key)) {
          const absorbKey = mappingKey.absorbKey(data[key])
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

const updateData = transformData(data, mapping)

fs.writeFileSync(outputPath, JSON.stringify(updateData, null, 2))
