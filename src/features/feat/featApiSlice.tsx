import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const featsAdapter = createEntityAdapter()

export const initialState = featsAdapter.getInitialState()

export const featApiSlice = apiSlice
  .injectEndpoints({
    endpoints: (builder) => ({
      getFeats: builder.query({
        query: () => ({
          url: '/feat',
          method: 'GET',
          validateStatus: (response, result) => {
            return response.status === 200 && !result.isError
          },
        }),
        transformResponse: (responseData: any[]) => {
          const loadedfeats = responseData.map((feat) => {
            feat.id = feat._id
            return feat
          })
          return featsAdapter.setAll(initialState, loadedfeats)
        },
        providesTags: (result) => {
          if (result?.ids) {
            return [
              { type: 'Feat' as const, id: 'LIST' },
              ...result.ids.map((id) => ({ type: 'Feat' as const, id: id })),
            ]
          } else return [{ type: 'Feat' as const, id: 'LIST' }]
        },
      }),
      addNewFeat: builder.mutation({
        query: (data) => ({
          url: '/feat',
          method: 'POST',
          body: { ...data },
        }),
        invalidatesTags: [{ type: 'Feat', id: 'LIST' }],
      }),
      updateFeat: builder.mutation({
        query: (data) => ({
          url: `/feat`,
          method: 'PATCH',
          body: data,
        }),
        invalidatesTags: (_, __, arg) => [
          { type: 'Feat', id: arg._id },
          { type: 'Feat', id: 'LIST' },
        ],
      }),
      deleteFeat: builder.mutation({
        query: ({ id }) => ({
          url: `/feat`,
          method: 'DELETE',
          body: { id },
        }),
        invalidatesTags: (_, __, arg) => {
          return [
            { type: 'Feat', id: arg.id },
            { type: 'Feat', id: 'LIST' },
          ]
        },
      }),
    }),
  })

export const {
  useGetFeatsQuery,
  useAddNewFeatMutation,
  useUpdateFeatMutation,
  useDeleteFeatMutation,
} = featApiSlice

export const {
  selectAll: selectAllFeats,
  selectById: selectFeatById,
  selectIds: selectFeatIds,
} = featsAdapter.getSelectors()
