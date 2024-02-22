/* global use, db */
use('ATdb')

function renameDetailsToDetail(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameDetailsToDetail(item))
  } else if (typeof data === 'object' && data !== null) {
    let keyToDelete = null
    for (let key in data) {
      if (key === 'details') {
        data['detail'] = renameDetailsToDetail(data[key])
        keyToDelete = key
      } else {
        data[key] = renameDetailsToDetail(data[key])
      }
    }
    // Delete the key outside the loop
    if (keyToDelete !== null) {
      delete data[keyToDelete]
    }
  }
  return data
}

const data = db.classes.find().toArray()

const clearData = async (data) => {
  data = renameDetailsToDetail(data)
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: renameDetailsToDetail(item) },
    },
  }))
  await db.classes.bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  clearData(data)
}
