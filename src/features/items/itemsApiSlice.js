import { apiSlice } from '../../app/api/apiSlice'
import { setItems } from './itemsSlice'

export const itemsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getItems: builder.query({
      query: (id) => ({
        url: `/item/${id}`,
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setItems(data))
        } catch (err) {
          console.log(err)
        }
      },
      providesTags: (result, error, id) => {
        if (result) {
          return [
            ...result.map(({ _id }) => ({ type: 'Item', id: _id })),
            { type: 'Item', id: 'LIST' },
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
        body: data,
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Item', id: arg._id }],
    }),
    deleteItem: builder.mutation({
      query: ({ id }) => ({
        url: `/item`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Item', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetItemQuery,
  useAddNewItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
} = itemsApiSlice
