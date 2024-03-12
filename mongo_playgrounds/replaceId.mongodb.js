/* global use, db, ObjectId */
use('ATdb')

function renameKey(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameKey(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'id') {
        if (data[key] !== null) {
          data._id = ObjectId(data[key])
        }
        delete data[key]
      } else if (typeof data[key] === 'object') {
        data[key] = renameKey(data[key]) // Recursive call for nested objects
      }
    }
  }
  return data
}

const collection = 'spells'

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
