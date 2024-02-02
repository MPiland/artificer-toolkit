import { store } from '../app/store'
import { itemsApiSlice } from '../features/items/itemsApiSlice'
import { spellsApiSlice } from '../features/spells/spellsApiSlice'
import { racesApiSlice } from '../features/races/racesApiSlice'
import { featsApiSlice } from '../features/feats/featsApiSlice'
import { classesApiSlice } from '../features/classes/classesApiSlice'
import { charactersApiSlice } from '../features/characters/charactersApiSlice'
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { buildersApiSlice } from '../features/builders/buildersApiSlice'

const Prefetch = () => {
  useEffect(() => {
    console.log('prefetching')
    store.dispatch(buildersApiSlice.util.prefetch('getBuilders', undefined, {}))
    store.dispatch(itemsApiSlice.util.prefetch('getItems', undefined, {}))
    store.dispatch(spellsApiSlice.util.prefetch('getSpells', undefined, {}))
    store.dispatch(racesApiSlice.util.prefetch('getRaces', undefined, {}))
    store.dispatch(featsApiSlice.util.prefetch('getFeats', undefined, {}))
    store.dispatch(classesApiSlice.util.prefetch('getClasses', undefined, {}))
    store.dispatch(
      charactersApiSlice.util.prefetch('getCharacters', undefined, {})
    )
  }, [])

  return <Outlet />
}
export default Prefetch
