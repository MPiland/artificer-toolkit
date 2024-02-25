import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectCurrentToken } from './features/auth/authSlice'
import RequireAuth from './features/auth/RequireAuth'
import PersistLogin from './features/auth/PersistLogin'
import Layout from './components/Layout/Layout'
import Modal from './components/Modal/Modal'
import Prefetch from './components/Prefetch/Prefetch'
import SignIn from './features/auth/SignIn'
import Delete from './components/Delete/Delete'
import CharacterList from './features/characters/CharacterList'
import Class from './features/classes/Class'
import ClassList from './features/classes/ClassList'
import ClassForm from './features/classes/ClassForm'
import Race from './features/races/Race'
import RaceList from './features/races/RaceList'
import RaceForm from './features/races/RaceForm'
import Spell from './features/spells/Spell'
import SpellList from './features/spells/SpellList'
import SpellForm from './features/spells/SpellForm'
import Item from './features/items/Item'
import ItemList from './features/items/ItemList'
import ItemForm from './features/items/ItemForm'
import Feat from './features/feats/Feat'
import FeatList from './features/feats/FeatList'
import FeatForm from './features/feats/FeatForm'
import Create from './components/Create/Create'

const App = () => {
  const [theme] = useState('light')

  useEffect(() => {
    document.body.dataset.theme = theme
  }, [theme])

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
  const scrollPosition: number = location.state?.scrollPosition

  const content = (
    <>
      <Routes location={background || location}>
        <Route element={<PersistLogin />}>
          <Route path='/' element={<Layout token={token} />}>
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
                  <Route path='new' element={<ClassForm context='create' />} />
                  <Route
                    path='edit/:id'
                    element={<ClassForm context='edit' />}
                  />
                </Route>
                <Route path='races'>
                  <Route
                    index
                    element={<RaceList scrollPosition={scrollPosition} />}
                  />
                  <Route path='new' element={<RaceForm context='create' />} />
                  <Route
                    path='edit/:id'
                    element={<RaceForm context='edit' />}
                  />
                </Route>
                <Route path='spells'>
                  <Route
                    index
                    element={<SpellList scrollPosition={scrollPosition} />}
                  />
                  <Route path='new' element={<SpellForm context='create' />} />
                  <Route
                    path='edit/:id'
                    element={<SpellForm context='edit' />}
                  />
                </Route>
                <Route path='items'>
                  <Route
                    index
                    element={<ItemList scrollPosition={scrollPosition} />}
                  />
                  <Route path='new' element={<ItemForm context='create' />} />
                  <Route
                    path='edit/:id'
                    element={<ItemForm context='edit' />}
                  />
                </Route>
                <Route path='feats'>
                  <Route
                    index
                    element={<FeatList scrollPosition={scrollPosition} />}
                  />
                  <Route path='new' element={<FeatForm context='create' />} />
                  <Route
                    path='edit/:id'
                    element={<FeatForm context='edit' />}
                  />
                </Route>
              </Route>
            </Route>
          </Route>
        </Route>
      </Routes>
      {background && (
        <Routes>
          <Route element={<Modal />}>
            <Route path='/:context' element={<SignIn />} />
            <Route path='/spells/:id' element={<Spell />} />
            <Route path='/feats/:id' element={<Feat />} />
            <Route path='/items/:id' element={<Item />} />
            <Route path='/races/:id' element={<Race />} />
            <Route path='/classes/:id' element={<Class />} />
            <Route path='/delete/:id' element={<Delete />} />
            <Route path='/:context/create' element={<Create />} />
          </Route>
        </Routes>
      )}
    </>
  )

  return content
}

export default App
