// cdk/lambda/getData.ts - Generic User Domain Data Aggregation
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb'
import type { AppSyncResolverHandler } from 'aws-lambda'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

interface GetEntityArgs {
  id: string
}

export const handler: AppSyncResolverHandler<GetEntityArgs, Record<string, unknown> | null> = async (event) => {
  try {
    const { id } = event.arguments
    const fieldName = event.info.fieldName

    // Determine which table to query based on the GraphQL field
    // Environment variables are set as: CLASS_TABLE, RACE_TABLE, etc.
    const entityName = fieldName.replace('get', '').toUpperCase()
    const tableEnvVar = `${entityName}_TABLE`

    const tableName = process.env[tableEnvVar]
    if (!tableName) {
      throw new Error(`Table environment variable ${tableEnvVar} not found`)
    }

    type Feature = {
      id: string
      spells?: string[]
      modifiers?: string[]
      proficiencies?: string[]
      expertise?: string[]
      senses?: string[]
      feats?: string[]
      options?: string[]
    }

    type FeatureOption = {
      id: string
      spells?: string[]
      modifiers?: string[]
      proficiencies?: string[]
      expertise?: string[]
      senses?: string[]
      feats?: string[]
    }

    // 1. Get the main entity (class, race, background, etc.)
    const entityResult = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { id },
      })
    )

    if (!entityResult.Item) {
      return null
    }

    const entityData = entityResult.Item

    // 2. Get features for this entity (features are stored as ID array in entity.features)
    const entityTypename = entityData?.__typename
    const featureIds = entityTypename !== 'Feature' ? entityData?.features || [] : [entityData?.id]
    const entityAncestry = entityTypename === 'Race' ? entityData?.ancestry : null
    const ancestryOptionIds =
      entityAncestry ? entityAncestry?.ancestryOptions
      : entityTypename === 'AncestryOption' ? [entityData?.id]
      : []

    if (!featureIds.length && !ancestryOptionIds.length) {
      return entityData
    }

    const ancestryOptions = (await batchGetByIds(process.env.ANCESTRYOPTION_TABLE!, ancestryOptionIds)) as {
      features?: string[]
      id: string
    }[]

    const allFeatureIds = [...ancestryOptions.flatMap((f) => f.features || []), ...featureIds]

    // 3. Batch get all features
    const features = (await batchGetByIds(process.env.FEATURE_TABLE!, allFeatureIds)) as Feature[]

    const allOptionIds =
      entityTypename === 'FeatureOption' ? [entityData?.id]
      : entityTypename === 'Feat' ? entityData?.options || []
      : features.flatMap((f) => f.options || [])

    const options = (await batchGetByIds(process.env.FEATUREOPTION_TABLE!, allOptionIds)) as FeatureOption[]

    // 4. Collect all sub-entity IDs from features
    const allSpellIds = [...features.flatMap((f) => f.spells || []), ...options.flatMap((f) => f.spells || [])]
    const allModifierIds = [...features.flatMap((f) => f.modifiers || []), ...options.flatMap((f) => f.modifiers || [])]
    const allProficiencyIds = [
      ...features.flatMap((f) => f.proficiencies || []),
      ...options.flatMap((f) => f.proficiencies || []),
    ]
    const allExpertiseIds = [
      ...features.flatMap((f) => f.expertise || []),
      ...options.flatMap((f) => f.expertise || []),
    ]
    const allSenseIds = [...features.flatMap((f) => f.senses || []), ...options.flatMap((f) => f.senses || [])]
    const allFeatIds = [...features.flatMap((f) => f.feats || []), ...options.flatMap((f) => f.feats || [])]
    // 5. Batch get all feature sub-data in parallel
    const [spells, modifiers, proficiencies, expertise, senses, feats] = await Promise.all([
      batchGetByIds(process.env.FEATURESPELL_TABLE!, allSpellIds),
      batchGetByIds(process.env.FEATUREMODIFIER_TABLE!, allModifierIds),
      batchGetByIds(process.env.FEATUREPROFICIENCY_TABLE!, allProficiencyIds),
      batchGetByIds(process.env.FEATUREEXPERTISE_TABLE!, allExpertiseIds),
      batchGetByIds(process.env.FEATURESENSE_TABLE!, allSenseIds),
      batchGetByIds(process.env.FEATUREFEAT_TABLE!, allFeatIds),
    ])

    // 6. Create lookup maps for performance
    const spellMap = new Map(spells.map((s) => [s.id, s]))
    const modifierMap = new Map(modifiers.map((m) => [m.id, m]))
    const proficiencyMap = new Map(proficiencies.map((p) => [p.id, p]))
    const expertiseMap = new Map(expertise.map((e) => [e.id, e]))
    const senseMap = new Map(senses.map((s) => [s.id, s]))
    const featMap = new Map(feats.map((f) => [f.id, f]))

    const enrichFeature = (feature: Feature) => {
      return {
        ...feature,
        spells: feature.spells?.length ? feature.spells.map((id) => spellMap.get(id)).filter(Boolean) : null,
        modifiers:
          feature.modifiers?.length ? feature.modifiers.map((id) => modifierMap.get(id)).filter(Boolean) : null,
        proficiencies:
          feature.proficiencies?.length ?
            feature.proficiencies.map((id) => proficiencyMap.get(id)).filter(Boolean)
          : null,
        expertise:
          feature.expertise?.length ? feature.expertise.map((id) => expertiseMap.get(id)).filter(Boolean) : null,
        senses: feature.senses?.length ? feature.senses.map((id) => senseMap.get(id)).filter(Boolean) : null,
        feats: feature.feats?.length ? feature.feats.map((id) => featMap.get(id)).filter(Boolean) : null,
      }
    }

    const enrichOption = (option: FeatureOption) => {
      return {
        ...option,
        spells: option.spells?.length ? option.spells.map((id) => spellMap.get(id)).filter(Boolean) : null,
        modifiers: option.modifiers?.length ? option.modifiers.map((id) => modifierMap.get(id)).filter(Boolean) : null,
        proficiencies:
          option.proficiencies?.length ?
            option.proficiencies.map((id) => proficiencyMap.get(id)).filter(Boolean)
          : null,
        expertise: option.expertise?.length ? option.expertise.map((id) => expertiseMap.get(id)).filter(Boolean) : null,
        senses: option.senses?.length ? option.senses.map((id) => senseMap.get(id)).filter(Boolean) : null,
        feats: option.feats?.length ? option.feats.map((id) => featMap.get(id)).filter(Boolean) : null,
      }
    }

    const enrichedOptions = options.map((option) => enrichOption(option))

    // 7. Assemble features with their sub-data
    const enrichedFeatures =
      entityTypename !== 'FeatureOption' ? features.map((feature) => enrichFeature(feature)) : null

    const entrichedAncestryOptions =
      entityTypename === 'Race' || entityTypename === 'AncestryOption' ?
        ancestryOptions.map((option) => ({
          ...option,
          features: enrichedFeatures?.length ? enrichedFeatures.filter((f) => option.features?.includes(f.id)) : null,
        }))
      : null

    if (entityTypename === 'Race' && entityAncestry && entrichedAncestryOptions?.length) {
      if (enrichedFeatures?.length) {
        return {
          ...entityData,
          features: enrichedFeatures,
          ancestry: {
            options: entrichedAncestryOptions,
          },
        }
      }
      return {
        ...entityData,
        features: null,
        ancestry: {
          options: entrichedAncestryOptions,
        },
      }
    }

    if (entityTypename === 'Feat' && enrichedOptions?.length) {
      return {
        ...entityData,
        options: enrichedOptions,
        features: enrichedFeatures,
      }
    }

    if (entityTypename === 'AncestryOption' && entrichedAncestryOptions?.length === 1) {
      return {
        ...entityData,
        ...entrichedAncestryOptions[0],
      }
    }

    if (entityTypename === 'Feature' && enrichedFeatures?.length === 1) {
      return {
        ...entityData,
        ...enrichedFeatures[0],
      }
    }

    if (entityTypename === 'FeatureOption' && enrichedOptions?.length === 1) {
      return {
        ...entityData,
        ...enrichedOptions[0],
      }
    }

    if (enrichedFeatures?.length) {
      return {
        ...entityData,
        features: enrichedFeatures,
      }
    }

    // 8. Return complete entity with enriched features
    return {
      ...entityData,
    }
  } catch (error) {
    console.error(`Error in ${event.info.fieldName} resolver:`, error)
    throw error
  }
}

async function batchGetByIds(tableName: string, ids: string[]) {
  if (ids.length === 0) return []

  // DynamoDB BatchGetItem has a 100 item limit, so chunk if needed
  const chunks = []
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100))
  }

  const results = await Promise.all(
    chunks.map((chunk) =>
      docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName]: {
              Keys: chunk.map((id) => ({ id })),
            },
          },
        })
      )
    )
  )

  return results.flatMap((result) => result.Responses?.[tableName] || [])
}
