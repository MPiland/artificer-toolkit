import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

const dataFiles = [
  { key: 'classes', path: '../classes/base/classes.json' },
  { key: 'subclasses', path: '../classes/sub/subclasses.json' },
  { key: 'equipment', path: '../equipment/equipment.json' },
  { key: 'feats', path: '../feats/feats.json' },
  { key: 'races', path: '../races/races.json' },
  { key: 'backgrounds', path: '../backgrounds/backgrounds.json' },
]

// Output file locations
const outputFiles = {
  features: '../features/features.json',
  options: '../featureOptions/featureOptions.json',
  ancestry: '../ancestryOptions/ancestryOptions.json',
  modifiers: '../featureModifiers/featureModifiers.json',
  senses: '../featureSenses/featureSenses.json',
  proficiencies: '../featureProficiencies/featureProficiencies.json',
  expertise: '../featureExpertise/featureExpertise.json',
  spells: '../featureSpells/featureSpells.json',
}

type ObjectWithId = { id: string; [key: string]: unknown }

function loadExistingMap(filePath: string): Map<string, ObjectWithId> {
  const absPath = path.resolve(__dirname, filePath)
  if (!fs.existsSync(absPath)) return new Map()
  const content = fs.readFileSync(absPath, 'utf-8').trim()
  if (!content) return new Map()
  try {
    const arr = JSON.parse(content)
    return new Map(arr.map((obj: ObjectWithId) => [obj.id, obj]))
  } catch (e) {
    console.error(`Error parsing JSON in ${filePath}:`, e)
    return new Map()
  }
}

// Load existing data
const allFeaturesMap = loadExistingMap(outputFiles.features)
const allOptionsMap = loadExistingMap(outputFiles.options)
const allAncestryOptionsMap = loadExistingMap(outputFiles.ancestry)
const allModifiersMap = loadExistingMap(outputFiles.modifiers)
const allSensesMap = loadExistingMap(outputFiles.senses)
const allProficienciesMap = loadExistingMap(outputFiles.proficiencies)
const allExpertiseMap = loadExistingMap(outputFiles.expertise)
const allSpellsMap = loadExistingMap(outputFiles.spells)

function processArray(array: ObjectWithId[], type: 'feature' | 'ancestryOptions' | 'option'): string[] {
  const featureIds: string[] = []
  const ancestryOptionIds: string[] = []
  const optionIds: string[] = []
  const senseIds: string[] = []
  const modifierIds: string[] = []
  const proficiencyIds: string[] = []
  const expertiseIds: string[] = []
  const spellIds: string[] = []

  for (const obj of array) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj.id) {
      // Only add the id if it's not already present in the map and not already in the array
      if (type === 'feature' && !allFeaturesMap.has(obj.id) && !featureIds.includes(obj.id)) featureIds.push(obj.id)
      if (type === 'ancestryOptions' && !allAncestryOptionsMap.has(obj.id) && !ancestryOptionIds.includes(obj.id))
        ancestryOptionIds.push(obj.id)
      if (type === 'option' && !allOptionsMap.has(obj.id) && !optionIds.includes(obj.id)) optionIds.push(obj.id)

      // Senses
      if (obj.senses && Array.isArray(obj.senses)) {
        for (const sense of obj.senses) {
          let senseId = sense.id
          if (!senseId) {
            senseId = uuidv4()
          }
          sense.id = senseId
          if (!allSensesMap.has(senseId) && !senseIds.includes(senseId)) {
            allSensesMap.set(senseId, sense)
            senseIds.push(senseId)
          }
        }
        if (senseIds.length) obj.senses = senseIds
      }

      // Modifiers
      if (obj.modifiers && Array.isArray(obj.modifiers)) {
        for (const modifier of obj.modifiers) {
          let modifierId = modifier.id
          if (!modifierId) {
            modifierId = uuidv4()
          }
          modifier.id = modifierId
          if (!allModifiersMap.has(modifierId) && !modifierIds.includes(modifierId)) {
            allModifiersMap.set(modifierId, modifier)
            modifierIds.push(modifierId)
          }
        }
        if (modifierIds.length) obj.modifiers = modifierIds
      }

      // Proficiencies
      if (obj.proficiencies && Array.isArray(obj.proficiencies)) {
        for (const proficiency of obj.proficiencies) {
          let proficiencyId = proficiency.id
          if (!proficiencyId) {
            proficiencyId = uuidv4()
          }
          proficiency.id = proficiencyId
          if (!allProficienciesMap.has(proficiencyId) && !proficiencyIds.includes(proficiencyId)) {
            allProficienciesMap.set(proficiencyId, proficiency)
            proficiencyIds.push(proficiencyId)
          }
        }
        if (proficiencyIds.length) obj.proficiencies = proficiencyIds
      }

      // Expertise
      if (obj.expertise && Array.isArray(obj.expertise)) {
        for (const expertise of obj.expertise) {
          let expertiseId = expertise.id
          if (!expertiseId) {
            expertiseId = uuidv4()
          }
          expertise.id = expertiseId
          if (!allExpertiseMap.has(expertiseId) && !expertiseIds.includes(expertiseId)) {
            allExpertiseMap.set(expertiseId, expertise)
            expertiseIds.push(expertiseId)
          }
        }
        if (expertiseIds.length) obj.expertise = expertiseIds
      }

      // Spells
      if (obj.spells && Array.isArray(obj.spells)) {
        for (const spell of obj.spells) {
          let spellId = spell.id
          if (!spellId) {
            spellId = uuidv4()
          }
          spell.id = spellId
          if (!allSpellsMap.has(spellId) && !spellIds.includes(spellId)) {
            allSpellsMap.set(spellId, spell)
            spellIds.push(spellId)
          }
        }
        if (spellIds.length) obj.spells = spellIds
      }

      // Options (recursive)
      if (obj.options && Array.isArray(obj.options)) {
        const nestedOptionIds = processArray(obj.options, 'option')
        if (nestedOptionIds.length) obj.options = nestedOptionIds
      }

      // Ancestry features may have a nested features array
      if (type === 'ancestryOptions' && obj.features && Array.isArray(obj.features)) {
        const featureIds = processArray(obj.features, 'feature')
        if (featureIds.length) obj.features = featureIds
      }

      // Always update the maps with the object itself (for deduplication and to keep latest changes)
      if (type === 'feature') allFeaturesMap.set(obj.id, obj)
      if (type === 'ancestryOptions') allAncestryOptionsMap.set(obj.id, obj)
      if (type === 'option') allOptionsMap.set(obj.id, obj)
    }
  }

  if (type === 'feature') return featureIds
  if (type === 'ancestryOptions') return ancestryOptionIds
  if (type === 'option') return optionIds
  return []
}

