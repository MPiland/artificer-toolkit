import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ModalState {
  status: boolean
  index?: number
  data?: any
}

export const modalSlice = createSlice({
  name: 'modal',
  initialState: {
    delete: { status: false } as ModalState,
    back: { status: false, index: undefined } as ModalState,
    forward: { status: false, index: undefined } as ModalState,
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
      state.back.index = action.payload.index
    },
    clearBack: (state) => {
      state.back.status = false
    },
    confirmForward: (state, action: PayloadAction<ModalState>) => {
      state.forward.status = action.payload.status
      state.forward.index = action.payload.index
    },
    clearForward: (state) => {
      state.forward.status = false
    },
  },
})

export const {
  confirmDelete,
  clearConfirm,
  confirmBack,
  clearBack,
  confirmForward,
  clearForward,
} = modalSlice.actions

export default modalSlice.reducer
