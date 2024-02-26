import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ModalState {
  status: boolean
  data?: any
}

export const modalSlice = createSlice({
  name: 'modal',
  initialState: {
    delete: { status: false } as ModalState,
    back: { status: false },
  },
  reducers: {
    confirmDelete: (state, action: PayloadAction<ModalState>) => {
      state.delete.status = action.payload.status
      state.delete.data = action.payload.data
    },
    clearConfirm: (state) => {
      state.delete.status = false
    },
    confirmBack: (state, action: PayloadAction<ModalState>) => {
      state.back.status = action.payload.status
    },
    clearBack: (state) => {
      state.back.status = false
    },
  },
})

export const { confirmDelete, clearConfirm, confirmBack, clearBack } =
  modalSlice.actions

export default modalSlice.reducer
