import { createSlice } from '@reduxjs/toolkit'
import { initialState } from './charactersApiSlice'
import { RootState } from '../../app/store'

export const charactersSlice = createSlice({
  name: 'characters',
  initialState: { data: initialState, filters: {} },
  reducers: {
    setCharactersFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearCharactersFilter: (state) => {
      state.filters = {}
    },
  },
})

export const selectCharactersFilter = (state: RootState) =>
  state.characters.filters

export const { setCharactersFilter, clearCharactersFilter } =
  charactersSlice.actions
