import { apiSlice } from '../../app/api/apiSlice'

export const itemApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getItem: builder.query({
      query: (id) => ({
        url: `/item/${id}`,
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => {
        if (result?._ids) {
          return [
            { type: 'Item', id: 'LIST' },
            ...result._ids.map((id) => ({ type: 'Item', id })),
          ]
        } else return [{ type: 'Item', id: 'LIST' }]
      },
    }),
    addNewItem: builder.mutation({
      query: (initialItemData) => ({
        url: '/item',
        method: 'POST',
        body: { ...initialItemData },
      }),
      invalidatesTags: [{ type: 'Item', id: 'LIST' }],
    }),
    updateItem: builder.mutation({
      query: (initialSpellData) => ({
        url: `/item`,
        method: 'PATCH',
        body: { ...initialSpellData },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Item', id: arg._id }],
    }),
  }),
})

export const { useGetItemQuery, useAddNewItemMutation, useUpdateItemMutation } =
  itemApiSlice
