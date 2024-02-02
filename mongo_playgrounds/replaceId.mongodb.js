/* global use, db */
use('ATdb')

function transformArray(data) {
  if (Array.isArray(data)) {
    // If the input is an array, iterate over its elements
    return data.map((item) => transformArray(item))
  } else if (typeof data === 'object' && data !== null) {
    // If the input is an object, process its properties
    if ('id' in data) {
      // Check if 'id' property exists
      if (data.id === null || data.id === undefined) {
        // If 'id' is null or undefined, delete it
        delete data.id
      } else {
        // If 'id' exists and is not null, check for '_id'
        // Copy 'id' to '_id' and delete 'id'
        data._id = data.id
        delete data.id
      }
    }

    // Recursively transform nested objects
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        data[key] = transformArray(data[key])
      }
    }

    return data
  } else {
    // Base case: return non-object values as is
    return data
  }
}

const collection = 'items'

let dataSet = db[`${collection}`].find({}).toArray()

const cleanData = async (dataSet) => {
  dataSet = transformArray(dataSet)
  try {
    const bulkUpdate = dataSet.map((data) => ({
      replaceOne: {
        filter: { _id: data._id },
        replacement: data,
        upsert: true,
      },
    }))
    await db[`${collection}`].bulkWrite(bulkUpdate)
  } catch (err) {
    console.log(err.message)
  }
}

if (dataSet) {
  cleanData(dataSet)
}
