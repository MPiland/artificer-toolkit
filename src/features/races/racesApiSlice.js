import { apiSlice } from '../../app/api/apiSlice'
import { setRaces } from './racesSlice'

export const racesApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRaces: builder.query({
      query: (id) => ({
        url: `/race/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setRaces(data))
        } catch (err) {
          console.log(err)
        }
      },
      providesTags: (result, error, id) => {
        if (result?._ids) {
          return [
            { type: 'Race', id: 'LIST' },
            ...result._ids.map((id) => ({ type: 'Race', id })),
          ]
        } else return [{ type: 'Race', id: 'LIST' }]
      },
    }),
    addNewRace: builder.mutation({
      query: (initialNoteData) => ({
        url: '/race',
        method: 'POST',
        body: { ...initialNoteData },
      }),
      invalidatesTags: [{ type: 'Race', id: 'LIST' }],
    }),
    updateRace: builder.mutation({
      query: (initialSpellData) => ({
        url: `/race`,
        method: 'PATCH',
        body: { ...initialSpellData },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Race', id: arg._id }],
    }),
    deleteRace: builder.mutation({
      query: ({ id }) => ({
        url: `/race`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Race', id: arg._id }],
    }),
  }),
})

export const {
  useGetRaceQuery,
  useAddNewRaceMutation,
  useUpdateRaceMutation,
  useDeleteRaceMutation,
} = racesApiSlice
