import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const racesAdapter = createEntityAdapter({})

export const initialState = racesAdapter.getInitialState()

export const racesApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRaces: builder.query({
      query: () => ({
        url: '/race',
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
        const loadedraces = responseData.map((race) => {
          race.id = race._id
          return race
        })
        return racesAdapter.setAll(initialState, loadedraces)
      },
      providesTags: (result, error, id) => {
        if (result?.ids) {
          return [
            { type: 'Race', id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Race', id })),
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
      invalidatesTags: (result, error, arg) => [{ type: 'Race', id: arg.id }],
    }),
  }),
})

export const {
  useGetRacesQuery,
  useAddNewRaceMutation,
  useUpdateRaceMutation,
  useDeleteRaceMutation,
} = racesApiSlice

export const selectRacesResult = racesApiSlice.endpoints.getRaces.select()

export const {
  selectAll: selectAllRaces,
  selectById: selectRaceById,
  selectIds: selectRaceIds,
} = racesAdapter.getSelectors()