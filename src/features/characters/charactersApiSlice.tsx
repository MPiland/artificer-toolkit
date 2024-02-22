import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const charactersAdapter = createEntityAdapter()

export const initialState = charactersAdapter.getInitialState()

export const charactersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCharacters: builder.query({
      query: () => ({
        url: '/character',
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      transformResponse: (responseData: any[]) => {
        const loadedcharacters = responseData.map((characters) => {
          characters.id = characters._id
          return characters
        })
        return charactersAdapter.setAll(initialState, loadedcharacters)
      },
      providesTags: (result) => {
        if (result?.ids) {
          return [
            { type: 'Character' as const, id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Character' as const, id })),
          ]
        } else return [{ type: 'Character' as const, id: 'LIST' }]
      },
    }),
    addNewCharacter: builder.mutation({
      query: (data) => ({
        url: '/character',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: () => [{ type: 'Character', id: 'LIST' }],
    }),
    updateCharacter: builder.mutation({
      query: (data) => ({
        url: `/character`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_, __, arg) => [
        { type: 'Character', id: 'LIST' },
        { type: 'Character', id: arg._id },
      ],
    }),
    deleteCharacter: builder.mutation({
      query: ({ id }) => ({
        url: `/character`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (_, __, arg) => [
        { type: 'Character', id: 'LIST' },
        { type: 'Character', id: arg.id },
      ],
    }),
  }),
})

export const {
  useGetCharactersQuery,
  useAddNewCharacterMutation,
  useUpdateCharacterMutation,
  useDeleteCharacterMutation,
} = charactersApiSlice

export const selectCharactersResult =
  charactersApiSlice.endpoints.getCharacters.select('charactersList')

export const {
  selectAll: selectAllCharacters,
  selectById: selectCharacterById,
  selectIds: selectCharacterIds,
} = charactersAdapter.getSelectors()
