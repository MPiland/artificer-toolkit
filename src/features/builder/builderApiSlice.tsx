import { apiSlice } from '../../app/api/apiSlice'

export const builderApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: ['Builder'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getBuilders: builder.query({
        query: () => ({
          url: `/builder`,
          method: 'GET',
          validateStatus: (response, result) => {
            return response.status === 200 && !result.isError
          },
        }),
      }),
    }),
  })

export const { useGetBuildersQuery } = builderApiSlice

export const selectBuildersResult =
  builderApiSlice.endpoints.getBuilders.select(undefined)
