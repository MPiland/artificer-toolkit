import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
  QueryCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { v4 as uuidv4 } from 'uuid'

const cognitoClient = new CognitoIdentityProviderClient({})
const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const commonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
}

console.log('Lambda cold start init complete')

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log('Starting handler')
    if (!event.body) {
      console.log('Missing request body')
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing request body' }),
        headers: commonHeaders,
      }
    }

    const requestBody = JSON.parse(event.body)
    const { email, userId } = requestBody

    if (!userId) {
      console.log('User ID not found')
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User ID not found' }),
        headers: commonHeaders,
      }
    }

    console.log('User ID:', userId)

    const masterTables: Record<string, string> = {}
    const userTables: Record<string, string> = {}

    for (const [key, value] of Object.entries(process.env)) {
      if (!key.endsWith('_TABLE_NAME') || !value) continue

      const normalizedKey = key.toUpperCase()
      const logicalName = normalizedKey.replace('_TABLE_NAME', '').replace(/^MASTER/, '')

      if (normalizedKey.startsWith('MASTER')) {
        masterTables[logicalName] = value
      } else {
        userTables[logicalName] = value
      }
    }

    const idMap = new Map<string, string>()
    const processedDataSets = new Map<string, Record<string, string | object>[]>()

    for (const [logicalName, masterTableName] of Object.entries(masterTables)) {
      console.log('Processing table:', masterTableName)
      const masterData = await getMasterData(masterTableName)
      const processed = createInitialUserData(masterData, userId, idMap)
      processedDataSets.set(logicalName, processed)
    }

    // ✅ Update references using type-safe function
    for (const [logicalName, dataset] of processedDataSets.entries()) {
      console.log('Updating references for:', logicalName)
      processedDataSets.set(logicalName, updateReferencesInArray(dataset, idMap))
    }

    // Save to user tables
    for (const [logicalName, data] of processedDataSets.entries()) {
      const userTableName = userTables[logicalName]
      if (!userTableName) {
        console.warn(`No user table found for logical name: ${logicalName}. Skipping.`)
        continue
      }

      const newItems = await filterExistingItems(userTableName, data, userId)
      console.log(`Found ${newItems.length} new items to save to table: ${userTableName}`)
      if (newItems.length > 0) {
        console.log(`Saving ${newItems.length} items to table: ${userTableName}`)
        await batchWriteData(userTableName, newItems)
        const updateAttribute = new AdminUpdateUserAttributesCommand({
          UserPoolId: process.env.USER_POOL_ID,
          Username: email,
          UserAttributes: [
            {
              Name: 'custom:init_data_complete',
              Value: 'true',
            },
          ],
        })
        await cognitoClient.send(updateAttribute)
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'User data initialized successfully' }),
      headers: commonHeaders,
    }
  } catch (error) {
    console.error('Error initializing user data:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error initializing user data', error: String(error) }),
      headers: commonHeaders,
    }
  }
}

const getMasterData = async (tableName: string) => {
  console.log('Fetching data from table:', tableName)
  const response = await docClient.send(new ScanCommand({ TableName: tableName }))
  return response.Items || []
}

const createInitialUserData = (
  data: Record<string, string | object>[],
  userId: string,
  idMap: Map<string, string>
): Record<string, string | object>[] => {
  console.log('Creating initial user data')
  return data.map((item) => {
    const newItem = structuredClone(item)
    const oldId = newItem.id as string
    const newId = uuidv4()

    delete newItem.__typename
    newItem.id = newId
    newItem.masterId = oldId
    newItem.ownerId = userId

    idMap.set(oldId, newId)
    return newItem
  })
}

// ✅ Type-safe recursive reference update for arrays
const updateReferencesInArray = (
  data: Record<string, string | object>[],
  idMap: Map<string, string>
): Record<string, string | object>[] => {
  return data.map((item) => updateReferencesInObject(item, idMap))
}

// ✅ Type-safe recursive reference update for individual objects
const updateReferencesInObject = (
  obj: Record<string, string | object>,
  idMap: Map<string, string>
): Record<string, string | object> => {
  const result: Record<string, string | object> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'masterId' || key === 'ownerId') {
      result[key] = value
      continue
    }

    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      result[key] = value.map((id) => idMap.get(id) || id)
    } else if (typeof value === 'string' && idMap.has(value)) {
      result[key] = idMap.get(value) as string
    } else if (typeof value === 'object' && value !== null) {
      result[key] = updateReferencesInObject(value as Record<string, string | object>, idMap)
    } else {
      result[key] = value
    }
  }

  return result
}

const filterExistingItems = async (
  tableName: string,
  data: Record<string, string | object>[],
  userId: string
): Promise<Record<string, string | object>[]> => {
  console.log('Filtering existing items from table:', tableName)
  const existingMasterIds = new Set<string>()

  const commandParams: QueryCommandInput = {
    TableName: tableName,
    IndexName: 'ownerIndex',
    KeyConditionExpression: 'ownerId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
    ProjectionExpression: 'masterId',
  }

  const queryData = async (params: QueryCommandInput) => {
    const command = new QueryCommand(params)
    const response = await docClient.send(command)

    response.Items?.forEach((item: Record<string, string | object>) => {
      if (item && typeof item.masterId === 'string') {
        existingMasterIds.add(item.masterId)
      }
    })

    if (response.LastEvaluatedKey) {
      await queryData({ ...params, ExclusiveStartKey: response.LastEvaluatedKey })
    }
  }

  await queryData(commandParams)

  return data.filter((item: Record<string, string | object>) => {
    if (item && typeof item.masterId === 'string') {
      return !existingMasterIds.has(item.masterId)
    }
    return true
  })
}

const batchWriteData = async (tableName: string, data: Record<string, string | object>[]): Promise<void> => {
  console.log('Batch writing data')
  for (let i = 0; i < data.length; i += 25) {
    const batch = data.slice(i, i + 25).map((item) => ({ PutRequest: { Item: item } }))
    const command = new BatchWriteCommand({ RequestItems: { [tableName]: batch } })
    await docClient.send(command)
  }
}
