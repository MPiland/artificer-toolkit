import { createSlice } from '@reduxjs/toolkit'
import { spellsApiSlice } from './spellsApiSlice'

const spellsSlice = createSlice({
  name: 'spells',
  initialState: { spells: null },
  reducers: {},
  extraReducers: (builder) => {
    builder.addMatcher(
      spellsApiSlice.endpoints.getSpell.matchFulfilled,
      (state, { payload }) => {
        state.data = payload
      }
    )
  },
})

export default spellsSlice.reducer

export const selectSpells = (state) => state.spells.data
