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
        if (result?._ids) {
          return [
            { type: 'Class', id: 'LIST' },
            ...result._ids.map((id) => ({ type: 'Class', id })),
          ]
        } else return [{ type: 'Class', id: 'LIST' }]
      },
    }),
    addNewClass: builder.mutation({
      query: (initialNoteData) => ({
        url: '/class',
        method: 'POST',
        body: { ...initialNoteData },
      }),
      invalidatesTags: [{ type: 'Class', id: 'LIST' }],
    }),
    updateClass: builder.mutation({
      query: (initialSpellData) => ({
        url: `/class`,
        method: 'PATCH',
        body: { ...initialSpellData },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Class', id: arg._id }],
    }),
    deleteClass: builder.mutation({
      query: ({ id }) => ({
        url: `/class`,
        method: 'DELETE',
        body: { id },
      }),
      invalidatesTags: (result, error, arg) => [{ type: 'Class', id: arg._id }],
    }),
  }),
})

export const {
  useGetClassQuery,
  useAddNewClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} = classesApiSlice
