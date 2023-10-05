import { apiSlice } from '../../app/api/apiSlice'
import { setClasses } from './classesSlice'

export const classesApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClasses: builder.query({
      query: (id) => ({
        url: `/class/${id}`,
        validateStatus: (response, result) => {
          return response.status === 200 && !result.isError
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setClasses(data))
        } catch (err) {
          console.log(err)
        }
      },
      providesTags: (result, error, id) => {
        if (result) {
          return [
            ...result.map(({ _id }) => ({ type: 'Class', id: _id })),
            { type: 'Class', id: 'LIST' },
          ]
        } else return [{ type: 'Class', id: 'LIST' }]
      },
    }),
    addNewClass: builder.mutation({
      query: (data) => ({
        url: '/class',
        method: 'POST',
        body: { ...data },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Class', id: 'LIST' }],
    }),
    updateClass: builder.mutation({
      query: (data) => ({
        url: `/class`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Class', id: arg._id }],
    }),
    deleteClass: builder.mutation({
      query: ({ id }) => ({
        url: `/class`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Class', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetClassQuery,
  useAddNewClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} = classesApiSlice
