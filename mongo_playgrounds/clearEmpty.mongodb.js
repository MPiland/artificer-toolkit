/* global use, db */

use('ATdb')

function clean(object) {
  // Identify keys to delete
  let keysToDelete = []
  Object.entries(object).forEach(([k, v]) => {
    if (v && typeof v === 'object') {
      clean(v)
      // If nested object is empty, mark key for deletion
      if (Object.keys(v).length === 0 && v.constructor === Object) {
        keysToDelete.push(k)
      }
    } else if (v === null || v === undefined) {
      // Mark key for deletion if value is null or undefined
      keysToDelete.push(k)
    }
  })

  // Delete marked keys
  keysToDelete.forEach((k) => {
    if (Array.isArray(object)) {
      object.splice(k, 1)
    } else {
      delete object[k]
    }
  })

  // Return modified object
  return object
}
const collection = 'spells'

const data = db[collection].find().toArray()

const clearData = async (data) => {
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: clean(item) },
    },
  }))
  await db[collection].bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  clearData(data)
}
