// cdk/lambda/updateData.ts - Simplified Linear Update Processing
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { AppSyncIdentityCognito, AppSyncResolverHandler } from 'aws-lambda'
import { isEqual } from 'lodash'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

type DomainFeature = {
  id: string
  spells?: { id: string; [key: string]: unknown }[]
  modifiers?: { id: string; [key: string]: unknown }[]
  proficiencies?: { id: string; [key: string]: unknown }[]
  expertise?: { id: string; [key: string]: unknown }[]
  senses?: { id: string; [key: string]: unknown }[]
  feats?: { id: string; [key: string]: unknown }[]
  options?: {
    id: string
    spells?: { id: string; [key: string]: unknown }[]
    modifiers?: { id: string; [key: string]: unknown }[]
    proficiencies?: { id: string; [key: string]: unknown }[]
    expertise?: { id: string; [key: string]: unknown }[]
    senses?: { id: string; [key: string]: unknown }[]
    feats?: { id: string; [key: string]: unknown }[]
    [key: string]: unknown
  }[]
}

type DomainAncestryOption = {
  id: string
  features?: DomainFeature[] | null
}

type DomainOption = {
  id: string
  spells?: { id: string; [key: string]: unknown }[]
  modifiers?: { id: string; [key: string]: unknown }[]
  proficiencies?: { id: string; [key: string]: unknown }[]
  expertise?: { id: string; [key: string]: unknown }[]
  senses?: { id: string; [key: string]: unknown }[]
  feats?: { id: string; [key: string]: unknown }[]
  [key: string]: unknown
}

type DomainData = {
  id: string
  features?: DomainFeature[] | null
  ancestry?: {
    options?: DomainAncestryOption[] | null
  }
  options?: DomainOption[] | null
}

type DomainInput = {
  id: string
  features?: string[] | null
  ancestry?: {
    options?: string[] | null
  }
  options?: string[] | null
  [key: string]: unknown
}

type FeatureInput = {
  id: string
  spells?: string[] | null
  modifiers?: string[] | null
  proficiencies?: string[] | null
  expertise?: string[] | null
  senses?: string[] | null
  feats?: string[] | null
  options?: string[] | null
  [key: string]: unknown
}

type OptionInput = {
  id: string
  spells?: string[] | null
  modifiers?: string[] | null
  proficiencies?: string[] | null
  expertise?: string[] | null
  senses?: string[] | null
  feats?: string[] | null
  [key: string]: unknown
}

type SubFeatureInput = {
  id: string
  [key: string]: unknown
}

type AncestryOptionInput = {
  id: string
  features?: string[] | null
  [key: string]: unknown
}

export const handler: AppSyncResolverHandler<
  { input: DomainData },
  DomainInput | FeatureInput | OptionInput | AncestryOptionInput | null
