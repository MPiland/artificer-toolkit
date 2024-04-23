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
import BackgroundForm from './features/background/BackgroundForm'
import BackgroundList from './features/background/BackgroundList'
import Background from './features/background/Background'
import CharacterForm from './features/character/CharacterForm'
import Copy from './components/Copy/Copy'
import RaceShort from './features/race/RaceShort'
import ClassShort from './features/class/ClassShort'

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

  const content = (
    <>
      <Routes location={background || location}>
        <Route element={<PersistLogin />}>
          <Route path='/' element={<Layout token={token} />}>
            {/*Logged in*/}
            <Route element={<RequireAuth />}>
              <Route element={<Prefetch />}>
                <Route path='character'>
                  <Route index element={<CharacterList />} />
                  <Route path=':context' element={<CharacterForm />}>
                    <Route path=':id' element={<CharacterForm />} />
                  </Route>
                </Route>
                <Route path='class'>
                  <Route index element={<ClassList />} />
                  <Route path=':context' element={<ClassForm />}>
                    <Route path=':id' element={<ClassForm />} />
                  </Route>
                </Route>
                <Route path='race'>
                  <Route index element={<RaceList />} />
                  <Route path=':context' element={<RaceForm />}>
                    <Route path=':id' element={<RaceForm />} />
                  </Route>
                </Route>
                <Route path='spell'>
                  <Route index element={<SpellList />} />
                  <Route path=':context' element={<SpellForm />}>
                    <Route path=':id' element={<SpellForm />} />
                  </Route>
                </Route>
                <Route path='item'>
                  <Route index element={<ItemList />} />
                  <Route path=':context' element={<ItemForm />}>
                    <Route path=':id' element={<ItemForm />} />
                  </Route>
                </Route>
                <Route path='feat'>
                  <Route index element={<FeatList />} />
                  <Route path=':context' element={<FeatForm />}>
                    <Route path=':id' element={<FeatForm />} />
                  </Route>
                </Route>
                <Route path='background'>
                  <Route index element={<BackgroundList />} />
                  <Route path=':context' element={<BackgroundForm />}>
                    <Route path=':id' element={<BackgroundForm />} />
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
            <Route path='/spell/:id' element={<Spell />} />
            <Route path='/feat/:id' element={<Feat />} />
            <Route path='/item/:id' element={<Item />} />
            <Route path='/race/:id' element={<Race />} />
            <Route path='/race/:id/short' element={<RaceShort />} />
            <Route path='/class/:id' element={<Class />} />
            <Route path='/class/:id/short' element={<ClassShort />} />
            <Route path='/background/:id' element={<Background />} />
            <Route path='/delete/:id' element={<Delete />} />
            <Route path='/create/:type' element={<Create />} />
            <Route path='/copy/feature' element={<Copy />} />
            <Route path=':id/alert' element={<Alert />} />
          </Route>
        </Routes>
      )}
    </>
  )

  return content
}

export default App
