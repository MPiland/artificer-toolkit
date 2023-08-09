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
import Spell from './features/spells/Spell'
import SpellList from './features/spells/SpellList'
import NewSpellForm from './features/spells/NewSpellForm'
import EditSpellForm from './features/spells/EditSpellForm'
import ItemList from './features/items/ItemList'
import NewItemForm from './features/items/NewItemForm'
import Feat from './features/feats/Feat'
import FeatList from './features/feats/FeatList'
import NewFeatForm from './features/feats/NewFeatForm'
import EditFeatForm from './features/feats/EditFeatForm'
import { useSelector } from 'react-redux'
import { selectCurrentToken } from './features/auth/authSlice'

const App = () => {
  const token = useSelector(selectCurrentToken)
  const location = useLocation()
  const background = location.state?.background

  const content = (
    <>
      <Routes location={background || location}>
        <Route element={<Layout />}>
          <Route element={<PersistLogin />}>
            <Route path='/' element={token ? <Member /> : <Public />}>
              <Route path='register' element={<Modal child={<Register />} />} />
              <Route path='login' element={<Modal child={<Login />} />} />
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
                  <Route path=':id' element={<Modal child={<Spell />} />} />
                  <Route path='edit/:id' element={<EditSpellForm />} />
                </Route>
                <Route path='items'>
                  <Route index element={<ItemList />} />
                  <Route path='new' element={<NewItemForm />} />
                </Route>
                <Route path='feats'>
                  <Route index element={<FeatList />} />
                  <Route path='new' element={<NewFeatForm />} />
                  <Route path=':id' element={<Modal child={<Feat />} />} />
                  <Route path='edit/:id' element={<EditFeatForm />} />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
      {background && (
        <Routes>
          <Route path='/register' element={<Modal child={<Register />} />} />
          <Route path='/login' element={<Modal child={<Login />} />} />
          <Route path='spells/:id' element={<Modal child={<Spell />} />} />
          <Route path='feats/:id' element={<Modal child={<Feat />} />} />
        </Routes>
      )}
    </>
  )

  return content
}

export default App
