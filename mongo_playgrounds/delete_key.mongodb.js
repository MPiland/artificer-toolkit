/* global use, db */
use('ATdb')

const collection = 'races'

const data = db[collection].find().toArray()

const clearData = async (data) => {
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $unset: { feature: [] } },
    },
  }))
  await db[collection].bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  clearData(data)
}
