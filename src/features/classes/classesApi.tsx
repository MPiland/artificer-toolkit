import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import baseQueryWithReauth from '../../app/api/api'

const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
}

export const useGetClassesQuery = ({ limit, filters, id }: { limit?: number; filters?: any; id?: string } = {}) => {
  return useInfiniteQuery({
    queryKey: [...classesKeys.all, limit],
    queryFn: async ({ pageParam }) => {
      // 1. Construct the base URL
      let url = '/classes'

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
        classes: data,
        totalPages,
        currentPage,
      }: { classes: any; totalPages: number; currentPage: number } = await result.json() // Assuming your API returns total pages

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
        const dataArray = data.pages.flatMap((page) => page.data)
        if (id) {
          return dataArray.find((item) => item._id === id)
        }
        return dataArray
      }
      return data
    },
  })
}

export const useAddNewClassMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (uClass: any) => {
      const result = await baseQueryWithReauth('/classes', {
        method: 'POST',
        body: JSON.stringify(uClass),
      })

      const data = await result.json()

      return data
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData(classesKeys.all, (previous: any) => {
        if (!previous) return [...data]
        return [...previous, data]
      })
    },
  })
}

export const useUpdateClassMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (uClass: any) => {
      const result = await baseQueryWithReauth('/classes', {
        method: 'POST',
        body: JSON.stringify(uClass),
      })

      const data = await result.json()

      return data
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData(classesKeys.all, (previous: any[]) =>
        previous.map((uClass) => (uClass._id === data._id ? data : uClass))
      )
    },
  })
}

export const useDeleteClassMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await baseQueryWithReauth('/classes', {
        method: 'DELETE',
        body: JSON.stringify(id),
      })

      const data = await result.json()

      return data
    },
    onSuccess: (data: any) => {
      queryClient.setQueryData(classesKeys.all, (previous: any[]) => {
        return previous.filter((uClass) => uClass._id !== data._id)
      })
    },
  })
}
