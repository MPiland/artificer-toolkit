import { createSlice } from '@reduxjs/toolkit'

const spellsSlice = createSlice({
  name: 'spells',
  initialState: { data: null, filters: {} },
  reducers: {
    setSpells: (state, { payload }) => {
      state.data = payload
    },
    setSpellsFilter: (state, { payload }) => {
      state.filters = payload
    },
    clearSpellsFilter: (state) => {
      state.filters = null
    },
  },
})

export const { setSpells, setSpellsFilter, clearSpellsFilter } =
  spellsSlice.actions

export default spellsSlice.reducer

export const selectSpells = (state) => state.spells.data
export const selectSpellsFilter = (state) => state.spells.filters
