import { createEntityAdapter, createSelector } from '@reduxjs/toolkit'
import { apiSlice } from '../../app/api/apiSlice'

export const classesAdapter = createEntityAdapter()

export const initialState = classesAdapter.getInitialState()

export const classesApiSlice = apiSlice
  .enhanceEndpoints({ addTagTypes: ['Class'] })
  .injectEndpoints({
    endpoints: (builder) => ({
      getClasses: builder.query({
        query: () => ({
          url: '/class',
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
          const loadedclasses = responseData.map((userClass) => {
            userClass.id = userClass._id
            return userClass
          })
          return classesAdapter.setAll(initialState, loadedclasses)
        },
        providesTags: (result) => {
          if (result?.ids) {
            return [
              { type: 'Class' as const, id: 'LIST' },
              ...result.ids.map((id) => ({ type: 'Class' as const, id })),
            ]
          } else return [{ type: 'Class' as const, id: 'LIST' }]
        },
      }),
      addNewClass: builder.mutation({
        query: (data) => ({
          url: '/class',
          method: 'POST',
          body: { ...data },
        }),
        invalidatesTags: () => [{ type: 'Class', id: 'LIST' }],
      }),
      updateClass: builder.mutation({
        query: (data) => ({
          url: `/class`,
          method: 'PATCH',
          body: data,
        }),
        invalidatesTags: (_, __, arg) => [{ type: 'Class', id: arg._id }],
      }),
      deleteClass: builder.mutation({
        query: ({ id }) => ({
          url: `/class`,
          method: 'DELETE',
          body: { id },
        }),
        invalidatesTags: (_, __, arg) => [{ type: 'Class', id: arg.id }],
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
  classesApiSlice.endpoints.getClasses.select(undefined)

export const {
  selectAll: selectAllClasses,
  selectById: selectClassById,
  selectIds: selectClassIds,
} = classesAdapter.getSelectors()

export const selectAllSubclasses = createSelector(
  [selectClassesResult, (state) => state],
  (state) =>
    state?.data &&
    selectAllClasses(state?.data)?.filter(
      (classItem: any) => classItem.category.name === 'subclass'
    )
)

export const selectSubclassById = createSelector(
  [selectClassesResult, (_, id) => id],
  (res, id) =>
    res?.data &&
    selectAllClasses(res.data)
      ?.filter((classItem: any) => classItem.category.name === 'subclass')
      .filter((subclassItem: any) => subclassItem.parentClass.id === id)
)
