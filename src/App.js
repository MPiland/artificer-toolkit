import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectCurrentToken } from './features/auth/authSlice'
import RequireAuth from './features/auth/RequireAuth'
import PersistLogin from './features/auth/PersistLogin'
import Layout from './components/Layout'
import Public from './components/Public'
import Member from './components/Member'
import Modal from './components/Modal'
import Delete from './components/Delete'
import Register from './features/auth/Register'
import Login from './features/auth/Login'
import CharacterList from './features/characters/CharacterList'
import Class from './features/classes/Class'
import ClassList from './features/classes/ClassList'
import NewClassForm from './features/classes/NewClassForm'
import EditClassForm from './features/classes/EditClassForm'
import Race from './features/races/Race'
import RaceList from './features/races/RaceList'
import NewRaceForm from './features/races/NewRaceForm'
import EditRaceForm from './features/races/EditRaceForm'
import Spell from './features/spells/Spell'
import SpellList from './features/spells/SpellList'
import NewSpellForm from './features/spells/NewSpellForm'
import EditSpellForm from './features/spells/EditSpellForm'
import Item from './features/items/Item'
import ItemList from './features/items/ItemList'
import NewItemForm from './features/items/NewItemForm'
import EditItemForm from './features/items/EditItemForm'
import Feat from './features/feats/Feat'
import FeatList from './features/feats/FeatList'
import NewFeatForm from './features/feats/NewFeatForm'
import EditFeatForm from './features/feats/EditFeatForm'
import Prefetch from './features/auth/Prefetch'
import { selectLoadingStatus } from './app/loadingSlice'
import Spinner from './components/Spinner'

const App = () => {
  const isLoading = useSelector(selectLoadingStatus)

  useEffect(() => {
    const documentHeight = () => {
      const doc = document.documentElement
      doc.style.setProperty('--doc-height', `${window.innerHeight}px`)
    }
    window.addEventListener('resize', documentHeight)

    return () => {
      window.addEventListener('resize', documentHeight)
    }
  })

  const token = useSelector(selectCurrentToken)
  const location = useLocation()
  const background = location.state?.background
  const scrollPosition = location.state?.scrollPosition

  const content = (
    <>
      <Routes location={background || location}>
        <Route element={<Layout />}>
          <Route element={<PersistLogin />}>
            <Route path='/' element={token ? <Member /> : <Public />}>
              <Route path='media' />
              <Route path='about' />
              {/*Logged in*/}
              <Route element={<RequireAuth />}>
                <Route element={<Prefetch />}>
                  <Route path='characters'>
                    <Route index element={<CharacterList />} />
                  </Route>
                  <Route path='classes'>
                    <Route
                      index
                      element={<ClassList scrollPosition={scrollPosition} />}
                    />
                    <Route path='new' element={<NewClassForm />} />
                    <Route path='edit/:id' element={<EditClassForm />} />
                  </Route>
                  <Route path='races'>
                    <Route
                      index
                      element={<RaceList scrollPosition={scrollPosition} />}
                    />
                    <Route path='new' element={<NewRaceForm />} />
                    <Route path='edit/:id' element={<EditRaceForm />} />
                  </Route>
                  <Route path='spells'>
                    <Route
                      index
                      element={<SpellList scrollPosition={scrollPosition} />}
                    />
                    <Route path='new' element={<NewSpellForm />} />
                    <Route path='edit/:id' element={<EditSpellForm />} />
                  </Route>
                  <Route path='items'>
                    <Route
                      index
                      element={<ItemList scrollPosition={scrollPosition} />}
                    />
                    <Route path='new' element={<NewItemForm />} />
                    <Route path='edit/:id' element={<EditItemForm />} />
                  </Route>
                  <Route path='feats'>
                    <Route
                      index
                      element={<FeatList scrollPosition={scrollPosition} />}
                    />
                    <Route path='new' element={<NewFeatForm />} />
                    <Route path='edit/:id' element={<EditFeatForm />} />
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
      {background && (
        <Routes>
          <Route element={<Modal />}>
            <Route path='/register' element={<Register />} />
            <Route path='/login' element={<Login />} />
            <Route path='/spells/:id' element={<Spell />} />
            <Route path='/feats/:id' element={<Feat />} />
            <Route path='/items/:id' element={<Item />} />
            <Route path='/races/:id' element={<Race />} />
            <Route path='/classes/:id' element={<Class />} />
            <Route path='/delete/:id' element={<Delete />} />
          </Route>
        </Routes>
      )}
      {isLoading && (
        <Routes>
          <Route element={<Spinner />} />
        </Routes>
      )}
    </>
  )

  return content
}

export default App
