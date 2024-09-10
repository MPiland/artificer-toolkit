import { useQuery } from '@tanstack/react-query'
import { Schema } from '../../../amplify/data/resource'
import { generateClient } from 'aws-amplify/data'

const client = generateClient<Schema>()

export const useGetSystemsQuery = () => {
  return useQuery({
    queryKey: ['systems'],
    queryFn: async () => {
      const { data: systems } = await client.models.System.list()

      return systems
    },
  })
}
