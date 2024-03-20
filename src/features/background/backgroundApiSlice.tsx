import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const backgroundsAdapter = createEntityAdapter()

export const initialState = backgroundsAdapter.getInitialState()

export const backgroundsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBackgrounds: builder.query({
      query: () => ({
        url: '/background',
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled
        } catch (err) {
          console.log(err)
        }
      },
      transformResponse: (responseData: any[]) => {
        const loadedbackgrounds = responseData.map((background) => {
          background.id = background._id
          return background
        })
        return backgroundsAdapter.setAll(initialState, loadedbackgrounds)
      },
      providesTags: (result) => {
        if (result?.ids) {
          return [
            { type: 'Background' as const, id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Background' as const, id })),
          ]
        } else return [{ type: 'Background' as const, id: 'LIST' }]
      },
    }),
    addNewBackground: builder.mutation({
      query: (data) => ({
        url: '/background',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: () => [{ type: 'Background', id: 'LIST' }],
    }),
    updateBackground: builder.mutation({
      query: (data) => ({
        url: `/background`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_, __, arg) => [{ type: 'Background', id: arg._id }],
    }),
    deleteBackground: builder.mutation({
      query: ({ id }) => ({
        url: `/background`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (_, __, arg) => [{ type: 'Background', id: arg.id }],
    }),
  }),
})

export const {
  useGetBackgroundsQuery,
  useAddNewBackgroundMutation,
  useUpdateBackgroundMutation,
  useDeleteBackgroundMutation,
} = backgroundsApiSlice

export const {
  selectAll: selectAllBackgrounds,
  selectById: selectBackgroundById,
  selectIds: selectBackgroundIds,
} = backgroundsAdapter.getSelectors()
