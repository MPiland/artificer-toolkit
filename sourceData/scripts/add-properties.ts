import * as fs from 'fs'

function processFiles(filePaths: string[]): void {
  filePaths.forEach((filePath) => {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (Array.isArray(data)) {
      const processedData = data.map((item) => {
        const itemCopy = { ...item }
        if (!itemCopy.ownerId) {
          itemCopy.ownerId = 'master'
        }
        if (!itemCopy.createdAt) {
          itemCopy.createdAt = '2024-09-12T11:05:10.351Z'
        }
        if (!itemCopy.updatedAt) {
          itemCopy.updatedAt = '2024-09-12T11:05:10.351Z'
        }
        if (!itemCopy.systemId) {
          itemCopy.systemId = '4045f389-f0a7-48e7-bb9e-3822d526d9d4'
        }
        return itemCopy
      })
      fs.writeFileSync(filePath, JSON.stringify(processedData, null, 2))
    } else {
      const processedData = { ...data }
      if (!processedData.ownerId) {
        processedData.ownerId = 'master'
      }
      if (!processedData.createdAt) {
        processedData.createdAt = '2024-09-12T11:05:10.351Z'
      }
      if (!processedData.updatedAt) {
        processedData.updatedAt = '2024-09-12T11:05:10.351Z'
      }
      if (!processedData.systemId) {
        processedData.systemId = '4045f389-f0a7-48e7-bb9e-3822d526d9d4'
      }
      fs.writeFileSync(filePath, JSON.stringify(processedData, null, 2))
    }
  })
}

// Example usage
const folderLocation = '../'
const filePaths = [
  `${folderLocation}spells/spells.json`,
  `${folderLocation}races/races.json`,
  `${folderLocation}classes/base/classes.json`,
  `${folderLocation}classes/sub/subclasses.json`,
  `${folderLocation}equipment/equipment.json`,
  `${folderLocation}backgrounds/backgrounds.json`,
  `${folderLocation}feats/feats.json`,
  `${folderLocation}features/features.json`,
  `${folderLocation}ancestryOptions/ancestryOptions.json`,
  `${folderLocation}featureSpells/featureSpells.json`,
  `${folderLocation}featureModifiers/featureModifiers.json`,
  `${folderLocation}featureProficiencies/featureProficiencies.json`,
  `${folderLocation}featureExpertise/featureExpertise.json`,
  `${folderLocation}featureSenses/featureSenses.json`,
  `${folderLocation}featureOptions/featureOptions.json`,
]

processFiles(filePaths)
