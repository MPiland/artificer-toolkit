/* global use, db */
use('ATdb')

function renameKey(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameKey(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'module') {
        data['category'] = data[key]
        delete data[key]
      } else if (key === 'modType') {
        data['type'] = data[key]
        delete data[key]
      } else if (typeof data[key] === 'object') {
        data[key] = renameKey(data[key]) // Recursive call for nested objects
      }
    }
  }
  return data
}

const collection = 'builders'

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
