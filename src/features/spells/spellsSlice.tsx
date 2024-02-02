import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface SpellsState {
  filters: any
}

const initialState: SpellsState = {
  filters: {},
}

export const spellsSlice = createSlice({
  name: 'spells',
  initialState,
  reducers: {
    setSpellsFilter: (state, action: PayloadAction<any>) => {
      state.filters = action.payload
    },
    clearSpellsFilter: (state) => {
      state.filters = null
    },
  },
})

export const selectSpellsFilter = (state: { spells: SpellsState }) =>
  state.spells.filters

export const { setSpellsFilter, clearSpellsFilter } = spellsSlice.actions
