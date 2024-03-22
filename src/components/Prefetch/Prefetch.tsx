import { store } from '../../app/store'
import { itemApiSlice } from '../../features/item/itemApiSlice'
import { spellApiSlice } from '../../features/spell/spellApiSlice'
import { raceApiSlice } from '../../features/race/raceApiSlice'
import { featApiSlice } from '../../features/feat/featApiSlice'
import { classApiSlice } from '../../features/class/classApiSlice'
import { charactersApiSlice } from '../../features/character/charactersApiSlice'
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { builderApiSlice } from '../../features/builder/builderApiSlice'
import { backgroundsApiSlice } from '../../features/background/backgroundApiSlice'

const Prefetch = () => {
  useEffect(() => {
    store.dispatch(
      builderApiSlice.util.prefetch('getBuilders', undefined, { force: true })
    )
    store.dispatch(
      itemApiSlice.util.prefetch('getItems', undefined, { force: true })
    )
    store.dispatch(
      spellApiSlice.util.prefetch('getSpells', undefined, { force: true })
    )
    store.dispatch(
      raceApiSlice.util.prefetch('getRaces', undefined, { force: true })
    )
    store.dispatch(
      featApiSlice.util.prefetch('getFeats', undefined, { force: true })
    )
    store.dispatch(
      classApiSlice.util.prefetch('getClasses', undefined, { force: true })
    )
    store.dispatch(
      charactersApiSlice.util.prefetch('getCharacters', undefined, {
        force: true,
      })
    )
    store.dispatch(
      backgroundsApiSlice.util.prefetch('getBackgrounds', undefined, {
        force: true,
      })
    )
  }, [])

  return <Outlet />
}
export default Prefetch