function traverseAndProcess(arr: unknown[]) {
  for (const obj of arr) {
    if (obj && typeof obj === 'object') {
      if ('features' in obj) {
        if (obj.features && Array.isArray(obj.features)) {
          const featureIds = processArray(obj.features, 'feature')
          if (featureIds.length) {
            obj.features = featureIds
          }
        }
      }
      if ('ancestry' in obj && obj.ancestry && typeof obj.ancestry === 'object' && 'options' in obj.ancestry) {
        if (obj.ancestry.options && Array.isArray(obj.ancestry.options)) {
          const ancestryOptionIds = processArray(obj.ancestry.options, 'ancestryOptions')
          if (ancestryOptionIds.length) {
            obj.ancestry.options = ancestryOptionIds
          }
        }
      }
    }
  }
}

// Process all data files
for (const { path: relPath } of dataFiles) {
  const absPath = path.resolve(__dirname, relPath)
  const arr = JSON.parse(fs.readFileSync(absPath, 'utf-8'))
  traverseAndProcess(arr)
  fs.writeFileSync(absPath, JSON.stringify(arr, null, 2), 'utf-8')
}

// Write out all extracted arrays (append/merge)
fs.writeFileSync(
  path.resolve(__dirname, outputFiles.features),
  JSON.stringify(Array.from(allFeaturesMap.values()), null, 2),
  'utf-8'
)
fs.writeFileSync(
  path.resolve(__dirname, outputFiles.options),
  JSON.stringify(Array.from(allOptionsMap.values()), null, 2),
  'utf-8'
)
fs.writeFileSync(
  path.resolve(__dirname, outputFiles.ancestry),
  JSON.stringify(Array.from(allAncestryOptionsMap.values()), null, 2),
  'utf-8'
)
fs.writeFileSync(
  path.resolve(__dirname, outputFiles.modifiers),
  JSON.stringify(Array.from(allModifiersMap.values()), null, 2),
  'utf-8'
)
fs.writeFileSync(
  path.resolve(__dirname, outputFiles.senses),
  JSON.stringify(Array.from(allSensesMap.values()), null, 2),
  'utf-8'
)
fs.writeFileSync(
  path.resolve(__dirname, outputFiles.proficiencies),
  JSON.stringify(Array.from(allProficienciesMap.values()), null, 2),
  'utf-8'
)
fs.writeFileSync(
  path.resolve(__dirname, outputFiles.expertise),
  JSON.stringify(Array.from(allExpertiseMap.values()), null, 2),
  'utf-8'
)
fs.writeFileSync(
  path.resolve(__dirname, outputFiles.spells),
  JSON.stringify(Array.from(allSpellsMap.values()), null, 2),
  'utf-8'
)

console.log(`Extracted ${allFeaturesMap.size} features to features.json`)
