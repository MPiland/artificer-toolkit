import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface DeleteState {
  status: boolean
  data?: any
}

export const deleteSlice = createSlice({
  name: 'delete',
  initialState: { status: false } as DeleteState,
  reducers: {
    confirmDelete: (state, action: PayloadAction<DeleteState>) => {
      state.status = action.payload.status
      state.data = action.payload.data
    },
    clearConfirm: (state) => {
      state.status = false
    },
  },
})

export const { confirmDelete, clearConfirm } = deleteSlice.actions

export default deleteSlice.reducer
