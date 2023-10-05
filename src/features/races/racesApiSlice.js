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
        if (result) {
          return [
            ...result.map(({ _id }) => ({ type: 'Race', id: _id })),
            { type: 'Race', id: 'LIST' },
          ]
        } else return [{ type: 'Race', id: 'LIST' }]
      },
    }),
    addNewRace: builder.mutation({
      query: (data) => ({
        url: '/race',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Race', id: 'LIST' }],
    }),
    updateRace: builder.mutation({
      query: (data) => ({
        url: `/race`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Race', id: arg._id }],
    }),
    deleteRace: builder.mutation({
      query: ({ id }) => ({
        url: `/race`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Race', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetRaceQuery,
  useAddNewRaceMutation,
  useUpdateRaceMutation,
  useDeleteRaceMutation,
} = racesApiSlice
