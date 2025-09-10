import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { fromIni } from '@aws-sdk/credential-provider-ini'
import { isEqual } from 'lodash'

// --- Types ---
type UploadArgs = { profile: string }

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

const client: DynamoDB = new DynamoDB({ region: 'us-east-1', credentials: fromIni({ profile }) })
const docClient: DynamoDBDocumentClient = DynamoDBDocumentClient.from(client)
const masterToUserMap: Map<string, any> = new Map()
const ownerSystemMap: Map<string, string> = new Map()

const updateReferences = (data: any, currentOwnerId: string): any => {
  if (!data) return data

  if (Array.isArray(data)) {
    if (data.every((v) => typeof v === 'string')) {
      return data.map((str: string) => {
        const userDocs = masterToUserMap.get(str)
        const matchingDoc = userDocs?.find((doc: any) => doc.ownerId === currentOwnerId)
        return matchingDoc ? matchingDoc.id : str
      })
    }
    return data.map((item: any) => updateReferences(item, currentOwnerId))
  }

  if (typeof data === 'object') {
    const result: any = { ...data }
    for (const [key, value] of Object.entries(data)) {
      if (key === 'masterId' || key === 'ownerId') continue

      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        result[key] = value.map((str: string) => {
          const userDocs = masterToUserMap.get(str)
          const matchingDoc = userDocs?.find((doc: any) => doc.ownerId === currentOwnerId)
          return matchingDoc ? matchingDoc.id : str
        })
      } else if (typeof value === 'string') {
        const userDocs = masterToUserMap.get(value)
        const matchingDoc = userDocs?.find((doc: any) => doc.ownerId === currentOwnerId)
        if (matchingDoc) {
          result[key] = matchingDoc.id
        }
      } else if (typeof value === 'object') {
        result[key] = updateReferences(value, currentOwnerId)
      }
    }
    return result
  }

  return data
}

/**
 * Updates all user data by syncing with master data, updating all ID references (including features and feature sections)
 * to the user's IDs using a two-pass mapping and update process.
 */
