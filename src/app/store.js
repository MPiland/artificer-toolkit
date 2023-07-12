import { configureStore } from '@reduxjs/toolkit'
import { apiSlice } from './api/apiSlice'
import { setupListeners } from '@reduxjs/toolkit/dist/query'
import authReducer from '../features/auth/authSlice'
import spellsReducer from '../features/spells/spellsSlice'
import buildersReducer from '../features/builders/buildersSlice'

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    spells: spellsReducer,
    builders: buildersReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
  devTools: process.env.NODE_ENV === 'production' ? false : true,
})

setupListeners(store.dispatch)
