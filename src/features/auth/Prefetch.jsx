import { store } from '../../app/store'
import { itemsApiSlice } from '../items/itemsApiSlice'
import { spellsApiSlice } from '../spells/spellsApiSlice'
import { racesApiSlice } from '../races/racesApiSlice'
import { featsApiSlice } from '../feats/featsApiSlice'
import { classesApiSlice } from '../classes/classesApiSlice'
import { charactersApiSlice } from '../characters/charactersApiSlice'
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { buildersApiSlice } from '../builders/buildersApiSlice'

const Prefetch = () => {
  useEffect(() => {
    store.dispatch(
      buildersApiSlice.util.prefetch('getBuilders', 'buildersList', {
        force: true,
      })
    )
    store.dispatch(
      itemsApiSlice.util.prefetch('getItems', 'itemsList', { force: true })
    )
    store.dispatch(
      spellsApiSlice.util.prefetch('getSpells', 'spellsList', { force: true })
    )
    store.dispatch(
      racesApiSlice.util.prefetch('getRaces', 'racesList', { force: true })
    )
    store.dispatch(
      featsApiSlice.util.prefetch('getFeats', 'featsList', { force: true })
    )
    store.dispatch(
      classesApiSlice.util.prefetch('getClasses', 'classesList', {
        force: true,
      })
    )
    store.dispatch(
      charactersApiSlice.util.prefetch('getCharacters', 'charactersList', {
        force: true,
      })
    )
  }, [])

  return <Outlet />
}
export default Prefetch
