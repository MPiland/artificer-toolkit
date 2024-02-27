import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const spellsAdapter = createEntityAdapter()

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
      transformResponse: (responseData: any[]) => {
        const loadedspells = responseData.map((spell) => {
          spell.id = spell._id
          return spell
        })
        return spellsAdapter.setAll(initialState, loadedspells)
      },
      providesTags: (result) => {
        if (result?.ids) {
          return [
            { type: 'Spell' as const, id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Spell' as const, id })),
          ]
        } else return [{ type: 'Spell' as const, id: 'LIST' }]
      },
    }),
    addNewSpell: builder.mutation({
      query: (data) => ({
        url: '/spell',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: () => [{ type: 'Spell', id: 'LIST' }],
    }),
    updateSpell: builder.mutation({
      query: (data) => ({
        url: `/spell`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_, __, arg) => [
        { type: 'Spell', id: arg._id },
        { type: 'Spell', id: 'LIST' },
      ],
    }),
    deleteSpell: builder.mutation<any, { id: number }>({
      query: ({ id }) => ({
        url: `/spell`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (_, __, arg) => [
        { type: 'Spell', id: arg.id },
        { type: 'Spell', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetSpellsQuery,
  useAddNewSpellMutation,
  useUpdateSpellMutation,
  useDeleteSpellMutation,
} = spellsApiSlice

export const {
  selectAll: selectAllSpells,
  selectById: selectSpellById,
  selectIds: selectSpellIds,
} = spellsAdapter.getSelectors()
