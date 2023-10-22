import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const spellsAdapter = createEntityAdapter({})

export const initialState = spellsAdapter.getInitialState()

export const spellsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSpells: builder.query({
      query: () => ({
        url: '/spell',
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
        const loadedspells = responseData.map((spell) => {
          spell.id = spell._id
          return spell
        })
        return spellsAdapter.setAll(initialState, loadedspells)
      },
      providesTags: (result, error, id) => {
        if (result?.ids) {
          return [
            { type: 'Spell', id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Spell', id })),
          ]
        } else return [{ type: 'Spell', id: 'LIST' }]
      },
    }),
    addNewSpell: builder.mutation({
      query: (data) => ({
        url: '/spell',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Spell', id: 'LIST' }],
    }),
    updateSpell: builder.mutation({
      query: (data) => ({
        url: `/spell`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Spell', id: arg._id }],
    }),
    deleteSpell: builder.mutation({
      query: ({ id }) => ({
        url: `/spell`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Spell', id: arg.id }],
    }),
  }),
})

export const {
  useGetSpellsQuery,
  useAddNewSpellMutation,
  useUpdateSpellMutation,
  useDeleteSpellMutation,
} = spellsApiSlice

export const selectSpellsResult = spellsApiSlice.endpoints.getSpells.select()

export const {
  selectAll: selectAllSpells,
  selectById: selectSpellById,
  selectIds: selectSpellIds,
} = spellsAdapter.getSelectors()
