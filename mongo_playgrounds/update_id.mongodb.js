/* global use, db, ObjectId */
use('ATdb')

function renameKey(data) {
  if (Array.isArray(data)) {
    return data.map((item) => renameKey(item))
  } else if (typeof data === 'object' && data !== null) {
    for (let key in data) {
      if (key === 'category') {
        if (data[key].name === 'adventuringGear') {
          data[key]._id = ObjectId('64d5245eee654db9e14eaba8')
        }
        if (data[key].name === 'armor') {
          data[key]._id = ObjectId('64684c833dd4152647a83e0c')
        }
        if (data[key].name === 'weapon') {
          data[key]._id = ObjectId('64684c8a3dd4152647a83e0d')
        }
        if (data[key].name === 'tool') {
          data[key]._id = ObjectId('6663769242c59381a9dd2e6c')
        }
        if (data[key].name === 'shield') {
          data[key]._id = ObjectId('65651afed4ed44a5ba7d2e1e')
        }
        if (data[key].name === 'currency') {
          data[key]._id = ObjectId('65fb455f75a2eeeb8c1945bd')
        }
      } else if (key === 'properties') {
        if (data[key].type && Array.isArray(data[key].type)) {
          data[key].type.map((property) => {
            if (property.name === 'heavyArmor') {
              property._id = ObjectId('647e4311c0d6b3d1eaaaf3b7')
            }
            if (property.name === 'mediumArmor') {
              property._id = ObjectId('647e4319c0d6b3d1eaaaf3b8')
            }
            if (property.name === 'lightArmor') {
              property._id = ObjectId('647e431ec0d6b3d1eaaaf3b9')
            }
            if (property.name === 'versatile') {
              property._id = ObjectId('647e433ac0d6b3d1eaaaf3bb')
            }
            if (property.name === 'light') {
              property._id = ObjectId('647e433fc0d6b3d1eaaaf3bc')
            }
            if (property.name === 'heavy') {
              property._id = ObjectId('647e4343c0d6b3d1eaaaf3bd')
            }
            if (property.name === 'twoHanded') {
              property._id = ObjectId('647e4348c0d6b3d1eaaaf3be')
            }
            if (property.name === 'loading') {
              property._id = ObjectId('647e43b3c0d6b3d1eaaaf3bf')
            }
            if (property.name === 'ranged') {
              property._id = ObjectId('647e43bec0d6b3d1eaaaf3c1')
            }
            if (property.name === 'reach') {
              property._id = ObjectId('647e43c2c0d6b3d1eaaaf3c2')
            }
            if (property.name === 'thrown') {
              property._id = ObjectId('647e43c7c0d6b3d1eaaaf3c3')
            }
            if (property.name === 'finesse') {
              property._id = ObjectId('647e43ccc0d6b3d1eaaaf3c4')
            }
            if (property.name === 'martial') {
              property._id = ObjectId('64bea2d7b4c08f893f0f3068')
            }
            if (property.name === 'special') {
              property._id = ObjectId('653b20e0e15fc4db92604b7a')
            }
            if (property.name === 'melee') {
              property._id = ObjectId('65287d9aedf1748778cc42ed')
            }
            if (property.name === 'simple') {
              property._id = ObjectId('647e43bac0d6b3d1eaaaf3c0')
            }
            if (property.name === 'vial') {
              property._id = ObjectId('651b026f9d5e451613ce4279')
            }
            if (property.name === 'flask') {
              property._id = ObjectId('651b02799d5e451613ce427a')
            }
            if (property.name === 'ammunition') {
              property._id = ObjectId('651b048d9d5e451613ce427b')
            }
            if (property.name === 'thrown') {
              property._id = ObjectId('647e43c7c0d6b3d1eaaaf3c3')
            }
            if (property.name === 'ranged') {
              property._id = ObjectId('647e43bec0d6b3d1eaaaf3c1')
            }
            if (property.name === 'container') {
              property._id = ObjectId('65244659553bb9b45dcff94e')
            }
            if (property.name === 'poison') {
              property._id = ObjectId('64dbe5b2bbd998dd160abe52')
            }
            if (property.name === 'potion') {
              property._id = ObjectId('64a31e2b75c7e9e4eef97a80')
            }
            if (property.name === 'scroll') {
              property._id = ObjectId('64a31e3475c7e9e4eef97a81')
            }
            if (property.name === 'wondrousItem') {
              property._id = ObjectId('64a31e4775c7e9e4eef97a82')
            }
            if (property.name === 'arcaneFocus') {
              property._id = ObjectId('651b0aaa9d5e451613ce427c')
            }
            if (property.name === 'clothing') {
              property._id = ObjectId('6524c164553bb9b45dcff95b')
            }
            if (property.name === 'druidicFocus') {
              property._id = ObjectId('6527fc776c44655e545745d9')
            }
            if (property.name === 'holySymbol') {
              property._id = ObjectId('6527fc996c44655e545745da')
            }
            if (property.name === 'food') {
              property._id = ObjectId('64d5236eee654db9e14eaba4')
            }
            if (property.name === 'drink') {
              property._id = ObjectId('64d52377ee654db9e14eaba5')
            }
            if (property.name === 'improvisedWeapon') {
              property._id = ObjectId('65244659553bb9b45dcff94e')
            }
            if (property.name === 'artisanTool') {
              property._id = ObjectId('64d504c3b046be5742ed6b7e')
            }
            if (property.name === 'gamingSet') {
              property._id = ObjectId('64d504c9b046be5742ed6b7f')
            }
            if (property.name === 'musicalInstrument') {
              property._id = ObjectId('64d504ceb046be5742ed6b80')
            }
            if (property.name === 'professionTool') {
              property._id = ObjectId('64d504d3b046be5742ed6b81')
            }
            if (property.name === 'wood') {
              property._id = ObjectId('6581c3d6252a8c14a482a8b4')
            }
            if (property.name === 'metal') {
              property._id = ObjectId('6663766c42c59381a9dd2e6b')
            }
          })
        }
      } else {
        data[key] = renameKey(data[key]) // Recursive call for nested objects
      }
    }
  }
  return data
}

const collection = 'items'

const data = db[collection].find().toArray()

const clearData = async (data) => {
  data = renameKey(data)
  const bulkOperations = data.map((item) => ({
    updateOne: {
      filter: { _id: item._id },
      update: { $set: item },
    },
  }))
  await db[collection].bulkWrite(bulkOperations)
  // await db.tests.insertMany(data)
}

if (data) {
  clearData(data)
}
