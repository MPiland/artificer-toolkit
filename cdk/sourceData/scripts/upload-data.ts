import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, type PutCommandInput } from '@aws-sdk/lib-dynamodb'
import { fromIni } from '@aws-sdk/credential-provider-ini'
import * as fs from 'fs'

// --- Types ---
type UploadArgs = { profile: string }
type NestedKey = { key: string; file: string }
type DataFileEntry = { key: string; file?: string; nestedKeys?: NestedKey[] }
type DataToLoad = Record<string, DataFileEntry[]>

// --- CLI Argument Parsing ---
function parseArgs(argv: string[]): UploadArgs {
  let profile = 'artk-dev-admin'
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--type' && argv[i + 1]) {
      profile = argv[i + 1]
      i++
    }
  }
  return { profile }
}

const { profile } = parseArgs(process.argv.slice(2))

// --- DynamoDB Setup ---
const dynamodb = new DynamoDB({ region: 'us-east-1', credentials: fromIni({ profile }) })
const docClient = DynamoDBDocumentClient.from(dynamodb)

// --- Table Name Lookup ---
async function getTableName(tablePrefix: string, type: 'domain' | 'feature'): Promise<string> {
  try {
    const result = await dynamodb.listTables({})
    const matchingTables = result.TableNames?.filter((name) =>
      name.startsWith(`artk-admin-${type}-stack-${tablePrefix}`)
    )
    if (matchingTables && matchingTables.length > 0) {
      return matchingTables[0]
    }
    throw new Error(`No table found with prefix: ${tablePrefix}`)
  } catch (error) {
    console.error('Error retrieving table name:', error)
    throw error
  }
}

// --- Data Loading ---
const folderLocation = '../'
const systemsData: Record<string, any> = JSON.parse(fs.readFileSync(`${folderLocation}system/systems.json`, 'utf-8'))

const domainData: DataToLoad = {
  MasterSystemTable: [
    { key: 'abilities', file: `${folderLocation}system/abilities.json` },
    { key: 'actions', file: `${folderLocation}system/actions.json` },
    { key: 'alignments', file: `${folderLocation}system/alignments.json` },
    { key: 'attributes', file: `${folderLocation}system/systemAttributes.json` },
    { key: 'categories', file: `${folderLocation}system/systemCategories.json` },
    { key: 'characters', file: `${folderLocation}system/systemCharacters.json` },
    { key: 'charges', file: `${folderLocation}system/systemCharges.json` },
    { key: 'conditions', file: `${folderLocation}system/conditions.json` },
    { key: 'currencies', file: `${folderLocation}system/currencies.json` },
    { key: 'damageTypes', file: `${folderLocation}system/damageTypes.json` },
    {
      key: 'equipment',
      nestedKeys: [
        { key: 'categories', file: `${folderLocation}system/equipmentCategories.json` },
        { key: 'rarities', file: `${folderLocation}system/equipmentRarities.json` },
        { key: 'categoryProperties', file: `${folderLocation}system/equipmentCategoryProperties.json` },
        { key: 'properties', file: `${folderLocation}system/equipmentProperties.json` },
      ],
    },
    { key: 'languages', file: `${folderLocation}system/languages.json` },
    {
      key: 'modifiers',
      nestedKeys: [
        { key: 'categories', file: `${folderLocation}system/modifierCategories.json` },
        { key: 'types', file: `${folderLocation}system/modifierTypes.json` },
        { key: 'methods', file: `${folderLocation}system/modifierMethods.json` },
        { key: 'categoryTypes', file: `${folderLocation}system/modifierCategoryTypes.json` },
        { key: 'typeMethods', file: `${folderLocation}system/modifierTypeMethods.json` },
        { key: 'categoryMethods', file: `${folderLocation}system/modifierCategoryMethods.json` },
        { key: 'spellCategories', file: `${folderLocation}system/modifierSpellCategories.json` },
      ],
    },
    { key: 'passives', file: `${folderLocation}system/passives.json` },
    { key: 'prerequisites', file: `${folderLocation}system/systemPrerequisites.json` },
    {
      key: 'proficiencies',
      nestedKeys: [
        { key: 'levels', file: `${folderLocation}system/proficiencyLevels.json` },
        { key: 'categories', file: `${folderLocation}system/proficiencyCategories.json` },
      ],
    },
    { key: 'rules', file: `${folderLocation}system/rules.json` },
    { key: 'senses', file: `${folderLocation}system/senses.json` },
    { key: 'sizes', file: `${folderLocation}system/sizes.json` },
    { key: 'skills', file: `${folderLocation}system/skills.json` },
    { key: 'speeds', file: `${folderLocation}system/speeds.json` },
    {
      key: 'spells',
      nestedKeys: [
        { key: 'categories', file: `${folderLocation}system/spellCategories.json` },
        { key: 'durations', file: `${folderLocation}system/spellDurations.json` },
        { key: 'ranges', file: `${folderLocation}system/spellRanges.json` },
        { key: 'schools', file: `${folderLocation}system/spellSchools.json` },
        { key: 'shapes', file: `${folderLocation}system/spellShapes.json` },
        { key: 'requirements', file: `${folderLocation}system/spellRequirements.json` },
      ],
    },
    { key: 'terrains', file: `${folderLocation}system/terrains.json` },
  ],
  MasterSpellTable: [{ key: 'spells', file: `${folderLocation}spells/spells.json` }],
  MasterRaceTable: [{ key: 'races', file: `${folderLocation}races/races.json` }],
  MasterClassTable: [
    { key: 'classes', file: `${folderLocation}classes/base/classes.json` },
    { key: 'subclasses', file: `${folderLocation}classes/sub/subclasses.json` },
  ],
  MasterEquipmentTable: [{ key: 'equipment', file: `${folderLocation}equipment/equipment.json` }],
  MasterBackgroundTable: [{ key: 'backgrounds', file: `${folderLocation}backgrounds/backgrounds.json` }],
  MasterFeatTable: [{ key: 'feats', file: `${folderLocation}feats/feats.json` }],
}

