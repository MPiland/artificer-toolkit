import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'
import { apiSlice } from './api/apiSlice'
import { setupListeners } from '@reduxjs/toolkit/dist/query'
import authReducer, { setCredentials } from '../features/auth/authSlice'
import deleteReducer from './deleteSlice'
import loadingReducer, { setLoading } from './loadingSlice'
import buildersReducer from '../features/builders/buildersSlice'
import { buildersApiSlice } from '../features/builders/buildersApiSlice'
import spellsReducer from '../features/spells/spellsSlice'
import { spellsApiSlice } from '../features/spells/spellsApiSlice'
import racesReducer from '../features/races/racesSlice'
import { racesApiSlice } from '../features/races/racesApiSlice'
import itemsReducer from '../features/items/itemsSlice'
import { itemsApiSlice } from '../features/items/itemsApiSlice'
import classesReducer from '../features/classes/classesSlice'
import { classesApiSlice } from '../features/classes/classesApiSlice'
import featsReducer from '../features/feats/featsSlice'
import { featsApiSlice } from '../features/feats/featsApiSlice'

const tokenListenerMiddleware = createListenerMiddleware()

tokenListenerMiddleware.startListening({
  actionCreator: setCredentials,
  effect: async (action, listenerApi) => {
    listenerApi.cancelActiveListeners()
    store.dispatch(setLoading(true))
    await store.dispatch(
      buildersApiSlice.endpoints.getBuilders.initiate(action.payload.id)
    )
    await store.dispatch(
      spellsApiSlice.endpoints.getSpells.initiate(action.payload.id)
    )
    await store.dispatch(
      racesApiSlice.endpoints.getRaces.initiate(action.payload.id)
    )
    await store.dispatch(
      itemsApiSlice.endpoints.getItems.initiate(action.payload.id)
    )
    await store.dispatch(
      classesApiSlice.endpoints.getClasses.initiate(action.payload.id)
    )
    await store.dispatch(
      featsApiSlice.endpoints.getFeats.initiate(action.payload.id)
    )
    store.dispatch(setLoading(false))
  },
})

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
    getDefaultMiddleware()
      .concat(apiSlice.middleware)
      .prepend(tokenListenerMiddleware.middleware),
  devTools: process.env.NODE_ENV === 'production' ? false : true,
})

setupListeners(store.dispatch)
