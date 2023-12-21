import { createSlice } from '@reduxjs/toolkit'
import {  initialState } from './charactersApiSlice'

const charactersSlice = createSlice({
  name: 'characters',
  initialState: { data: initialState, filters: {} },
  reducers: {
    setCharactersFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearCharactersFilter: (state) => {
      state.filters = null
    },
  },
})

export const selectCharactersFilter = (state) => state.characters.filters

export const { setCharactersFilter, clearCharactersFilter } = charactersSlice.actions

export default charactersSlice.reducer
