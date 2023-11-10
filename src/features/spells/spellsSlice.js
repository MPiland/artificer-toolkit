import { createSlice } from '@reduxjs/toolkit'

const spellsSlice = createSlice({
  name: 'spells',
  initialState: {
    filters: {},
  },
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
