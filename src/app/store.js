import { configureStore } from '@reduxjs/toolkit'
import { apiSlice } from './api/apiSlice'
import { setupListeners } from '@reduxjs/toolkit/query'
import authReducer from '../features/auth/authSlice'
import deleteReducer from './deleteSlice'
import loadingReducer from './loadingSlice'
import buildersReducer from '../features/builders/buildersSlice'
import spellsReducer from '../features/spells/spellsSlice'
import racesReducer from '../features/races/racesSlice'
import itemsReducer from '../features/items/itemsSlice'
import classesReducer from '../features/classes/classesSlice'
import featsReducer from '../features/feats/featsSlice'

export const store = configureStore({
  reducer: {
    [apiSlice.reducerPath]: apiSlice.reducer,
    auth: authReducer,
    builders: buildersReducer,
    spells: spellsReducer,
    races: racesReducer,
    items: itemsReducer,
    classes: classesReducer,
    feats: featsReducer,
    delete: deleteReducer,
    loading: loadingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
  devTools: process.env.NODE_ENV === 'production' ? false : true,
})

setupListeners(store.dispatch)
