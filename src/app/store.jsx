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
      buildersApiSlice.endpoints.getBuilders.initiate('buildersList')
    )
    await store.dispatch(
      spellsApiSlice.endpoints.getSpells.initiate('spellsList')
    )
    await store.dispatch(
      racesApiSlice.endpoints.getRaces.initiate('racesList')
    )
    await store.dispatch(
      itemsApiSlice.endpoints.getItems.initiate('itemsList')
    )
    await store.dispatch(
      classesApiSlice.endpoints.getClasses.initiate('classesList')
    )
    await store.dispatch(
      featsApiSlice.endpoints.getFeats.initiate('featsList')
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
  devTools: import.meta.env.MODE === 'production' ? false : true,
})

setupListeners(store.dispatch)
