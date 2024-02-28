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

const cleanData = (dataArray) => {
  dataArray.forEach((obj) => delete obj.userId)

  return dataArray
}

const data = db.spells.find().toArray()

const updateMaster = async (data) => {
  data = cleanData(data)

  try {
    await db.masters.updateOne(
      { _id: ObjectId('64adb66bd75ac94ebbb88f9f') },
      { $set: { spells: data } },
      { upsert: true }
    )
  } catch (err) {
    console.log(err)
  }
}

updateMaster(data)
