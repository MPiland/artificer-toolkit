/* global use, db, ObjectId */
const fs = require('fs')
// Select the database to use.
use('ATdb')

async function main() {
  function matchAndOutput(categories, methods, types) {
    return categories.map((category) => {
      const categoryId = category._id

      const typesCopy = [...types]
      const methodsCopy = [...methods]

      // Find matching types for the category
      const matchingTypes = typesCopy
        .filter((type) =>
          type.category.find((cat) => cat._id.equals(categoryId))
        )
        .map(({ category, ...rest }) => rest)

      // Find matching methods for the category
      const matchingMethods = methodsCopy
        .filter((method) =>
          method.category.find((cat) => cat._id.equals(categoryId))
        )
        .map(({ category, ...rest }) => rest)

      // Update category object with matched methods and types
      category.type = matchingTypes
      category.method = matchingMethods

      return category
    })
  }

  try {
    const data = await db.builders.findOne({})

    if (data) {
      const categoryArray = data.modifier.category
      const methodArray = data.modifier.method
      const typeArray = data.modifier.type

      const categoryOutput = matchAndOutput(
        categoryArray,
        methodArray,
        typeArray
      )

      if (categoryOutput != null) {
        const filePath = 'C:/Users/pilan/Desktop/matchedCategories.json'
        fs.writeFileSync(filePath, JSON.stringify(categoryOutput, null, 2))
        console.log('Output saved to matchedCategories.json')
      }
    }
  } catch (err) {
    console.log({ err: err })
  }
}

main()
