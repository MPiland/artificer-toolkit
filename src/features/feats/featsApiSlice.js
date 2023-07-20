import { apiSlice } from '../../app/api/apiSlice'

export const featsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFeat: builder.query({
      query: (id) => ({
        url: `/feat/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => [{ type: 'Feat', id: 'LIST' }],
    }),
    addNewFeat: builder.mutation({
      query: (initialNoteData) => ({
        url: '/feat',
        method: 'POST',
        body: { ...initialNoteData },
      }),
      invalidatesTags: [{ type: 'Feat', id: 'LIST' }],
    }),
  }),
})

export const { useGetFeatQuery, useAddNewFeatMutation } = featsApiSlice