const featureData: DataToLoad = {
  MasterFeatureTable: [{ key: 'feature', file: `${folderLocation}features/features.json` }],
  MasterAncestryOptionTable: [
    { key: 'ancestryOptions', file: `${folderLocation}ancestryOptions/ancestryOptions.json` },
  ],
  MasterFeatureSpellTable: [{ key: 'featureSpells', file: `${folderLocation}featureSpells/featureSpells.json` }],
  MasterFeatureModifierTable: [
    { key: 'featureModifiers', file: `${folderLocation}featureModifiers/featureModifiers.json` },
  ],
  MasterFeatureProficiencyTable: [
    { key: 'featureProficiencies', file: `${folderLocation}featureProficiencies/featureProficiencies.json` },
  ],
  MasterFeatureExpertiseTable: [
    { key: 'featureExpertises', file: `${folderLocation}featureExpertise/featureExpertise.json` },
  ],
  MasterFeatureSenseTable: [{ key: 'featureSenses', file: `${folderLocation}featureSenses/featureSenses.json` }],
  MasterFeatureOptionTable: [{ key: 'featureOptions', file: `${folderLocation}featureOptions/featureOptions.json` }],
}

// --- Build Systems Object ---
async function buildSystemsObject(): Promise<Record<string, any>> {
  console.log('Building Master System Data...')
  for (const { key, nestedKeys, file } of domainData.MasterSystemTable) {
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
async function uploadData(
  tableName: string,
  dataToInsert: Record<string, any>,
  type: 'domain' | 'feature'
): Promise<void> {
  const dynamoTable = await getTableName(tableName, type)
  const params: PutCommandInput = {
    TableName: dynamoTable,
    Item: dataToInsert,
  }
  try {
    await docClient.send(new PutCommand(params))
  } catch (err) {
    console.error(`Error inserting data at table: ${tableName}`, err)
  }
}

// --- Insert Data ---
async function insertData(type: 'domain' | 'feature'): Promise<void> {
  const dataEntries = type === 'domain' ? domainData : featureData
  for (const [tableName, tableData] of Object.entries(dataEntries)) {
    console.log(`Uploading ${type} data for table: `, tableName)
    if (type === 'domain' && tableName === 'MasterSystemTable') {
      const dataToInsert = await buildSystemsObject()
      await uploadData(tableName, dataToInsert, type)
    } else {
      for (const { file } of tableData) {
        if (!file) continue
        const dataToInsert = JSON.parse(fs.readFileSync(file, 'utf-8'))
        if (Array.isArray(dataToInsert)) {
          for (const item of dataToInsert) {
            await uploadData(tableName, item, type)
          }
        } else {
          await uploadData(tableName, dataToInsert, type)
        }
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
