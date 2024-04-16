/* global use, db, ObjectId */
use('ATdb')

function renameKey(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameKey(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'limitUse') {
        if (data[key].limitBy) {
          data.charge = { ...data.charge, limit: data[key].limitBy }
        }
        if (data[key].setValue) {
          data.charge = { ...data.charge, setValue: data[key].setValue }
        }
        if (data[key].charge) {
          data.charge = { ...data.charge, ...data[key].charge }
        }
      } else {
        renameKey(data[key])
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
