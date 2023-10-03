import { apiSlice } from '../../app/api/apiSlice'
import { setBuilders } from './buildersSlice'

export const buildersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBuilders: builder.query({
      query: (id) => ({
        url: `/builder/${id}`,
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setBuilders(data))
        } catch (err) {
          console.log(err)
        }
      },
      providesTags: (result, error, id) => [{ type: 'Builder', id: 'LIST' }],
    }),
  }),
})

export const { useGetBuilderQuery, usePrefetch } = buildersApiSlice
