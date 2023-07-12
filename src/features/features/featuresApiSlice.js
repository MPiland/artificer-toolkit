import { apiSlice } from '../../app/api/apiSlice'

export const featuresApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFeature: builder.query({
      query: (id) => ({
        url: `feature/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => [{ type: 'Feature', id: 'LIST' }],
    }),
    addNewFeature: builder.mutation({
      query: (initialNoteData) => ({
        url: 'feature/new',
        method: 'POST',
        body: { ...initialNoteData },
      }),
      invalidatesTags: [{ type: 'Feature', id: 'LIST' }],
    }),
  }),
})

export const { useGetFeatureQuery, useAddNewFeatureMutation } = featuresApiSlice
