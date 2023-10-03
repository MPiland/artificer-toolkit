import { createSlice } from '@reduxjs/toolkit'

const spellsSlice = createSlice({
  name: 'spells',
  initialState: { data: null },
  reducers: {
    setSpells: (state, { payload }) => {
      state.data = payload
    },
  },
})

export const { setSpells } = spellsSlice.actions

export default spellsSlice.reducer

export const selectSpells = (state) => state.spells.data
