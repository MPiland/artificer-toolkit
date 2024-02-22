import { store } from '../../app/store'
import { itemsApiSlice } from '../../features/items/itemsApiSlice'
import { spellsApiSlice } from '../../features/spells/spellsApiSlice'
import { racesApiSlice } from '../../features/races/racesApiSlice'
import { featsApiSlice } from '../../features/feats/featsApiSlice'
import { classesApiSlice } from '../../features/classes/classesApiSlice'
import { charactersApiSlice } from '../../features/characters/charactersApiSlice'
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { buildersApiSlice } from '../../features/builders/buildersApiSlice'

const Prefetch = () => {
  useEffect(() => {
    store.dispatch(
      buildersApiSlice.util.prefetch('getBuilders', undefined, { force: true })
    )
    store.dispatch(
      itemsApiSlice.util.prefetch('getItems', undefined, { force: true })
    )
    store.dispatch(
      spellsApiSlice.util.prefetch('getSpells', undefined, { force: true })
    )
    store.dispatch(
      racesApiSlice.util.prefetch('getRaces', undefined, { force: true })
    )
    store.dispatch(
      featsApiSlice.util.prefetch('getFeats', undefined, { force: true })
    )
    store.dispatch(
      classesApiSlice.util.prefetch('getClasses', undefined, { force: true })
    )
    store.dispatch(
      charactersApiSlice.util.prefetch('getCharacters', undefined, {
        force: true,
      })
    )
  }, [])

  return <Outlet />
}
export default Prefetch
