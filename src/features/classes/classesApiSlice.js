import { createEntityAdapter, createSelector } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const classesAdapter = createEntityAdapter({})

export const initialState = classesAdapter.getInitialState()

export const classesApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClasses: builder.query({
      query: () => ({
        url: '/class',
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
        const loadedclasses = responseData.map((userClass) => {
          userClass.id = userClass._id
          return userClass
        })
        return classesAdapter.setAll(initialState, loadedclasses)
      },
      providesTags: (result, error, id) => {
        if (result?.ids) {
          return [
            { type: 'Class', id: 'LIST' },
            ...result.ids.map((id) => ({ type: 'Class', id })),
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
      invalidatesTags: (result, error, arg) => [{ type: 'Class', id: arg.id }],
    }),
  }),
})

export const {
  useGetClassesQuery,
  useAddNewClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} = classesApiSlice

export const selectClassesResult =
  classesApiSlice.endpoints.getClasses.select('classesList')

export const {
  selectAll: selectAllClasses,
  selectById: selectClassById,
  selectIds: selectClassIds,
} = classesAdapter.getSelectors()

export const selectSubclassById = createSelector(
  [selectClassesResult, (state, id) => id],
  (res, id) =>
    res?.data &&
    selectAllClasses(res.data)
      ?.filter((classItem) => classItem.category.name === 'subclass')
      .filter((subclassItem) => subclassItem.parentClass.id === id)
)
