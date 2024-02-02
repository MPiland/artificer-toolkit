/* global use, db */

use('ATdb')

function clean(object) {
  Object.entries(object).forEach(([k, v]) => {
    if (v && typeof v === 'object') {
      clean(v)
    }
    if (
      (v && typeof v === 'object' && !Object.keys(v).length) ||
      v === null ||
      v === undefined
    ) {
      if (Array.isArray(object)) {
        object.splice(k, 1)
      } else if (v === null || v === undefined) {
        delete object[k]
      }
    }
  })
  return object
}

const data = db.items.findOne({ name: 'paddedArmor' })

const clearData = async (data) => {
  console.log('running')
  data = clean(data)
  try {
    await db.tests.insert(data)
  } catch (err) {
    console.log(err.message)
  }
}

if (data) {
  clearData(data)
}
// db.items.replaceOne({ _id: data._id }, data) // update same record
