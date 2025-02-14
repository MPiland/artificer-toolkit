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

  // First phase: Create all new user data and build complete ID mapping
  masterData.forEach((dataset, index) => {
    const processedData = createInitialUserData(dataset, userId, idMap)
    processedDataSets.set(masterTableNames[index], processedData)
  })

  // Second phase: Update all references using complete mapping
  processedDataSets.forEach((dataset, tableName) => {
    const updatedDataset = updateReferences(dataset, idMap)
    processedDataSets.set(tableName, updatedDataset)
  })

  // Finally, write the fully processed data
  await Promise.all(
    Array.from(processedDataSets.entries()).map(async ([tableName, data]) => {
      const userTableName = await getTableName(tableName.replace('Master', ''))
      const itemsToCreate = await filterExistingItems(userTableName, data, userId)
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

const updateReferences = (
  data: any[] | Record<string, any>,
  idMap: Map<string, string>
): any[] | Record<string, any> => {
  if (!data) return data

  if (Array.isArray(data)) {
    return data.map((item) => updateReferences(item, idMap))
  }

  if (typeof data === 'object' && data !== null) {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(data)) {
      if (key === 'masterId' || key === 'ownerId') {
        result[key] = value
        continue
      }

      if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        result[key] = value.map((id) => idMap.get(id) || id)
      } else if (typeof value === 'string' && idMap.has(value)) {
        result[key] = idMap.get(value)
      } else if (typeof value === 'object' && value !== null) {
        result[key] = updateReferences(value, idMap)
      } else {
        result[key] = value
      }
    }
    return result
  }

  return data
}

const filterExistingItems = async (tableName: string, data: any[], userId: string) => {
  const newItems = await Promise.all(
    data.map(async (item: any) => {
      const existingItemCheck = await docClient.send(
        new ScanCommand({
          TableName: tableName,
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
  return newItems.filter((item): item is any => item !== null)
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
    for (let i = 0; i < data.length; i += 25) {
      const batchItems = data.slice(i, i + 25).map((item) => ({
        PutRequest: { Item: item },
      }))
      batches.push(batchItems)
    }
    for (const batch of batches) {
      const command = new BatchWriteCommand({ RequestItems: { [tableName]: batch } })
      await docClient.send(command)
    }
  }
}
