import { store } from '../../app/store'
import { itemApiSlice } from '../../features/equipment/itemApiSlice'
import { spellApiSlice } from '../../features/spells/spellApiSlice'
import { raceApiSlice } from '../../features/races/raceApiSlice'
import { featApiSlice } from '../../features/feats/featApiSlice'
import { classApiSlice } from '../../features/classes/classApiSlice'
import { charactersApiSlice } from '../../features/characters/charactersApiSlice'
import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { builderApiSlice } from '../../features/builders/builderApiSlice'
import { backgroundsApiSlice } from '../../features/backgrounds/backgroundApiSlice'

const Prefetch = ({ token }: { token: boolean | null }) => {
  useEffect(() => {
    if (token) {
      store.dispatch(builderApiSlice.util.prefetch('getBuilders', undefined, { force: true }))
      store.dispatch(itemApiSlice.util.prefetch('getItems', undefined, { force: true }))
      store.dispatch(spellApiSlice.util.prefetch('getSpells', undefined, { force: true }))
      store.dispatch(raceApiSlice.util.prefetch('getRaces', undefined, { force: true }))
      store.dispatch(featApiSlice.util.prefetch('getFeats', undefined, { force: true }))
      store.dispatch(classApiSlice.util.prefetch('getClasses', undefined, { force: true }))
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
    }
  }, [token])

  return <Outlet />
}
export default Prefetch
