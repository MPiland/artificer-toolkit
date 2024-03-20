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
import CharacterList from './features/character/CharacterList'
import Class from './features/class/Class'
import ClassList from './features/class/ClassList'
import ClassForm from './features/class/ClassForm'
import Race from './features/race/Race'
import RaceList from './features/race/RaceList'
import RaceForm from './features/race/RaceForm'
import Spell from './features/spell/Spell'
import SpellList from './features/spell/SpellList'
import SpellForm from './features/spell/SpellForm'
import Item from './features/item/Item'
import ItemList from './features/item/ItemList'
import ItemForm from './features/item/ItemForm'
import Feat from './features/feat/Feat'
import FeatList from './features/feat/FeatList'
import FeatForm from './features/feat/FeatForm'
import Create from './components/Create/Create'
import Alert from './components/Alert/Alert'

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
                  <Route path=':context' element={<ClassForm />}>
                    <Route path=':id' element={<ClassForm />} />
                  </Route>
                </Route>
                <Route path='races'>
                  <Route
                    index
                    element={<RaceList scrollPosition={scrollPosition} />}
                  />
                  <Route path=':context' element={<RaceForm />}>
                    <Route path=':id' element={<RaceForm />} />
                  </Route>
                </Route>
                <Route path='spells'>
                  <Route
                    index
                    element={<SpellList scrollPosition={scrollPosition} />}
                  />
                  <Route path=':context' element={<SpellForm />}>
                    <Route path=':id' element={<SpellForm />} />
                  </Route>
                </Route>
                <Route path='items'>
                  <Route
                    index
                    element={<ItemList scrollPosition={scrollPosition} />}
                  />
                  <Route path=':context' element={<ItemForm />}>
                    <Route path=':id' element={<ItemForm />} />
                  </Route>
                </Route>
                <Route path='feats'>
                  <Route
                    index
                    element={<FeatList scrollPosition={scrollPosition} />}
                  />
                  <Route path=':context' element={<FeatForm />}>
                    <Route path=':id' element={<FeatForm />} />
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
            <Route path='/:context' element={<SignIn />} />
            <Route path='/spells/:id' element={<Spell />} />
            <Route path='/feats/:id' element={<Feat />} />
            <Route path='/items/:id' element={<Item />} />
            <Route path='/races/:id' element={<Race />} />
            <Route path='/classes/:id' element={<Class />} />
            <Route path='/delete/:id' element={<Delete />} />
            <Route path='/create/:type' element={<Create />} />
            <Route path='*' element={<Alert />} />
          </Route>
        </Routes>
      )}
    </>
  )

  return content
}

export default App
