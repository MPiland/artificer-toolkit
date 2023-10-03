import { apiSlice } from '../../app/api/apiSlice'
import { setSpells } from './spellsSlice'

export const spellsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSpells: builder.query({
      query: (id) => ({
        url: `/spell/${id}`,
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setSpells(data))
        } catch (err) {
          console.log(err)
        }
      },
      providesTags: (result, error, id) => {
        if (result?._ids) {
          return [
            { type: 'Spell', id: 'LIST' },
            ...result._ids.map((id) => ({ type: 'Spell', id })),
          ]
        } else return [{ type: 'Spell', id: 'LIST' }]
      },
    }),
    addNewSpell: builder.mutation({
      query: (initialSpellData) => ({
        url: '/spell',
        method: 'POST',
        body: { ...initialSpellData },
      }),
      invalidatesTags: [{ type: 'Spell', id: 'LIST' }],
    }),
    updateSpell: builder.mutation({
      query: (initialSpellData) => ({
        url: `/spell`,
        method: 'PATCH',
        body: { ...initialSpellData },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Spell', id: arg._id }],
    }),
    deleteSpell: builder.mutation({
      query: ({ id }) => ({
        url: `/spell`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Spell', id: arg._id }],
    }),
  }),
})

export const {
  useGetSpellQuery,
  useAddNewSpellMutation,
  useUpdateSpellMutation,
  useDeleteSpellMutation,
} = spellsApiSlice
