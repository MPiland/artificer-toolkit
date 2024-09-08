/* global use, db */
// MongoDB Playground

// Select the database to use.
use('ATdb')

async function updateDice(data, builders) {
  if (Array.isArray(data)) {
    return Promise.all(data.map((item) => updateDice(item, builders)))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'diceValue') {
        const diceValue = data[key]
        const diceObject = builders.system.dice.find((dice) => dice.value === diceValue)
        data[key] = diceObject
      } else {
        data[key] = await updateDice(data[key], builders)
      }
    }
  }
  return data
}

;(async () => {
  try {
    const builders = await db.builders.findOne()

    if (!builders) {
      throw new Error('No builders document found')
    }

    const collection = 'classes'
    const data = await db[collection].find().toArray()

    const bulkOperations = await Promise.all(
      data.map(async (item) => ({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: await updateDice(item, builders) },
        },
      }))
    )

    await db[collection].bulkWrite(bulkOperations)
    // const updatedData = await updateDice(data, builders)
    // await db.tests.insertMany(updatedData)
    console.log('Update completed successfully')
  } catch (error) {
    console.error('An error occurred:', error)
  }
})()
