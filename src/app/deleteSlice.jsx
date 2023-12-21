import { createSlice } from '@reduxjs/toolkit'

const deleteSlice = createSlice({
  name: 'delete',
  initialState: { status: false },
  reducers: {
    confirmDelete: (state, { payload }) => {
      state.status = payload.status
      state.data = payload.data
    },
    clearConfirm: (state, action) => {
      state.status = false
    },
  },
})

export const { confirmDelete, clearConfirm } = deleteSlice.actions

export default deleteSlice.reducer
