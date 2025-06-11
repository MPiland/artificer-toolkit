import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listAncestryFeatures,
  listMasterAncestryFeatures,
  getAncestryFeature,
  getMasterAncestryFeature,
} from '@/queries'
import type {
  AncestryFeatureInput,
  AncestryFeature,
  QueryListAncestryFeaturesArgs,
  QueryListMasterAncestryFeaturesArgs,
} from 'gql/types'
import {
  createAncestryFeature,
  createMasterAncestryFeature,
  updateAncestryFeature,
  updateMasterAncestryFeature,
  deleteMasterAncestryFeature,
  deleteAncestryFeature,
} from '@/mutations'

const ancestryFeaturesKeys = {
  all: ['ancestryFeatures'] as const,
  lists: () => [...ancestryFeaturesKeys.all, 'list'] as const,
  single: (id: string) => [...ancestryFeaturesKeys.all, 'single', id] as const,
}

export const fetchAncestryFeatures = (systemPref: string) => {
  return queryOptions({
    queryKey: ancestryFeaturesKeys.lists(),
    queryFn: async () => {
      let allData: { ancestryFeatures: AncestryFeature[] } = {
        ancestryFeatures: [],
      }
      let nextToken: string | null = null

      const { client, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListAncestryFeaturesArgs | QueryListMasterAncestryFeaturesArgs

      const isMaster = (data: any): data is { listMasterAncestryFeatures: any } => {
        return 'listMasterAncestryFeatures' in data
      }

      const operation = master ? listMasterAncestryFeatures : listAncestryFeatures

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
          const { data } = await client.graphql({
            query: operation,
            variables: variables,
          })

          const result = isMaster(data) ? data.listMasterAncestryFeatures : data.listAncestryFeatures

          allData = { ancestryFeatures: [...allData.ancestryFeatures, ...result.items] }
          nextToken = result.nextToken || null
        } while (nextToken)

        if (allData.ancestryFeatures.length) {
          allData.ancestryFeatures.sort((a, b) => {
            if (a && b) {
              if (a.value && !b.value) {
                return -1
              }
              if (b.value && !a.value) {
                return 1
              }
              if (b.value && a.value) {
                return a.value.localeCompare(b.value)
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

export const fetchAncestryFeature = (id: string) => {
  return queryOptions({
    queryKey: ancestryFeaturesKeys.single(id),
    queryFn: async () => {
      const { client, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterAncestryFeature: any } {
        return 'getMasterAncestryFeature' in data
      }

      const operation = master ? getMasterAncestryFeature : getAncestryFeature

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterAncestryFeature
        } else {
          return data.getAncestryFeature
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddNewAncestryFeatureMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<AncestryFeature, Error, AncestryFeatureInput, unknown>({
    mutationFn: async (ancestryFeature: AncestryFeatureInput) => {
      const { client, master } = await getClient()

      const operation = master ? createMasterAncestryFeature : createAncestryFeature

      function isMaster(data: any): data is { createMasterAncestryFeature: any } {
        return 'createMasterAncestryFeature' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: ancestryFeature,
          },
        })

        if (isMaster(data)) {
          return data.createMasterAncestryFeature
        } else {
          return data.createAncestryFeature
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (ancestryFeature: AncestryFeature) => {
      queryClient.setQueryData(ancestryFeaturesKeys.all, (previous: AncestryFeature[]) => {
        if (!previous) return [ancestryFeature]
        return [...previous, ancestryFeature]
      })
    },
  })
}

export const useUpdateAncestryFeatureMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<AncestryFeature, Error, AncestryFeatureInput, unknown>({
    mutationFn: async (ancestryFeature: AncestryFeatureInput) => {
      const { client, master } = await getClient()

      const operation = master ? updateMasterAncestryFeature : updateAncestryFeature

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterAncestryFeature: any } {
        return 'updateMasterAncestryFeature' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: ancestryFeature,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterAncestryFeature
        } else {
          return data.updateAncestryFeature
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (ancestryFeature: AncestryFeature) => {
      queryClient.setQueryData(ancestryFeaturesKeys.all, (previous: AncestryFeature[]) =>
        previous?.map((ancestryFeatureKey) =>
          ancestryFeatureKey.id === ancestryFeature.id ? ancestryFeature : ancestryFeatureKey
        )
      )
    },
  })
}

export const useDeleteAncestryFeatureMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { client, master } = await getClient()

      const operation = master ? deleteMasterAncestryFeature : deleteAncestryFeature

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterAncestryFeature: any } {
        return 'deleteMasterAncestryFeature' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterAncestryFeature
        } else {
          return data.deleteAncestryFeature
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(ancestryFeaturesKeys.all, (previous: AncestryFeature[]) => {
        const ancestryFeature = previous.find((ancestryFeatureKey) => ancestryFeatureKey.id === id)
        if (ancestryFeature) {
          return previous.filter((ancestryFeatureKey) => ancestryFeatureKey.id !== ancestryFeature.id)
        }
      })
    },
  })
}
