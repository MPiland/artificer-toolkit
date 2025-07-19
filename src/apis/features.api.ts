import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { listFeatures, listMasterFeatures, getFeature, getMasterFeature } from '@/queries'
import type { FeatureInput, Feature, QueryListFeaturesArgs, QueryListMasterFeaturesArgs } from 'gql/types'
import {
  createFeature,
  createMasterFeature,
  updateFeature,
  updateMasterFeature,
  deleteMasterFeature,
  deleteFeature,
} from '@/mutations'

const featuresKeys = {
  all: ['features'] as const,
  lists: () => [...featuresKeys.all, 'list'] as const,
  single: (id: string) => [...featuresKeys.all, 'single', id] as const,
}

export const fetchFeatures = (systemPref: string) => {
  return queryOptions({
    queryKey: featuresKeys.lists(),
    queryFn: async () => {
      let allData: { features: Feature[] } = {
        features: [],
      }
      let nextToken: string | null = null

      const { featureClient, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeaturesArgs | QueryListMasterFeaturesArgs

      const isMaster = (data: unknown): data is { listMasterFeatures: unknown } => {
        return typeof data === 'object' && data !== null && 'listMasterFeatures' in data
      }

      const operation = master ? listMasterFeatures : listFeatures

      let variables: ListVariables = {
        limit: 1000,
        nextToken,
      }

      if (!master) {
        variables = {
          ...variables,
          systemId: systemPref,
        }
      }

      try {
        do {
          const { data } = await featureClient.graphql({
            query: operation,
            variables: variables,
          })

          const result = isMaster(data) ? data.listMasterFeatures : data.listFeatures

          allData = { features: [...allData.features, ...result.items] }
          nextToken = result.nextToken || null
        } while (nextToken)

        if (allData.features.length) {
          allData.features.sort((a, b) => {
            if (a && b) {
              if (a.label && !b.label) {
                return -1
              }
              if (b.label && !a.label) {
                return 1
              }
              if (b.label && a.label) {
                return a.label.localeCompare(b.label)
              }
              return 0
            }
            if (a) {
              return -1
            }
            if (b) {
              return 1
            }
            return 0
          })
        }
        return allData
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const fetchFeature = (id: string) => {
  return queryOptions({
    queryKey: featuresKeys.single(id),
    queryFn: async () => {
      const { featureClient, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { getMasterFeature: unknown } {
        return typeof data === 'object' && data !== null && 'getMasterFeature' in data
      }

      const operation = master ? getMasterFeature : getFeature

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeature
        } else {
          return data.getFeature
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const useAddNewFeatureMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Feature, Error, FeatureInput, unknown>({
    mutationFn: async (feature: FeatureInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? createMasterFeature : createFeature

      function isMaster(data: unknown): data is { createMasterFeature: unknown } {
        return typeof data === 'object' && data !== null && 'createMasterFeature' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: feature,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeature
        } else {
          return data.createFeature
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (feature: Feature) => {
      queryClient.setQueryData(featuresKeys.all, (previous: Feature[]) => {
        if (!previous) return [feature]
        return [...previous, feature]
      })
    },
  })
}

export const useUpdateFeatureMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<Feature, Error, FeatureInput, unknown>({
    mutationFn: async (feature: FeatureInput) => {
      const { featureClient, master } = await getClient()

      const operation = master ? updateMasterFeature : updateFeature

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { updateMasterFeature: unknown } {
        return typeof data === 'object' && data !== null && 'updateMasterFeature' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            input: feature,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeature
        } else {
          return data.updateFeature
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (feature: Feature) => {
      queryClient.setQueryData(featuresKeys.all, (previous: Feature[]) =>
        previous?.map((featureKey) => (featureKey.id === feature.id ? feature : featureKey))
      )
    },
  })
}

export const useDeleteFeatureMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { featureClient, master } = await getClient()

      const operation = master ? deleteMasterFeature : deleteFeature

      // Type guard to check which response we got
      function isMaster(data: unknown): data is { deleteMasterFeature: unknown } {
        return typeof data === 'object' && data !== null && 'deleteMasterFeature' in data
      }

      try {
        const { data } = await featureClient.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeature
        } else {
          return data.deleteFeature
        }
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featuresKeys.all, (previous: Feature[]) => {
        const feature = previous.find((featureKey) => featureKey.id === id)
        if (feature) {
          return previous.filter((featureKey) => featureKey.id !== feature.id)
        }
      })
    },
  })
}
