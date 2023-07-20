import 'react-tooltip/dist/react-tooltip.css'
import { Routes, Route, useLocation } from 'react-router-dom'
import RequireAuth from './features/auth/RequireAuth'
import PersistLogin from './features/auth/PersistLogin'
import Layout from './components/Layout'
import Public from './components/Public'
import Member from './components/Member'
import Modal from './components/Modal'
import Register from './features/auth/Register'
import Login from './features/auth/Login'
import CharacterList from './features/characters/CharacterList'
import RaceList from './features/races/RaceList'
import NewRaceForm from './features/races/NewRaceForm'
import SpellList from './features/spells/SpellList'
import NewSpellForm from './features/spells/NewSpellForm'
import ItemList from './features/items/ItemList'
import NewItemForm from './features/items/NewItemForm'
import FeatList from './features/feats/FeatList'
import NewfeatForm from './features/feats/NewFeatForm'
import { useSelector } from 'react-redux'
import { selectCurrentToken } from './features/auth/authSlice'

const App = () => {
  const token = useSelector(selectCurrentToken)
  const location = useLocation()
  const background = location.state?.backgrounds

  const content = (
    <>
      <Routes location={background || location}>
        <Route element={<Layout />}>
          <Route element={<PersistLogin />}>
            <Route path='/' element={token ? <Member /> : <Public />}>
              <Route element={<Modal />}>
                <Route path='register' element={<Register />} />
                <Route path='login' element={<Login />} />
              </Route>
              <Route path='media' />
              <Route path='about' />

              {/*Logged in*/}
              <Route element={<RequireAuth />}>
                <Route path='characters'>
                  <Route index element={<CharacterList />} />
                </Route>
                <Route path='races'>
                  <Route index element={<RaceList />} />
                  <Route path='new' element={<NewRaceForm />} />
                </Route>
                <Route path='spells'>
                  <Route index element={<SpellList />} />
                  <Route path='new' element={<NewSpellForm />} />
                </Route>
                <Route path='items'>
                  <Route index element={<ItemList />} />
                  <Route path='new' element={<NewItemForm />} />
                </Route>
                <Route path='feats'>
                  <Route index element={<FeatList />} />
                  <Route path='new' element={<NewfeatForm />} />
                </Route>
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
