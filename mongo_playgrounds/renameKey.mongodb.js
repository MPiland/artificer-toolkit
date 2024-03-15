/* global use, db */
use('ATdb')

function renameKey(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameKey(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'proficiency' && Array.isArray(data[key])) {
        data[key].forEach((profObj) => {
          if (profObj.area && profObj.area.name === 'itemType') {
            profObj.area.name = 'item'
            profObj.area.value = 'Item'
          }
          if (profObj.itemType) {
            profObj.item = profObj.itemType
            delete profObj.itemType
          }
        })
      } else if (
        key === 'itemType' ||
        key === 'rangeType' ||
        key === 'shapeType' ||
        key === 'durationType' ||
        key === 'addPerLevel'
      ) {
        data['type'] = data[key]
        delete data[key]
      } else if (key === 'damageType') {
        data['primaryType'] = data[key]
        delete data[key]
      } else if (key === 'methodType') {
        data['option'] = data[key]
        delete data[key]
      } else if (key === 'secondaryDamageType') {
        data['secondaryType'] = data[key]
        delete data[key]
      } else if (typeof data[key] === 'object') {
        data[key] = renameKey(data[key]) // Recursive call for nested objects
      }
    }
  }
  return data
}

const collection = 'races'

const data = db[collection].find().toArray()

const clearData = async (data) => {
  data = renameKey(data)
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: item },
    },
  }))
  await db[collection].bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  clearData(data)
}
