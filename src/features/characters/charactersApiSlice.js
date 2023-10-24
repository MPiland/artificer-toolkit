import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const charactersAdapter = createEntityAdapter({})

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
      async onQueryStarted(arg, { queryFulfilled }) {
        try {
          await queryFulfilled
        } catch (err) {
          console.log(err)
        }
      },
      transformResponse: (responseData) => {
        const loadedcharacters = responseData.map((characters) => {
          characters.id = characters._id
          return characters
        })
        return charactersAdapter.setAll(initialState, loadedcharacters)
      },
      providesTags: (result, error, id) => {
        if (result?.ids) {
          return [
            { type: 'Character', id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Character', id })),
          ]
        } else return [{ type: 'Character', id: 'LIST' }]
      },
    }),
    addNewCharacter: builder.mutation({
      query: (data) => ({
        url: '/character',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Character', id: 'LIST' },
      ],
    }),
    updateCharacter: builder.mutation({
      query: (data) => ({
        url: `/character`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, arg) => [
        { type: 'Character', id: arg._id },
      ],
    }),
    deleteCharacter: builder.mutation({
      query: ({ id }) => ({
        url: `/character`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [
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
