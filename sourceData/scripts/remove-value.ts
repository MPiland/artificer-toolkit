import * as fs from 'fs'

function removeValueProperty(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeValueProperty)
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {}
    for (const key in obj) {
      if (key === 'ownerId' && obj[key] === 'master') {
        newObj.is_master = true
      }
      if (key === 'systemId') {
        newObj.system_id = obj[key]
      }
      if (key === 'updatedAt') {
        newObj.updated_at = obj[key]
      }
      if (key !== 'value' && key !== 'ownerId' && key !== 'systemId' && key !== 'updatedAt') {
        newObj[key] = removeValueProperty(obj[key])
      }
    }
    return newObj
  }
  return obj
}

function processFiles(filePaths: string[]): void {
  filePaths.forEach((filePath) => {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const processedData = removeValueProperty(data)
    fs.writeFileSync(filePath, JSON.stringify(processedData, null, 2))
  })
}

// Example usage
const folderLocation = '../'
const filePaths = [
  `${folderLocation}system/abilities.json`,
  `${folderLocation}system/actions.json`,
  `${folderLocation}system/alignments.json`,
  `${folderLocation}system/systemAttributes.json`,
  `${folderLocation}system/systemCategories.json`,
  `${folderLocation}system/systemCharacters.json`,
  `${folderLocation}system/systemCharges.json`,
  `${folderLocation}system/conditions.json`,
  `${folderLocation}system/currencies.json`,
  `${folderLocation}system/damageTypes.json`,
  `${folderLocation}system/equipmentCategories.json`,
  `${folderLocation}system/equipmentRarities.json`,
  `${folderLocation}system/equipmentCategoryProperties.json`,
  `${folderLocation}system/equipmentProperties.json`,
  `${folderLocation}system/languages.json`,
  `${folderLocation}system/modifierCategories.json`,
  `${folderLocation}system/modifierTypes.json`,
  `${folderLocation}system/modifierMethods.json`,
  `${folderLocation}system/modifierCategoryTypes.json`,
  `${folderLocation}system/modifierTypeMethods.json`,
  `${folderLocation}system/modifierCategoryMethods.json`,
  `${folderLocation}system/modifierSpellCategories.json`,
  `${folderLocation}system/passives.json`,
  `${folderLocation}system/systemPrerequisites.json`,
  `${folderLocation}system/proficiencyLevels.json`,
  `${folderLocation}system/proficiencyCategories.json`,
  `${folderLocation}system/rules.json`,
  `${folderLocation}system/senses.json`,
  `${folderLocation}system/sizes.json`,
  `${folderLocation}system/skills.json`,
  `${folderLocation}system/speeds.json`,
  `${folderLocation}system/spellCategories.json`,
  `${folderLocation}system/spellDurations.json`,
  `${folderLocation}system/spellRanges.json`,
  `${folderLocation}system/spellSchools.json`,
  `${folderLocation}system/spellShapes.json`,
  `${folderLocation}system/spellRequirements.json`,
  `${folderLocation}system/terrains.json`,
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
