import { useQuery } from '@tanstack/react-query'
import baseQueryWithReauth from '../../app/api/api'

export const useGetBuildersQuery = () => {
  return useQuery({
    queryKey: ['builders'],
    queryFn: async () => {
      const result = await baseQueryWithReauth('/builders', {
        method: 'GET',
      })

      const data = await result.json()

      return data
    },
  })
}
