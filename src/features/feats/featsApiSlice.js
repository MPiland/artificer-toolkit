import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const featsAdapter = createEntityAdapter({})

export const initialState = featsAdapter.getInitialState()

export const featsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFeats: builder.query({
      query: () => ({
        url: '/feat',
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          await queryFulfilled
        } catch (err) {
          console.log(err)
        }
      },
      transformResponse: (responseData) => {
        const loadedfeats = responseData.map((feat) => {
          feat.id = feat._id
          return feat
        })
        return featsAdapter.setAll(initialState, loadedfeats)
      },
      providesTags: (result, error, id) => {
        if (result?.ids) {
          return [
            { type: 'Feat', id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Feat', id })),
          ]
        } else return [{ type: 'Feat', id: 'LIST' }]
      },
    }),
    addNewFeat: builder.mutation({
      query: (data) => ({
        url: '/feat',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Feat', id: 'LIST' }],
    }),
    updateFeat: builder.mutation({
      query: (data) => ({
        url: `/feat`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Feat', id: arg._id }],
    }),
    deleteFeat: builder.mutation({
      query: ({ id }) => ({
        url: `/feat`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Feat', id: arg.id }],
    }),
  }),
})

export const {
  useGetFeatsQuery,
  useAddNewFeatMutation,
  useUpdateFeatMutation,
  useDeleteFeatMutation,
} = featsApiSlice

export const selectFeatsResult = featsApiSlice.endpoints.getFeats.select()

export const {
  selectAll: selectAllFeats,
  selectById: selectFeatById,
  selectIds: selectFeatIds,
} = featsAdapter.getSelectors()
