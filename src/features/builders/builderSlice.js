import { createSlice } from '@reduxjs/toolkit'
import { builderApiSlice } from './builderApiSlice'

const builderSlice = createSlice({
  name: 'builders',
  initialState: { builders: null },
  reducers: {},
  extraReducers: (builder) => {
    builder.addMatcher(
      builderApiSlice.endpoints.getBuilder.matchFulfilled,
      (state, { payload }) => {
        state.data = payload
      }
    )
  },
})

export default builderSlice.reducer

export const selectBuilders = (state) => state.builders.data
