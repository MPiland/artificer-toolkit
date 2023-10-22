import { apiSlice } from '../../app/api/apiSlice'

export const buildersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBuilders: builder.query({
      query: () => ({
        url: `/builder`,
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: ['Builder'],
    }),
  }),
})

export const { useGetBuildersQuery } = buildersApiSlice
