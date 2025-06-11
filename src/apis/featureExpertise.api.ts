import { getClient } from './utils'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listFeatureExpertises,
  listMasterFeatureExpertises,
  getFeatureExpertise,
  getMasterFeatureExpertise,
} from '@/queries'
import type {
  FeatureExpertiseInput,
  FeatureExpertise,
  QueryListFeatureExpertisesArgs,
  QueryListMasterFeatureExpertisesArgs,
} from 'gql/types'
import {
  createFeatureExpertise,
  createMasterFeatureExpertise,
  updateFeatureExpertise,
  updateMasterFeatureExpertise,
  deleteMasterFeatureExpertise,
  deleteFeatureExpertise,
} from '@/mutations'

const featureExpertiseKeys = {
  all: ['featureExpertise'] as const,
  lists: () => [...featureExpertiseKeys.all, 'list'] as const,
  single: (id: string) => [...featureExpertiseKeys.all, 'single', id] as const,
}

export const fetchFeatureExpertises = (systemPref: string) => {
  return queryOptions({
    queryKey: featureExpertiseKeys.lists(),
    queryFn: async () => {
      let allData: { featureExpertises: FeatureExpertise[] } = {
        featureExpertises: [],
      }
      let nextToken: string | null = null

      const { client, master } = await getClient()

      // Create a union type for the variables
      type ListVariables = QueryListFeatureExpertisesArgs | QueryListMasterFeatureExpertisesArgs

      const isMaster = (data: any): data is { listMasterFeatureExpertises: any } => {
        return 'listMasterFeatureExpertises' in data
      }

      const operation = master ? listMasterFeatureExpertises : listFeatureExpertises

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

          const result = isMaster(data) ? data.listMasterFeatureExpertises : data.listFeatureExpertises

          allData = { featureExpertises: [...allData.featureExpertises, ...result.items] }
          nextToken = result.nextToken || null
        } while (nextToken)

        return allData
      } catch (err) {
        console.log({ err })
        throw err
      }
    },
  })
}

export const fetchFeatureExpertise = (id: string) => {
  return queryOptions({
    queryKey: featureExpertiseKeys.single(id),
    queryFn: async () => {
      const { client, master } = await getClient()

      // Type guard to check which response we got
      function isMaster(data: any): data is { getMasterFeatureExpertise: any } {
        return 'getMasterFeatureExpertise' in data
      }

      const operation = master ? getMasterFeatureExpertise : getFeatureExpertise

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.getMasterFeatureExpertise
        } else {
          return data.getFeatureExpertise
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
  })
}

export const useAddNewFeatureExpertiseMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureExpertise, Error, FeatureExpertiseInput, unknown>({
    mutationFn: async (featureExpertise: FeatureExpertiseInput) => {
      const { client, master } = await getClient()

      const operation = master ? createMasterFeatureExpertise : createFeatureExpertise

      function isMaster(data: any): data is { createMasterFeatureExpertise: any } {
        return 'createMasterFeatureExpertise' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: featureExpertise,
          },
        })

        if (isMaster(data)) {
          return data.createMasterFeatureExpertise
        } else {
          return data.createFeatureExpertise
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (featureExpertise: FeatureExpertise) => {
      queryClient.setQueryData(featureExpertiseKeys.all, (previous: FeatureExpertise[]) => {
        if (!previous) return [featureExpertise]
        return [...previous, featureExpertise]
      })
    },
  })
}

export const useUpdateFeatureExpertiseMutation = () => {
  const queryClient = useQueryClient()

  return useMutation<FeatureExpertise, Error, FeatureExpertiseInput, unknown>({
    mutationFn: async (featureExpertise: FeatureExpertiseInput) => {
      const { client, master } = await getClient()

      const operation = master ? updateMasterFeatureExpertise : updateFeatureExpertise

      // Type guard to check which response we got
      function isMaster(data: any): data is { updateMasterFeatureExpertise: any } {
        return 'updateMasterFeatureExpertise' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            input: featureExpertise,
          },
        })

        if (isMaster(data)) {
          return data.updateMasterFeatureExpertise
        } else {
          return data.updateFeatureExpertise
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (featureExpertise: FeatureExpertise) => {
      queryClient.setQueryData(featureExpertiseKeys.all, (previous: FeatureExpertise[]) =>
        previous?.map((featureExpertiseKey) =>
          featureExpertiseKey.id === featureExpertise.id ? featureExpertise : featureExpertiseKey
        )
      )
    },
  })
}

export const useDeleteFeatureExpertiseMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { client, master } = await getClient()

      const operation = master ? deleteMasterFeatureExpertise : deleteFeatureExpertise

      // Type guard to check which response we got
      function isMaster(data: any): data is { deleteMasterFeatureExpertise: any } {
        return 'deleteMasterFeatureExpertise' in data
      }

      try {
        const { data } = await client.graphql({
          query: operation,
          variables: {
            id,
          },
        })

        if (isMaster(data)) {
          return data.deleteMasterFeatureExpertise
        } else {
          return data.deleteFeatureExpertise
        }
      } catch (err) {
        console.error({ err })
        throw err
      }
    },
    onSuccess: (id: string) => {
      queryClient.setQueryData(featureExpertiseKeys.all, (previous: FeatureExpertise[]) => {
        const featureExpertise = previous.find((featureExpertiseKey) => featureExpertiseKey.id === id)
        if (featureExpertise) {
          return previous.filter((featureExpertiseKey) => featureExpertiseKey.id !== featureExpertise.id)
        }
      })
    },
  })
}
