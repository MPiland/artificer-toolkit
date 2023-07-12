import { apiSlice } from '../../app/api/apiSlice'

export const racesApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRace: builder.query({
      query: (id) => ({
        url: `race/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => [{ type: 'Race', id: 'LIST' }],
    }),
    addNewRace: builder.mutation({
      query: (initialNoteData) => ({
        url: 'race/new',
        method: 'POST',
        body: { ...initialNoteData },
      }),
      invalidatesTags: [{ type: 'Race', id: 'LIST' }],
    }),
  }),
})

export const { useGetRaceQuery, useAddNewRaceMutation } = racesApiSlice
