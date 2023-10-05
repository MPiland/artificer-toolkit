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
        if (result) {
          return [
            ...result.map(({ _id }) => ({ type: 'Spell', id: _id })),
            { type: 'Spell', id: 'LIST' },
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
      invalidatesTags: (result, error, arg) => [{ type: 'Spell', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetSpellQuery,
  useAddNewSpellMutation,
  useUpdateSpellMutation,
  useDeleteSpellMutation,
} = spellsApiSlice