export const updateData = async (): Promise<void> => {
  const domainTables: string[] = [
    'SpellTable',
    'RaceTable',
    'ClassTable',
    'EquipmentTable',
    'BackgroundTable',
    'FeatTable',
  ]

  const featureTables = [
    'AncestryOptionTable',
    'FeatureExpertiseTable',
    'FeatureFeatTable',
    'FeatureModifierTable',
    'FeatureOptionTable',
    'FeatureProficiencyTable',
    'FeatureSenseTable',
    'FeatureSpellTable',
    'FeatureTable',
  ]

  // Combine all tables to ensure mapping and updates include everything
  const allTables = [...domainTables, ...featureTables]

  // First get and process system data
  const systemTableName: string = await getTableName('SystemTable', 'domain', false)
  const masterSystemTableName: string = await getTableName('MasterSystemTable', 'domain', true)
  const masterSystemData: any[] = await scanTable(masterSystemTableName)
  if (!masterSystemData?.length) console.error('No master system data found')
  const userSystemData: any[] = await scanTable(systemTableName)
  if (!userSystemData?.length) console.error('No user system data found')

  // Update system data and build owner-system map
  const updatedSystemData: any[] = userSystemData.map((userDoc: any) => {
    const masterDoc = masterSystemData.find((m: any) => m.id === userDoc.masterId)
    if (masterDoc) {
      const { id, masterId, ownerId, createdAt, updatedAt } = userDoc
      ownerSystemMap.set(userDoc.ownerId, userDoc.id)
      console.log('System data updated')
      return { ...masterDoc, id, masterId, ownerId, createdAt, updatedAt }
    }
    console.error('No master system data found for user data')
    return userDoc
  })

  // Load all table data first for all tables
  const allTableData: Map<string, any[]> = new Map()
  for (const tableName of allTables) {
    if (!tableName) console.error('No table name found for user data')
    console.log(`Loading user data for ${tableName}`)
    const userTableName: string = await getTableName(
      tableName,
      domainTables.includes(tableName) ? 'domain' : 'feature',
      false
    )
    const userData: any[] = await scanTable(userTableName)
    allTableData.set(tableName, userData)
  }

  // First pass: Build complete master-to-user mapping for all tables
  for (const tableName of allTables) {
    if (!tableName) console.error('No table name found for master data')
    console.log(`Building master-to-user mapping for ${tableName}`)
    const masterTableName: string = await getTableName(
      `Master${tableName}`,
      domainTables.includes(tableName) ? 'domain' : 'feature',
      true
    )
    const masterData: any[] = await scanTable(masterTableName)
    const userData: any[] = allTableData.get(tableName) || []

    userData.forEach((userDoc: any) => {
      const masterDoc = masterData.find((m: any) => m.id === userDoc.masterId)
      if (masterDoc) {
        if (!masterToUserMap.has(masterDoc.id)) {
          masterToUserMap.set(masterDoc.id, [])
        }
        masterToUserMap.get(masterDoc.id).push({
          id: userDoc.id,
          ownerId: userDoc.ownerId,
        })
      }
    })
  }

  // Second pass: Process updates with complete mapping for all tables
  const updatedDocs: Map<string, any[]> = new Map()
  for (const tableName of allTables) {
    if (!tableName) console.error('No table name found for update docs')
    const masterTableName: string = await getTableName(
      `Master${tableName}`,
      domainTables.includes(tableName) ? 'domain' : 'feature',
      true
    )
    const userTableName: string = await getTableName(
      tableName,
      domainTables.includes(tableName) ? 'domain' : 'feature',
      false
    )

    const masterData: any[] = await scanTable(masterTableName)
    console.log(`Master data count ${tableName}:`, masterData.length)
    const userData: any[] = allTableData.get(tableName) || []
    console.log(`User data count ${tableName}:`, userData.length)

    const tableUpdates: any[] = []
    for (const userDoc of userData) {
      const masterDoc = masterData.find((m: any) => m.id === userDoc.masterId)
      if (masterDoc) {
        const { id, masterId, ownerId, createdAt, updatedAt } = userDoc
        const systemId = ownerSystemMap.get(userDoc.ownerId)

        const updatedDoc: any = {
          ...masterDoc,
          id,
          masterId,
          ownerId,
          createdAt,
          updatedAt,
          systemId,
        }

        // Update all references using the now-complete masterToUserMap
        const docWithFixedRefs = updateReferences(updatedDoc, ownerId)
        // Only push if docWithFixedRefs is different from userDoc
        if (!isEqual(docWithFixedRefs, userDoc)) {
          tableUpdates.push(docWithFixedRefs)
        }
      }
    }
    console.log('Update doc set for table:', userTableName)
    updatedDocs.set(userTableName, tableUpdates)
  }

  // Write updates to database for all tables
  for (const [tableName, docs] of updatedDocs) {
    console.log('Writing data to table:', tableName)
    if (!docs.length) console.error('No docs found for table:', tableName)
    for (const doc of docs) {
      await uploadData(tableName, doc)
    }
  }

  // Write system updates
  for (const doc of updatedSystemData) {
    console.log('Writing system data to table:', systemTableName)
    await uploadData(systemTableName, doc)
  }
}

const getTableName = async (tablePrefix: string, type: 'domain' | 'feature', master: boolean): Promise<string> => {
  try {
    const result = await client.listTables({})
    const matchingTables = result.TableNames?.filter((name: string) =>
      name.startsWith(`artk-${master ? 'admin' : 'user'}-${type}-stack-${tablePrefix}`)
    )
    if (matchingTables?.length === 0) {
      throw new Error(`No table found with prefix ${tablePrefix}`)
    }
    return matchingTables?.[0] || ''
  } catch (err: any) {
    console.error(`Error getting table name for prefix ${tablePrefix}:`, err)
    throw err
  }
}

const scanTable = async (tableName: string): Promise<any[]> => {
  try {
    const items: any[] = []
    let lastEvaluatedKey: any = null

    do {
      const params = {
        TableName: tableName,
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      }
      const result = await docClient.send(new ScanCommand(params))
      if (result.Items) {
        items.push(...result.Items)
      }
      lastEvaluatedKey = result.LastEvaluatedKey
    } while (lastEvaluatedKey)

    return items
  } catch (err: any) {
    console.error(`Error scanning table ${tableName}:`, err)
    throw err
  }
}

const uploadData = async (tableName: string, dataToInsert: any): Promise<void> => {
  const params = { TableName: tableName, Item: dataToInsert }
  try {
    await docClient.send(new PutCommand(params))
  } catch (err: any) {
    console.error(`Error updating item in ${tableName}:`, err)
  }
}

updateData()
  .then(() => {
    console.log('Data insertion completed.')
  })
  .catch((err) => {
    console.error('Error during data insertion:', err)
  })
