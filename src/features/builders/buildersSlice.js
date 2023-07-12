import { createSlice } from '@reduxjs/toolkit'
import { buildersApiSlice } from './buildersApiSlice'

const buildersSlice = createSlice({
  name: 'builders',
  initialState: { builders: null },
  reducers: {},
  extraReducers: (builder) => {
    builder.addMatcher(
      buildersApiSlice.endpoints.getBuilder.matchFulfilled,
      (state, { payload }) => {
        state.data = payload
      }
    )
  },
})

export default buildersSlice.reducer

export const selectBuilders = (state) => state.builders.data
