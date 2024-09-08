/* global use, db, ObjectId */
use('ATdb')

function updateObject(data) {
  if (Array.isArray(data)) {
    return data.map((item) => updateObject(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'currency') {
        if (data[key].type && !Array.isArray(data[key].type)) {
          const typeData = data[key].type
          data[key] = typeData
        }
      } else {
        data[key] = updateObject(data[key])
      }
    }
  }
  return data
}

const collection = 'items'

const data = db[collection].find().toArray()

const clearData = async (data) => {
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: updateObject(item) },
    },
  }))
  await db[collection].bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  clearData(data)
}
