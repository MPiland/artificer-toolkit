import { createEntityAdapter } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const racesAdapter = createEntityAdapter()

export const initialState = racesAdapter.getInitialState()

export const raceApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRaces: builder.query({
      query: () => ({
        url: '/race',
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(_, { queryFulfilled }) {
        try {
          await queryFulfilled
        } catch (err) {
          console.log(err)
        }
      },
      transformResponse: (responseData: any[]) => {
        const loadedraces = responseData.map((race) => {
          race.id = race._id
          return race
        })
        return racesAdapter.setAll(initialState, loadedraces)
      },
      providesTags: (result) => {
        if (result?.ids) {
          return [{ type: 'Race' as const, id: 'LIST' }, ...result.ids.map((id) => ({ type: 'Race' as const, id }))]
        } else return [{ type: 'Race' as const, id: 'LIST' }]
      },
    }),
    addNewRace: builder.mutation({
      query: (data) => ({
        url: '/race',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: () => [{ type: 'Race', id: 'LIST' }],
    }),
    updateRace: builder.mutation({
      query: (data) => ({
        url: `/race`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_, __, arg) => [
        { type: 'Race', id: arg._id },
        { type: 'Race', id: 'LIST' },
      ],
    }),
    deleteRace: builder.mutation({
      query: ({ id }) => ({
        url: `/race`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (_, __, arg) => [
        { type: 'Race', id: arg.id },
        { type: 'Race', id: 'LIST' },
      ],
    }),
  }),
})

export const { useGetRacesQuery, useAddNewRaceMutation, useUpdateRaceMutation, useDeleteRaceMutation } = raceApiSlice

export const {
  selectAll: selectAllRaces,
  selectById: selectRaceById,
  selectIds: selectRaceIds,
} = racesAdapter.getSelectors()
