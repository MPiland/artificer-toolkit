import 'react-tooltip/dist/react-tooltip.css'
import { Routes, Route, useLocation } from 'react-router-dom'
import RequireAuth from './features/auth/RequireAuth'
import PersistLogin from './features/auth/PersistLogin'
import Public from './components/Public'
import Modal from './components/Modal'
import Register from './features/auth/Register'
import Login from './features/auth/Login'
import Member from './components/Member'
import useAuth from './hooks/useAuth'
import usePersist from './hooks/usePersist'
import CharacterList from './features/characters/CharacterList'
import RaceList from './features/races/RaceList'
import NewRaceForm from './features/races/NewRaceForm'
import SpellList from './features/spells/SpellList'
import NewSpellForm from './features/spells/NewSpellForm'
import ItemList from './features/items/ItemList'
import NewItemForm from './features/items/NewItemForm'
import FeatureList from './features/features/FeatureList'
import NewFeatureForm from './features/features/NewFeatureForm'

const App = () => {
  const { id } = useAuth()
  const [persist] = usePersist()
  const location = useLocation()
  const background = location.state?.backgrounds

  const content = (
    <>
      <Routes location={background || location}>
        <Route element={<PersistLogin />}>
          <Route path='/' element={id ? <Member id={id} /> : <Public />}>
            <Route element={<Modal />}>
              <Route path='register' element={<Register />} />
              <Route path='login' element={<Login />} />
            </Route>
            <Route path='media' />
            <Route path='about' />
            {/*Logged in*/}
            <Route element={<RequireAuth />}>
              <Route path='characters'>
                <Route index element={<CharacterList id={id} />} />
              </Route>
              <Route path='races'>
                <Route index element={<RaceList id={id} />} />
                <Route path='new' element={<NewRaceForm id={id} />} />
              </Route>
              <Route path='spells'>
                <Route index element={<SpellList id={id} />} />
                <Route path='new' element={<NewSpellForm id={id} />} />
              </Route>
              <Route path='items'>
                <Route index element={<ItemList id={id} />} />
                <Route path='new' element={<NewItemForm id={id} />} />
              </Route>
              <Route path='features'>
                <Route index element={<FeatureList id={id} />} />
                <Route path='new' element={<NewFeatureForm id={id} />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
      {background && (
        <Routes>
          <Route element={<Modal />}>
            <Route path='register' element={<Register />} />
            <Route path='login' element={<Login />} />
          </Route>
        </Routes>
      )}
    </>
  )

  return content
}

export default App
