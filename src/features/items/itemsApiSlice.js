import { apiSlice } from '../../app/api/apiSlice'

export const itemsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getItem: builder.query({
      query: (id) => ({
        url: `/item/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => [{ type: 'Item', id: 'LIST' }],
    }),
    addNewItem: builder.mutation({
      query: (initialNoteData) => ({
        url: '/item/new',
        method: 'POST',
        body: { ...initialNoteData },
      }),
      invalidatesTags: [{ type: 'Item', id: 'LIST' }],
    }),
  }),
})

export const { useGetItemQuery, useAddNewItemMutation } =
  itemsApiSlice
