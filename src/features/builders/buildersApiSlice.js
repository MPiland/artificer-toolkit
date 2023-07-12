import { apiSlice } from '../../app/api/apiSlice'

export const buildersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBuilder: builder.query({
      query: (id) => ({
        url: `builder/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => [{ type: 'Builder', id: 'LIST' }],
    }),
  }),
})

export const { useGetBuilderQuery, usePrefetch } = buildersApiSlice
