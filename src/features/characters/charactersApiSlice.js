import { apiSlice } from '../../app/api/apiSlice'

export const charactersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCharacter: builder.query({
      query: (id) => ({
        url: `/character/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      providesTags: (result, error, id) => [{ type: 'Characters', id: 'LIST' }],
    }),
  }),
})

export const { useGetCharacterQuery } = charactersApiSlice
