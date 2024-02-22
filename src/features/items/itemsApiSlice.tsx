import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const itemsAdapter = createEntityAdapter()

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
      transformResponse: (responseData: any[]) => {
        const loadedItems = responseData.map((item) => {
          item.id = item._id
          return item
        })
        return itemsAdapter.setAll(initialState, loadedItems)
      },
      providesTags: (result) => {
        if (result?.ids) {
          return [
            'Item',
            ...result.ids.map((id) => ({ type: 'Item' as const, id })),
          ]
        } else return ['Item']
      },
    }),
    addNewItem: builder.mutation({
      query: (data) => ({
        url: '/item',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: () => ['Item'],
    }),
    updateItem: builder.mutation({
      query: (data) => ({
        url: `/item`,
        method: 'PATCH',
        body: { ...data },
      }),
      invalidatesTags: (_, __, arg) => [{ type: 'Item', id: arg._id }],
    }),
    deleteItem: builder.mutation({
      query: ({ id }) => ({
        url: `/item`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (_, __, arg) => ['Item', { type: 'Item', id: arg.id }],
    }),
  }),
})

export const {
  useGetItemsQuery,
  useAddNewItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
} = itemsApiSlice

export const {
  selectAll: selectAllItems,
  selectById: selectItemById,
  selectIds: selectItemIds,
} = itemsAdapter.getSelectors()
