import { apiSlice } from '../../app/api/apiSlice'
import { setFeats } from './featsSlice'

export const featsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFeats: builder.query({
      query: (id) => ({
        url: `/feat/${id}`,
        method: 'GET',
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setFeats(data))
        } catch (err) {
          console.log(err)
        }
      },
      providesTags: (result, error, id) => {
        if (result) {
          return [
            ...result.map(({ _id }) => ({ type: 'Feat', id: _id })),
            { type: 'Feat', id: 'LIST' },
          ]
        } else return [{ type: 'Feat', id: 'LIST' }]
      },
    }),
    addNewFeat: builder.mutation({
      query: (data) => ({
        url: '/feat',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Feat', id: 'LIST' }],
    }),
    updateFeat: builder.mutation({
      query: (data) => ({
        url: `/feat`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Feat', id: arg._id }],
    }),
    deleteFeat: builder.mutation({
      query: ({ id }) => ({
        url: `/feat`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Feat', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetFeatQuery,
  useAddNewFeatMutation,
  useUpdateFeatMutation,
  useDeleteFeatMutation,
} = featsApiSlice
