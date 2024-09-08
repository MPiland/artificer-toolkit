/* global use, db */

// Select the database to use.
use('ATdb')

function updateId(obj1, obj2) {
  // Helper function to recursively traverse an object and update _id
  function traverseAndUpdate(source, target) {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null) {
          // If the current property is an object, recursively traverse it
          traverseAndUpdate(source[key], target)
        } else if (key === 'name') {
          // If the current property is 'name', find a matching 'name' in the target object
          const matchingObject = findMatchingObject(target, source[key])
          if (matchingObject) {
            // If a match is found, update the _id in the source object
            source = matchingObject
          }
        }
      }
    }
  }

  // Helper function to find an object with a matching 'name' property
  function findMatchingObject(obj, name) {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursively search for a matching 'name' property
            const result = findMatchingObject(obj[key], name)
            if (result) {
              return result
            }
          } else if (key === 'name' && obj[key] === name) {
            // If a matching 'name' is found, return the parent object
            return obj
          }
        }
      }
    }
    return null
  }

  traverseAndUpdate(obj1, obj2)
  return obj1
}

const collection = 'spells'

const data = db[collection].find().toArray()
const builders = db.builders.find().toArray()

const cleanData = async (data) => {
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: updateId(item, builders) },
    },
  }))
  await db[collection].bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  cleanData(data)
}
