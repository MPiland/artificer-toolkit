import { apiSlice } from '../../app/api/apiSlice'

export const featsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFeat: builder.query({
      query: (id) => ({
        url: `/feat/${id}`,
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => [{ type: 'Feat', id: 'LIST' }],
    }),
    addNewFeat: builder.mutation({
      query: (initialFeatData) => ({
        url: '/feat',
        method: 'POST',
        body: { ...initialFeatData },
      }),
      invalidatesTags: [{ type: 'Feat', id: 'LIST' }],
    }),
  }),
})

export const { useGetFeatQuery, useAddNewFeatMutation } = featsApiSlice
