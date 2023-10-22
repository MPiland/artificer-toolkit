import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const itemsAdapter = createEntityAdapter({})

export const initialState = itemsAdapter.getInitialState()

export const itemsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getItems: builder.query({
      query: () => ({
        url: '/item',
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
        const loadedItems = responseData.map((item) => {
          item.id = item._id
          return item
        })
        return itemsAdapter.setAll(initialState, loadedItems)
      },
      providesTags: (result, error, id) => {
        if (result?.ids) {
          return [
            { type: 'Item', id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Item', id })),
          ]
        } else return [{ type: 'Item', id: 'LIST' }]
      },
    }),
    addNewItem: builder.mutation({
      query: (data) => ({
        url: '/item',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Item', id: 'LIST' }],
    }),
    updateItem: builder.mutation({
      query: (data) => ({
        url: `/item`,
        method: 'PATCH',
        body: { ...data },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Item', id: arg._id }],
    }),
    deleteItem: builder.mutation({
      query: ({ id }) => ({
        url: `/item`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Item', id: arg.id }],
    }),
  }),
})

export const {
  useGetItemsQuery,
  useAddNewItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
} = itemsApiSlice

export const selectItemsResult = itemsApiSlice.endpoints.getItems.select()

export const {
  selectAll: selectAllItems,
  selectById: selectItemById,
  selectIds: selectItemIds,
} = itemsAdapter.getSelectors()
