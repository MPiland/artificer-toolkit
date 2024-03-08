/* global use, db */
use('ATdb')

function renameKey(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameKey(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'minRange') {
        data['range'] = {
          minRange: data['minRange'],
          maxRange: data['maxRange'],
        }
        delete data['minRange']
        delete data['maxRange']
      } else if (typeof data[key] === 'object') {
        data[key] = renameKey(data[key]) // Recursive call for nested objects
      }
    }
  }
  return data
}

const data = db.items.find().toArray()

const clearData = async (data) => {
  data = renameKey(data)
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: item },
    },
  }))
  await db.items.bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  clearData(data)
}
