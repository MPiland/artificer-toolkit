import { createSlice} from '@reduxjs/toolkit'
import {
  initialState,
} from './spellsApiSlice'

const spellsSlice = createSlice({
  name: 'spells',
  initialState: { data: initialState, filters: {} },
  reducers: {
    setSpellsFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearSpellsFilter: (state) => {
      state.filters = null
    },
  },
})
export const selectSpellsFilter = (state) => state.spells.filters

export const { setSpellsFilter, clearSpellsFilter } = spellsSlice.actions

export default spellsSlice.reducer
