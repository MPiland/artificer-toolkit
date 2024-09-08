/* global use, db */
use('ATdb')

function renameKey(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameKey(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'requirement') {
        data.requirements = data[key]
        delete data[key]
      } else {
        data[key] = renameKey(data[key])
      }
    }
  }
  return data
}

const collection = 'builders'

const data = db[collection].find().toArray()

const clearData = async (data) => {
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: renameKey(item) },
    },
  }))
  await db[collection].bulkWrite(bulkOperations)
  // const renamedData = renameKey(data)
  // await db.tests.insertMany(renamedData)
}

if (data) {
  clearData(data)
}
