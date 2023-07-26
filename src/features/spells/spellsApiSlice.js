import { apiSlice } from '../../app/api/apiSlice'

export const spellsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSpell: builder.query({
      query: (id) => ({
        url: `/spell/${id}`,
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => [{ type: 'Spell', id: 'LIST' }],
    }),
    addNewSpell: builder.mutation({
      query: (initialSpellData) => ({
        url: '/spell',
        method: 'POST',
        body: { ...initialSpellData },
      }),
      invalidatesTags: [{ type: 'Spell', id: 'LIST' }],
    }),
  }),
})

export const { useGetSpellQuery, useAddNewSpellMutation } = spellsApiSlice
