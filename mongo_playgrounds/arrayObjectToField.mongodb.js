/* global use, db */

use('ATdb')

function moveDataToAbility(array) {
  // Iterate through each element in the array
  array.forEach((obj) => {
    // Check if the current object has a 'saveAbility' field and it is an array
    if (
      Object.prototype.hasOwnProperty.call(obj, 'saveAbility') &&
      Array.isArray(obj.saveAbility)
    ) {
      // Iterate through each item in the 'saveAbility' array
      obj.saveAbility = { ability: obj.saveAbility }
    }
    Object.values(obj).forEach((value) => {
      if (
        Array.isArray(value) ||
        (typeof value === 'object' && value !== null)
      ) {
        moveDataToAbility([value]) // Pass value as an array to handle both object and array cases
      }
    })
  })

  return array
}

const data = db.classes.find().toArray()

const correctData = async (data) => {
  data = moveDataToAbility(data)
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: item },
    },
  }))
  await db.classes.bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data != null) {
  correctData(data)
}
