import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../../.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

// --- Types ---
type NestedKey = { key: string; file: string }
type DataFileEntry = { key: string; file?: string; nestedKeys?: NestedKey[] }
type DataToLoad = Record<string, DataFileEntry[]>

// --- Data Loading ---
const folderLocation = '../'
const systemsData: Record<string, any> = JSON.parse(fs.readFileSync(`${folderLocation}system/systems.json`, 'utf-8'))

const domainData: DataToLoad = {
  // systems: [
  //   { key: 'abilities', file: `${folderLocation}system/abilities.json` },
  //   { key: 'actions', file: `${folderLocation}system/actions.json` },
  //   { key: 'alignments', file: `${folderLocation}system/alignments.json` },
  //   { key: 'attributes', file: `${folderLocation}system/systemAttributes.json` },
  //   { key: 'categories', file: `${folderLocation}system/systemCategories.json` },
  //   { key: 'characters', file: `${folderLocation}system/systemCharacters.json` },
  //   { key: 'charges', file: `${folderLocation}system/systemCharges.json` },
  //   { key: 'conditions', file: `${folderLocation}system/conditions.json` },
  //   { key: 'currencies', file: `${folderLocation}system/currencies.json` },
  //   { key: 'damage_types', file: `${folderLocation}system/damageTypes.json` },
  //   {
  //     key: 'equipment',
  //     nestedKeys: [
  //       { key: 'categories', file: `${folderLocation}system/equipmentCategories.json` },
  //       { key: 'rarities', file: `${folderLocation}system/equipmentRarities.json` },
  //       { key: 'category_properties', file: `${folderLocation}system/equipmentCategoryProperties.json` },
  //       { key: 'properties', file: `${folderLocation}system/equipmentProperties.json` },
  //     ],
  //   },
  //   { key: 'languages', file: `${folderLocation}system/languages.json` },
  //   {
  //     key: 'modifiers',
  //     nestedKeys: [
  //       { key: 'categories', file: `${folderLocation}system/modifierCategories.json` },
  //       { key: 'types', file: `${folderLocation}system/modifierTypes.json` },
  //       { key: 'methods', file: `${folderLocation}system/modifierMethods.json` },
  //       { key: 'category_types', file: `${folderLocation}system/modifierCategoryTypes.json` },
  //       { key: 'type_methods', file: `${folderLocation}system/modifierTypeMethods.json` },
  //       { key: 'category_methods', file: `${folderLocation}system/modifierCategoryMethods.json` },
  //       { key: 'spell_categories', file: `${folderLocation}system/modifierSpellCategories.json` },
  //     ],
  //   },
  //   { key: 'passives', file: `${folderLocation}system/passives.json` },
  //   { key: 'prerequisites', file: `${folderLocation}system/systemPrerequisites.json` },
  //   {
  //     key: 'proficiencies',
  //     nestedKeys: [
  //       { key: 'levels', file: `${folderLocation}system/proficiencyLevels.json` },
  //       { key: 'categories', file: `${folderLocation}system/proficiencyCategories.json` },
  //     ],
  //   },
  //   { key: 'rules', file: `${folderLocation}system/rules.json` },
  //   { key: 'senses', file: `${folderLocation}system/senses.json` },
  //   { key: 'sizes', file: `${folderLocation}system/sizes.json` },
  //   { key: 'skills', file: `${folderLocation}system/skills.json` },
  //   { key: 'speeds', file: `${folderLocation}system/speeds.json` },
  //   {
  //     key: 'spells',
  //     nestedKeys: [
  //       { key: 'categories', file: `${folderLocation}system/spellCategories.json` },
  //       { key: 'durations', file: `${folderLocation}system/spellDurations.json` },
  //       { key: 'ranges', file: `${folderLocation}system/spellRanges.json` },
  //       { key: 'schools', file: `${folderLocation}system/spellSchools.json` },
  //       { key: 'shapes', file: `${folderLocation}system/spellShapes.json` },
  //       { key: 'requirements', file: `${folderLocation}system/spellRequirements.json` },
  //     ],
  //   },
  //   { key: 'terrains', file: `${folderLocation}system/terrains.json` },
  // ],
  // spells: [{ key: 'spells', file: `${folderLocation}spells/spells.json` }],
  //   races: [{ key: 'races', file: `${folderLocation}races/races.json` }],
  // classes: [
  //   { key: 'classes', file: `${folderLocation}classes/base/classes.json` },
  //   { key: 'subclasses', file: `${folderLocation}classes/sub/subclasses.json` },
  // ],
  // equipment: [{ key: 'equipment', file: `${folderLocation}equipment/equipment.json` }],
  //   backgrounds: [{ key: 'backgrounds', file: `${folderLocation}backgrounds/backgrounds.json` }],
  //   feats: [{ key: 'feats', file: `${folderLocation}feats/feats.json` }],
}

