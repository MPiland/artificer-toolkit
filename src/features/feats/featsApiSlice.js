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
      providesTags: (result, error, id) => {
        if (result?._ids) {
          return [
            { type: 'Feat', id: 'LIST' },
            ...result._ids.map((id) => ({ type: 'Feat', id })),
          ]
        } else return [{ type: 'Feat', id: 'LIST' }]
      },
    }),
    addNewFeat: builder.mutation({
      query: (initialFeatData) => ({
        url: '/feat',
        method: 'POST',
        body: { ...initialFeatData },
      }),
      invalidatesTags: [{ type: 'Feat', id: 'LIST' }],
    }),
    updateFeat: builder.mutation({
      query: (initialSpellData) => ({
        url: `/feat`,
        method: 'PATCH',
        body: { ...initialSpellData },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Feat', id: arg._id }],
    }),
  }),
})

export const { useGetFeatQuery, useAddNewFeatMutation, useUpdateFeatMutation } =
  featsApiSlice