> = async (event) => {
  try {
    const { input } = event.arguments
    const fieldName = event.info.fieldName

    // Get ownerId from event context
    const ownerId = (event.identity as AppSyncIdentityCognito)?.sub || event.request?.headers?.authorization
    if (!ownerId) {
      throw new Error('User not authenticated')
    }

    // Determine entity type from GraphQL field (updateClass, updateRace, etc.)
    const entityName = fieldName.replace('update', '').toUpperCase()
    const tableEnvVar = `${entityName}_TABLE`
    const tableName = process.env[tableEnvVar]
    if (!tableName) {
      throw new Error(`Table environment variable ${tableEnvVar} not found`)
    }

    // 1. Get current domain item
    const currentEntityResult = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { id: input.id },
      })
    )
    const currentEntity = currentEntityResult.Item as DomainInput
    const entityKind = currentEntity.__kind

    const isNewDomainItem = !currentEntity

    // 2. Fetch ALL user data at once by ownerId
    const [
      currentFeatures,
      currentSpells,
      currentModifiers,
      currentProficiencies,
      currentExpertise,
      currentSenses,
      currentFeats,
      currentOptions,
      currentAncestryOptions,
    ] = await Promise.all([
      queryByOwnerId(process.env.FEATURE_TABLE!, ownerId),
      queryByOwnerId(process.env.FEATURESPELL_TABLE!, ownerId),
      queryByOwnerId(process.env.FEATUREMODIFIER_TABLE!, ownerId),
      queryByOwnerId(process.env.FEATUREPROFICIENCY_TABLE!, ownerId),
      queryByOwnerId(process.env.FEATUREEXPERTISE_TABLE!, ownerId),
      queryByOwnerId(process.env.FEATURESENSE_TABLE!, ownerId),
      queryByOwnerId(process.env.FEATUREFEAT_TABLE!, ownerId),
      queryByOwnerId(process.env.FEATUREOPTION_TABLE!, ownerId),
      queryByOwnerId(process.env.ANCESTRYOPTION_TABLE!, ownerId),
    ])

    const dataToNameMap = {
      features: {
        tableName: process.env.FEATURE_TABLE!,
        current: currentFeatures as FeatureInput[],
        updated: new Map<string, FeatureInput>(),
        deleted: new Set<string>(),
      },
      spells: {
        tableName: process.env.FEATURESPELL_TABLE!,
        current: currentSpells as SubFeatureInput[],
        updated: new Map<string, SubFeatureInput>(),
        deleted: new Set<string>(),
      },
      modifiers: {
        tableName: process.env.FEATUREMODIFIER_TABLE!,
        current: currentModifiers as SubFeatureInput[],
        updated: new Map<string, SubFeatureInput>(),
        deleted: new Set<string>(),
      },
      proficiencies: {
        tableName: process.env.FEATUREPROFICIENCY_TABLE!,
        current: currentProficiencies as SubFeatureInput[],
        updated: new Map<string, SubFeatureInput>(),
        deleted: new Set<string>(),
      },
      expertise: {
        tableName: process.env.FEATUREEXPERTISE_TABLE!,
        current: currentExpertise as SubFeatureInput[],
        updated: new Map<string, SubFeatureInput>(),
        deleted: new Set<string>(),
      },
      senses: {
        tableName: process.env.FEATURESENSE_TABLE!,
        current: currentSenses as SubFeatureInput[],
        updated: new Map<string, SubFeatureInput>(),
        deleted: new Set<string>(),
      },
      feats: {
        tableName: process.env.FEATUREFEAT_TABLE!,
        current: currentFeats as SubFeatureInput[],
        updated: new Map<string, SubFeatureInput>(),
        deleted: new Set<string>(),
      },
      options: {
        tableName: process.env.FEATUREOPTION_TABLE!,
        current: currentOptions as OptionInput[],
        updated: new Map<string, OptionInput>(),
        deleted: new Set<string>(),
      },
      ancestryOptions: {
        tableName: process.env.ANCESTRYOPTION_TABLE!,
        current: currentAncestryOptions as AncestryOptionInput[],
        updated: new Map<string, AncestryOptionInput>(),
        deleted: new Set<string>(),
      },
    }

    // Query all items by ownerId
    async function queryByOwnerId(tableName: string, ownerId: string) {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'OwnerIndex', // Assuming GSI on ownerId
          KeyConditionExpression: 'ownerId = :ownerId',
          ExpressionAttributeValues: {
            ':ownerId': ownerId,
          },
        })
      )
      return result.Items || []
    }

    async function processSubArrays({
      spells,
      modifiers,
      proficiencies,
      expertise,
      senses,
      feats,
    }: {
      spells?: SubFeatureInput[]
      modifiers?: SubFeatureInput[]
      proficiencies?: SubFeatureInput[]
      expertise?: SubFeatureInput[]
      senses?: SubFeatureInput[]
      feats?: SubFeatureInput[]
    }): Promise<{
      spells?: SubFeatureInput[]
      modifiers?: SubFeatureInput[]
      proficiencies?: SubFeatureInput[]
      expertise?: SubFeatureInput[]
      senses?: SubFeatureInput[]
      feats?: SubFeatureInput[]
    }> {
      return {
        spells: (await Promise.all(
          spells?.map((spell) => processSubFeature({ type: 'spells', newSubItem: spell })).filter(Boolean) || []
        )) as SubFeatureInput[],
        modifiers: (await Promise.all(
          modifiers
            ?.map((modifier) => processSubFeature({ type: 'modifiers', newSubItem: modifier }))
            .filter(Boolean) || []
        )) as SubFeatureInput[],
        proficiencies: (await Promise.all(
          proficiencies
            ?.map((proficiency) => processSubFeature({ type: 'proficiencies', newSubItem: proficiency }))
            .filter(Boolean) || []
        )) as SubFeatureInput[],
        expertise: (await Promise.all(
          expertise
            ?.map((expertise) => processSubFeature({ type: 'expertise', newSubItem: expertise }))
            .filter(Boolean) || []
        )) as SubFeatureInput[],
        senses: (await Promise.all(
          senses?.map((sense) => processSubFeature({ type: 'senses', newSubItem: sense })).filter(Boolean) || []
        )) as SubFeatureInput[],
        feats: (await Promise.all(
          feats?.map((feat) => processSubFeature({ type: 'feats', newSubItem: feat })).filter(Boolean) || []
        )) as SubFeatureInput[],
      }
    }

    // Process domain - single entry point
    async function processDomain(
      newDomainData: DomainData
    ): Promise<DomainData | FeatureInput | OptionInput | AncestryOptionInput | null> {
      if (entityKind === 'FeatureInput') {
        const featureData = await processFeature(newDomainData as DomainFeature)
        return featureData
      }
      if (entityKind === 'AncestryOptionInput') {
        const optionData = await processAncestryOption(newDomainData as DomainAncestryOption)
        return optionData
      }
      if (entityKind === 'FeatureOptionInput') {
        const optionData = await processOption(newDomainData as DomainOption)
        return optionData
      }
      const { features, ancestry, options, ...domainFields } = newDomainData

      const processedAncestryOptions = (await Promise.all(
        ancestry?.options?.map(processAncestryOption) || []
      )) as AncestryOptionInput[]

      // Process features
      const processedFeatures = (await Promise.all(
        features?.map(processFeature).filter(Boolean) || []
      )) as FeatureInput[]

      const processedOptions = (await Promise.all(options?.map(processOption).filter(Boolean) || [])) as OptionInput[]

      // Create final domain data
      const domainData = {
        ...domainFields,
        features: processedFeatures?.length ? processedFeatures.map((feature) => feature.id) : null,
        ancestry:
          newDomainData?.ancestry ?
            {
              options: processedAncestryOptions?.length ? processedAncestryOptions.map((option) => option.id) : null,
            }
          : null,
        options: processedOptions?.length ? processedOptions.map((option) => option.id) : null,
      }

      if (!isNewDomainItem) {
        if (currentEntity?.features?.length) {
          domainData.features?.forEach((featureId) => {
            if (!currentEntity?.features?.includes(featureId)) {
              dataToNameMap.features.deleted.add(featureId)
            }
          })
        }
        if (currentEntity?.ancestry?.options?.length) {
          domainData.ancestry?.options?.forEach((optionId) => {
            if (!currentEntity?.ancestry?.options?.includes(optionId)) {
              dataToNameMap.ancestryOptions.deleted.add(optionId)
            }
          })
        }
      }
      return domainData
    }

    async function processAncestryOption(newOption?: DomainAncestryOption): Promise<AncestryOptionInput | null> {
      if (!newOption) return null
      const { features, ...optionFields } = newOption

      const processedFeatures = (await Promise.all(
        features?.map(processFeature).filter(Boolean) || []
      )) as FeatureInput[]

      const optionData = {
        ...optionFields,
        features: processedFeatures?.length ? processedFeatures.map((feature) => feature.id) : null,
      }

      const currentOption = dataToNameMap.ancestryOptions.current.find((item) => item.id === newOption.id)
      if ((currentOption && !isEqual(optionData, currentOption)) || isNewDomainItem || !currentOption) {
        dataToNameMap.ancestryOptions.updated.set(newOption.id, optionData)
      } else if (!dataToNameMap.ancestryOptions.current.some((item) => item.id === newOption.id)) {
        dataToNameMap.ancestryOptions.updated.set(newOption.id, optionData)
      }
      return optionData
    }

    async function processFeature(newFeature?: DomainFeature): Promise<FeatureInput | null> {
      if (!newFeature) return null
      const { spells, modifiers, proficiencies, expertise, senses, feats, options, ...featureFields } = newFeature

      const processedOptions = (await Promise.all(options?.map(processOption).filter(Boolean) || [])) as OptionInput[]

      // Process sub-features
      const {
        spells: spellIds,
        modifiers: modifierIds,
        proficiencies: proficiencyIds,
        expertise: expertiseIds,
        senses: senseIds,
        feats: featIds,
      } = await processSubArrays({
        spells,
        modifiers,
        proficiencies,
        expertise,
        senses,
        feats,
      })

      const subArrayData = {
        spells: spellIds?.length ? spellIds.map((spell) => spell.id) : null,
        modifiers: modifierIds?.length ? modifierIds.map((modifier) => modifier.id) : null,
        proficiencies: proficiencyIds?.length ? proficiencyIds.map((proficiency) => proficiency.id) : null,
        expertise: expertiseIds?.length ? expertiseIds.map((expertise) => expertise.id) : null,
        senses: senseIds?.length ? senseIds.map((sense) => sense.id) : null,
        feats: featIds?.length ? featIds.map((feat) => feat.id) : null,
      }

      const featureData = {
        ...featureFields,
        ...subArrayData,
        options: processedOptions?.length ? processedOptions.map((option) => option.id) : null,
      }

      const currentFeature = dataToNameMap.features.current.find((item) => item.id === newFeature.id)
      if ((currentFeature && !isEqual(currentFeature, featureData)) || isNewDomainItem || !currentFeature) {
        dataToNameMap.features.updated.set(newFeature.id, featureData)
      }
      currentFeature?.options?.forEach((option) => {
        if (!featureData?.options?.includes(option) || !featureData?.options?.length) {
          dataToNameMap.options.deleted.add(option)
        }
      })
      Object.keys(subArrayData).forEach((key) => {
        const typedKey = key as keyof typeof subArrayData
        currentFeature?.[typedKey]?.forEach((item) => {
          if (!featureData?.[typedKey]?.includes(item) || !featureData[typedKey].length) {
            dataToNameMap[typedKey].deleted.add(item)
          }
        })
      })
      return featureData
    }

    async function processOption(newOption?: DomainOption): Promise<OptionInput | null> {
      if (!newOption) return null
      const { spells, modifiers, proficiencies, expertise, senses, feats, ...optionFields } = newOption
      const {
        spells: spellIds,
        modifiers: modifierIds,
        proficiencies: proficiencyIds,
        expertise: expertiseIds,
        senses: senseIds,
        feats: featIds,
      } = await processSubArrays({
        spells,
        modifiers,
        proficiencies,
        expertise,
        senses,
        feats,
      })

      const subArrayData = {
        spells: spellIds?.length ? spellIds.map((spell) => spell.id) : null,
        modifiers: modifierIds?.length ? modifierIds.map((modifier) => modifier.id) : null,
        proficiencies: proficiencyIds?.length ? proficiencyIds.map((proficiency) => proficiency.id) : null,
        expertise: expertiseIds?.length ? expertiseIds.map((expertise) => expertise.id) : null,
        senses: senseIds?.length ? senseIds.map((sense) => sense.id) : null,
        feats: featIds?.length ? featIds.map((feat) => feat.id) : null,
      }
      const optionData = {
        ...optionFields,
        ...subArrayData,
      }

      const currentOption = dataToNameMap.options.current.find((item) => item.id === newOption.id)

      if ((currentOption && !isEqual(optionData, currentOption)) || isNewDomainItem || !currentOption) {
        dataToNameMap.options.updated.set(newOption.id, optionData)
      } else if (!dataToNameMap.options.current.some((item) => item.id === newOption.id)) {
        dataToNameMap.options.updated.set(newOption.id, optionData)
      }
      return optionData
    }

    // Process sub-features - linear processing
    async function processSubFeature({
      type,
      newSubItem,
    }: {
      type: keyof typeof dataToNameMap
      newSubItem?: { id: string; [key: string]: unknown }
    }): Promise<SubFeatureInput | null> {
      if (!newSubItem) return null

      const currentSubFeature = dataToNameMap[type].current.find((item) => item.id === newSubItem.id)
      if ((currentSubFeature && !isEqual(currentSubFeature, newSubItem)) || isNewDomainItem || !currentSubFeature) {
        dataToNameMap[type].updated.set(newSubItem.id, newSubItem)
      }

      return newSubItem
    }

    async function putItem(item: DomainInput | FeatureInput | OptionInput | AncestryOptionInput | null) {
      if (!item) return
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: item,
        })
      )
    }

    // Batch operations
    async function batchUpdateItems() {
      Object.entries(dataToNameMap).forEach(async ([, map]) => {
        if (map.updated.size > 0) {
          const items = Array.from(map.updated.values())
          const chunks = []
          for (let i = 0; i < items.length; i += 25) {
            chunks.push(items.slice(i, i + 25))
          }

          await Promise.all(
            chunks.map((chunk) =>
              docClient.send(
                new BatchWriteCommand({
                  RequestItems: {
                    [map.tableName]: chunk.map((item) => ({
                      PutRequest: { Item: item },
                    })),
                  },
                })
              )
            )
          )
        }
      })
    }

    async function batchDeleteItems() {
      Object.entries(dataToNameMap).forEach(async ([, map]) => {
        if (map.deleted.size > 0) {
          const items = Array.from(map.deleted.values())
          const chunks = []
          for (let i = 0; i < items.length; i += 25) {
            chunks.push(items.slice(i, i + 25))
          }

          await Promise.all(
            chunks.map((chunk) =>
              docClient.send(
                new BatchWriteCommand({
                  RequestItems: {
                    [map.tableName]: chunk.map((id) => ({
                      DeleteRequest: { Key: { id } },
                    })),
                  },
                })
              )
            )
          )
        }
      })
    }

    const result = await processDomain(input)
    await putItem(result)
    await batchUpdateItems()
    await batchDeleteItems()

    return result
  } catch (error) {
    console.error(`Error in ${event.info.fieldName} resolver:`, error)
    throw error
  }
}
