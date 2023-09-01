import { apiSlice } from '../../app/api/apiSlice'

export const characterApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCharacter: builder.query({
      query: (id) => ({
        url: `/character/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => {
        if (result?._ids) {
          return [
            { type: 'Character', id: 'LIST' },
            ...result._ids.map((id) => ({ type: 'Character', id })),
          ]
        } else return [{ type: 'Character', id: 'LIST' }]
      },
    }),
    addNewCharacter: builder.mutation({
      query: (initialNoteData) => ({
        url: '/class',
        method: 'POST',
        body: { ...initialNoteData },
      }),
      invalidatesTags: [{ type: 'Class', id: 'LIST' }],
    }),
    updateCharacter: builder.mutation({
      query: (initialSpellData) => ({
        url: `/class`,
        method: 'PATCH',
        body: { ...initialSpellData },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Class', id: arg._id }],
    }),
    deleteCharacter: builder.mutation({
      query: ({ id }) => ({
        url: `/class`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Class', id: arg._id }],
    }),
  }),
})

export const {
  useGetCharacterQuery,
  useAddNewCharacterMutation,
  useUpdateCharacterMutation,
  useDeleteCharacterMutation,
} = characterApiSlice