const featureData: DataToLoad = {
    features: [{ key: 'feature', file: `${folderLocation}features/features.json` }],
  //   ancestry_options: [{ key: 'ancestryOptions', file: `${folderLocation}ancestryOptions/ancestryOptions.json` }],
  //   feature_spells: [{ key: 'featureSpells', file: `${folderLocation}featureSpells/featureSpells.json` }],
  //   feature_modifiers: [{ key: 'featureModifiers', file: `${folderLocation}featureModifiers/featureModifiers.json` }],
  //   feature_proficiencies: [
  //     { key: 'featureProficiencies', file: `${folderLocation}featureProficiencies/featureProficiencies.json` },
  //   ],
  //   feature_expertise: [{ key: 'featureExpertises', file: `${folderLocation}featureExpertise/featureExpertise.json` }],
  //   feature_senses: [{ key: 'featureSenses', file: `${folderLocation}featureSenses/featureSenses.json` }],
  //   feature_options: [{ key: 'featureOptions', file: `${folderLocation}featureOptions/featureOptions.json` }],
  // feature_ancestries: [{ key: 'featureAncestries', file: `${folderLocation}featureAncestry/featureAncestries.json` }],
}

function pick(obj: Record<string, any>, keys: string[]) {
  return keys.reduce(
    (acc, key) => {
      if (obj[key] !== undefined) acc[key] = obj[key]
      return acc
    },
    {} as Record<string, any>
  )
}

// --- Build Systems Object ---
async function buildSystemsObject(): Promise<Record<string, any>> {
  console.log('Building Master System Data...')
  for (const { key, nestedKeys, file } of domainData.systems) {
    if (file) {
      if (!(systemsData as any).id) {
        console.log(`Missing ID for systems`)
      }
      systemsData[key] = JSON.parse(fs.readFileSync(file, 'utf-8'))
      if (Array.isArray(systemsData[key])) {
        systemsData[key].forEach((item: any) => {
          if (!item.id) {
            console.log(`Missing ID for key ${key}: ${item.name}`)
          }
        })
      }
    } else {
      systemsData[key] = {}
    }
    if (nestedKeys) {
      for (const { key: nestedKey, file: nestedFile } of nestedKeys) {
        systemsData[key][nestedKey] = JSON.parse(fs.readFileSync(nestedFile, 'utf-8'))
        if (Array.isArray(systemsData[key][nestedKey])) {
          systemsData[key][nestedKey].forEach((item: any) => {
            if (!item.id) {
              console.log(`Missing ID for nested key ${key}: ${item.name}`)
            }
          })
        }
      }
    }
  }
  return systemsData
}

// --- Upload Data ---
async function uploadData(tableName: string, dataToInsert: Record<string, any>): Promise<void> {
  const rows = Array.isArray(dataToInsert) ? dataToInsert : [dataToInsert]

  const filteredRows = rows.map((item: any) => {
    const newItem = pick(item, ['id', 'label', 'category_id', 'damage'])
    // newItem.is_master = true
    return newItem
  })
  const { error } = await supabase.from(tableName).upsert(filteredRows, { onConflict: 'id' })
  if (error) {
    console.error(`Error inserting into ${tableName}:`, error)
  }
}

// --- Insert Data ---
async function insertData(type: 'domain' | 'feature'): Promise<void> {
  const dataEntries = type === 'domain' ? domainData : featureData
  for (const [tableName, tableData] of Object.entries(dataEntries)) {
    console.log(`Uploading ${type} data for table: `, tableName)
    if (type === 'domain' && tableName === 'systems') {
      const dataToInsert = await buildSystemsObject()
      await uploadData(tableName, dataToInsert)
    } else {
      for (const { file } of tableData) {
        if (!file) continue
        const dataToInsert = JSON.parse(fs.readFileSync(file, 'utf-8'))
        await uploadData(tableName, dataToInsert)
      }
    }
  }
}

// --- Main ---
console.log('Starting data insertion process...')
insertData('domain')
  .then(() => {
    console.log('Domain data insertion completed.')
  })
  .catch((err) => {
    console.error('Error during domain data insertion:', err)
  })
  .then(() =>
    insertData('feature')
      .then(() => {
        console.log('Feature data insertion completed.')
      })
      .catch((err) => {
        console.error('Error during feature data insertion:', err)
      })
  )
