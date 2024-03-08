/* global use, db */
use('ATdb')

function renameKey(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameKey(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'distance') {
        data['maxRange'] = data['distance']
        data['minRange'] = 5
        delete data['distance']
      } else if (typeof data[key] === 'object') {
        data[key] = renameKey(data[key]) // Recursive call for nested objects
      }
    }
  }
  return data
}

const data = db.spells.find().toArray()

const clearData = async (data) => {
  data = renameKey(data)
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: item },
    },
  }))
  await db.spells.bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  clearData(data)
}
