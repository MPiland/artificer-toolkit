import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../../app/store'

export const spellSlice = createSlice({
  name: 'spell',
  initialState: { filters: {} },
  reducers: {
    setSpellFilter: (state, action: PayloadAction<any>) => {
      state.filters = action.payload
    },
    clearSpellFilter: (state) => {
      state.filters = {}
    },
  },
})

export const selectSpellsFilter = (state: RootState) => state.spell.filters

export default spellSlice.reducer

export const { setSpellFilter, clearSpellFilter } = spellSlice.actions
