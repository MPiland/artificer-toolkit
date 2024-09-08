import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import baseQueryWithReauth from '../../app/api/api'

const backgroundsKeys = {
  all: ['backgrounds'] as const,
  lists: () => [...backgroundsKeys.all, 'list'] as const,
}

export const useGetBackgroundsQuery = ({ limit, filters }: { limit?: number; filters?: any } = {}) => {
  return useInfiniteQuery({
    queryKey: [...backgroundsKeys.all, limit],
    queryFn: async ({ pageParam }) => {
      // 1. Construct the base URL
      let url = '/backgrounds'

      // 2. Create URLSearchParams object
      const searchParams = new URLSearchParams()

      // 3. Append limit parameters
      if (limit) {
        searchParams.append('page', pageParam.toString())
        searchParams.append('limit', limit.toString())
      }

      // 4. Append filter parameters
      if (filters) {
        for (const key in filters) {
          if (filters[key]) {
            searchParams.append(key, filters[key])
          }
        }
      }

      // 5. Append search parameters to the URL
      if (Array.from(searchParams).length > 0) {
        url += `?${searchParams.toString()}`
      }

      const result = await baseQueryWithReauth(url, {
        method: 'GET',
      })

      const {
        backgrounds: data,
        totalPages,
        currentPage,
      }: { backgrounds: any; totalPages: number; currentPage: number } = await result.json() // Assuming your API returns total pages

      return { data, totalPages, currentPage }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      return lastPage.currentPage < lastPage.totalPages ? lastPage.currentPage + 1 : undefined
    },
    getPreviousPageParam: (firstPage) => {
      return firstPage.currentPage > 1 ? firstPage.currentPage - 1 : undefined
    },
    maxPages: 2,
    select: (data) => {
      if (!limit) {
        return data.pages.flatMap((page) => page.data)
      }
      return data
    },
  })
}

export const useAddNewBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (background: any) => {
      const result = await baseQueryWithReauth('/backgrounds', {
        method: 'POST',
        body: JSON.stringify(background),
      })

      const data = await result.json()

      return data
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: any) => {
        if (!previous) return [...data]
        return [...previous, data]
      })
    },
  })
}

export const useUpdateBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (background: any) => {
      const result = await baseQueryWithReauth('/backgrounds', {
        method: 'POST',
        body: JSON.stringify(background),
      })

      const data = await result.json()

      return data
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: any[]) =>
        previous.map((background) => (background._id === data._id ? data : background))
      )
    },
  })
}

export const useDeleteBackgroundMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await baseQueryWithReauth('/backgrounds', {
        method: 'DELETE',
        body: JSON.stringify(id),
      })

      const data = await result.json()

      return data
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData(backgroundsKeys.all, (previous: any[]) => {
        return previous.filter((background) => background._id !== data._id)
      })
    },
  })
}
