/* global use, db */
use('ATdb')

function updateDataStructure(data) {
  if (Array.isArray(data)) {
    return data.map((item) => updateDataStructure(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'proficiency') {
        if (Array.isArray(data[key])) {
          data[key].map((keyItem) => {
            for (let keyField in keyItem) {
              if (keyItem[keyField] === 'item' || keyItem[keyField] === 'property') {
                if (keyItem[keyField].category && !Array.isArray(keyItem[keyField].category)) {
                  const categoryKeyItem = keyItem[keyField].category
                  keyItem[keyField].category = [{ ...categoryKeyItem }]
                }
              }
            }
          })
        }
      }
      if (typeof data[key] === 'object' && data[key] !== null) {
        data[key] = updateDataStructure(data[key])
      }
    }
  }
  return data
}

const collection = 'races'

const data = db[collection].find().toArray()

const clearData = async (data) => {
  data = updateDataStructure(data)
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
