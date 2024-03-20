import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const characterSlice = createSlice({
  name: 'character',
  initialState: { filters: {} },
  reducers: {
    setCharacterFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearCharacterFilter: (state) => {
      state.filters = {}
    },
  },
})

export const selectCharactersFilter = (state: RootState) =>
  state.character.filters

export const { setCharacterFilter, clearCharacterFilter } =
  characterSlice.actions
