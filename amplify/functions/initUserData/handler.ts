import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { PostConfirmationTriggerHandler } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const userId = event.request.userAttributes.sub
  const idMap = new Map()
  const processedDataSets = new Map<string, any>()

  const masterTableNames = [
    'MasterSystemTable',
    'MasterSpellTable',
    'MasterRaceTable',
    'MasterClassTable',
    'MasterEquipmentTable',
    'MasterBackgroundTable',
    'MasterFeatTable',
  ]

  // Get all master data
  const masterData = await Promise.all(masterTableNames.map((tableName) => getMasterData(tableName)))

  // First pass: Create new IDs and build mapping
  // Process system data first to ensure we have the system ID mapping
  const systemIndex = masterTableNames.indexOf('MasterSystemTable')
  if (systemIndex !== -1) {
    const systemData = createInitialUserData(masterData[systemIndex], userId, idMap)
    processedDataSets.set(masterTableNames[systemIndex], systemData)
  }

  // Process remaining data with system ID mapping available
  masterData.forEach((dataset, index) => {
    if (index !== systemIndex) {
      const processedData = createInitialUserData(dataset, userId, idMap)
      processedDataSets.set(masterTableNames[index], processedData)
    }
  })

  // Second pass: Update all references using the complete mapping
  processedDataSets.forEach((dataset, tableName) => {
    const updatedDataset = updateReferences(dataset, idMap)
    processedDataSets.set(tableName, updatedDataset)
  })

  // Finally, write the fully processed data
  await Promise.all(
    Array.from(processedDataSets.entries()).map(async ([tableName, data]) => {
      const userTableName = await getTableName(tableName.replace('Master', ''))

      // Filter out items that already exist for this user
      const newItems = await Promise.all(
        data.map(async (item: any) => {
          const existingItemCheck = await docClient.send(
            new ScanCommand({
              TableName: userTableName,
              FilterExpression: 'masterId = :masterId AND ownerId = :userId',
              ExpressionAttributeValues: {
                ':masterId': item.masterId,
                ':userId': userId,
              },
            })
          )

          return existingItemCheck.Items?.length ? null : item
        })
      )

      // Only batch write items that don't exist yet
      const itemsToCreate = newItems.filter((item) => item !== null)
      if (itemsToCreate.length > 0) {
        return batchWriteData(userTableName, itemsToCreate)
      }
    })
  )

  return event
}

const createInitialUserData = (data: Record<string, any>[] | undefined, userId: string, idMap: Map<string, string>) => {
  return data?.map((item: any) => {
    const userData = JSON.parse(JSON.stringify(item))
    const oldId = userData.id
    const newId = uuidv4()

    delete userData.__typename
    userData.id = newId
    userData.masterId = oldId
    userData.ownerId = userId

    idMap.set(oldId, newId)
    return userData
  })
}

const updateReferences = (data: any[], idMap: Map<string, string>) => {
  const updateValue = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map((item) => updateValue(item))
    }

    if (typeof value === 'object' && value != null) {
      const updated = JSON.parse(JSON.stringify(value))
      Object.keys(updated).forEach((key) => {
        // Handle any string that might be an ID
        if (typeof updated[key] === 'string' && key !== 'masterId') {
          const mappedId = idMap.get(updated[key])
          if (mappedId != null) {
            updated[key] = mappedId
          }
        }
        // Handle arrays of IDs
        else if (Array.isArray(updated[key]) && updated[key].every((item) => typeof item === 'string')) {
          updated[key] = updated[key].map((id: string) => {
            const mappedId = idMap.get(id)
            if (mappedId != null) {
              return mappedId
            }
            return id
          })
        }
        // Handle arrays of numbers
        else if (Array.isArray(updated[key]) && updated[key].every((item) => typeof item === 'number')) {
          return updated[key]
        }
        // Recurse into nested objects
        else if (typeof updated[key] === 'object') {
          updated[key] = updateValue(updated[key])
        }
      })
      return updated
    }
  }

  return data.map((item) => updateValue(item))
}

const getTableName = async (tablePrefix: string) => {
  try {
    const command = new ListTablesCommand({})
    const response = await client.send(command)
    const matchingTable = response.TableNames?.find((name) => name.startsWith(`ArtificerToolkitStack-${tablePrefix}`))
    if (matchingTable) {
      return matchingTable
    }
    throw new Error(`No table found with prefix: ${tablePrefix}`)
  } catch (error) {
    console.error('Error retrieving table name:', error)
    throw error
  }
}

const getMasterData = async (tableName: string) => {
  const dbTableName = await getTableName(tableName)
  const command = new ScanCommand({
    TableName: dbTableName,
  })

  const response = await docClient.send(command)
  return response.Items
}

const batchWriteData = async (tableName: string, data: Record<string, any>[] | undefined) => {
  const batches = []

  if (data) {
    for (let i = 0; i < data?.length; i += 25) {
      const batchItems = data.slice(i, i + 25).map((item) => {
        // Deep inspect the item for any undefined values
        JSON.stringify(item, (key, value) => {
          if (value === null || value === undefined) {
            console.log('Found null/undefined:', { key, value, item })
          }
          return value
        })
        return {
          PutRequest: { Item: item },
        }
      })
      batches.push(batchItems)
    }

    for (const batch of batches) {
      const command = new BatchWriteCommand({ RequestItems: { [tableName]: batch } })
      await docClient.send(command)
    }
  }
}
