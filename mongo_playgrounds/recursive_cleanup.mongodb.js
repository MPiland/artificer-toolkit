/* global use, db */
// MongoDB Playground
// To disable this template go to Settings | MongoDB | Use Default Template For Playground.
// Make sure you are connected to enable completions and to be able to run a playground.
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.
// The result of the last command run in a playground is shown on the results panel.
// By default the first 20 documents will be returned with a cursor.
// Use 'console.log()' to print to the debug output.
// For more documentation on playgrounds please refer to
// https://www.mongodb.com/docs/mongodb-vscode/playgrounds/

// Select the database to use.
use('ATdb')

function removeEmptyObjectsAndArrays(obj) {
  if (Array.isArray(obj)) {
    for (let i = obj.length - 1; i >= 0; i--) {
      if (isEmpty(obj[i])) {
        obj.splice(i, 1)
      } else {
        removeEmptyObjectsAndArrays(obj[i])
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (isEmpty(obj[key])) {
        delete obj[key]
      } else {
        removeEmptyObjectsAndArrays(obj[key])
      }
    }
  }
  return obj
}

function isEmpty(value) {
  if (Array.isArray(value)) {
    return value.length === 0
  } else if (typeof value === 'object' && value !== null) {
    for (const key in value) {
      if (!isEmpty(value[key])) {
        return false
      }
    }
    return true
  } else {
    return false
  }
}

let dataSet = db.items.find({})

if (dataSet) {
  dataSet.forEach((data) => {
    removeEmptyObjectsAndArrays(data)
    db.items.replaceOne({ _id: data._id }, data)
  })
}
