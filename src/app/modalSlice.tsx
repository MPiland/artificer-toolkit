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
    back: { status: false } as ModalState,
    forward: { status: false } as ModalState,
    step: { status: false, index: undefined } as ModalState,
    copy: { status: false } as ModalState,
  },
  reducers: {
    confirmDelete: (state, action: PayloadAction<ModalState>) => {
      state.delete.status = action.payload.status
      state.delete.data = action.payload.data
    },
    clearDelete: (state) => {
      state.delete.status = false
    },
    confirmBack: (state, action: PayloadAction<ModalState>) => {
      state.back.status = action.payload.status
    },
    clearBack: (state) => {
      state.back.status = false
    },
    confirmForward: (state, action: PayloadAction<ModalState>) => {
      state.forward.status = action.payload.status
    },
    clearForward: (state) => {
      state.forward.status = false
    },
    confirmStep: (state, action: PayloadAction<ModalState>) => {
      state.step.status = action.payload.status
      state.step.index = action.payload.index
    },
    clearStep: (state) => {
      state.step.status = false
    },
    confirmCopy: (state, action: PayloadAction<ModalState>) => {
      state.copy.status = action.payload.status
    },
    clearCopy: (state) => {
      state.copy.status = false
    },
  },
})

export const {
  confirmDelete,
  clearDelete,
  confirmBack,
  clearBack,
  confirmForward,
  clearForward,
  confirmStep,
  clearStep,
  confirmCopy,
  clearCopy,
} = modalSlice.actions

export default modalSlice.reducer
