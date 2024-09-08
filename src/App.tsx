import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import RequireAuth from './features/auth/RequireAuth'
import PersistLogin from './features/auth/PersistLogin'
import Layout from './Layout/Layout'
import SignIn from './features/auth/SignIn'
import ErrorPage from './features/auth/ErrorPage'
import CharactersList from './features/characters/CharactersList'
import Create from './components/Create/Create'
import Delete from './components/Delete/Delete'
import CharacterForm from './features/characters/CharacterForm'
import Alert from './components/Alert/Alert'
import ClassesList from './features/classes/ClassesList'
import ClassForm from './features/classes/ClassForm'
import RacesList from './features/races/RacesList'
import RaceForm from './features/races/RaceForm'
import SpellsList from './features/spells/SpellsList'
import SpellForm from './features/spells/SpellForm'
import ItemsList from './features/equipment/EquipmentList'
import ItemForm from './features/equipment/EquipmentForm'
import FeatsList from './features/feats/FeatsList'
import FeatForm from './features/feats/FeatForm'
import BackgroundsList from './features/backgrounds/BackgroundsList'
import BackgroundForm from './features/backgrounds/BackgroundForm'
import Class from './features/classes/Class'
import Race from './features/races/Race'
import Feat from './features/feats/Feat'
import Item from './features/equipment/Equipment'
import Background from './features/backgrounds/Background'
import Copy from './components/Copy/Copy'
import ShortDetail from './components/Form/ShortDetail'
import FormProvider from './components/Form/FormProvider'
import FeatureProvider from './components/Form/Features/FeatureProvider'

const App = () => {
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

  const router = createBrowserRouter([
    {
      element: <PersistLogin />,
      children: [
        {
          path: '/',
          element: <Layout />,
          errorElement: <ErrorPage />,
          children: [
            {
              path: ':context',
              element: <SignIn />,
            },
            {
              element: <RequireAuth />,
              children: [
                {
                  element: <FormProvider />,
                  path: '',
                  children: [
                    {
                      path: 'characters',
                      children: [
                        {
                          path: '',
                          element: <CharactersList />,
                          children: [
                            { path: 'create', element: <Create /> },
                            { path: 'delete/:id', element: <Delete /> },
                          ],
                        },
                        {
                          path: ':type?/:id?',
                          element: <CharacterForm />,
                          children: [
                            {
                              path: 'alert/:alertType',
                              element: (
                                <FeatureProvider>
                                  <Alert />
                                </FeatureProvider>
                              ),
                            },
                            { path: ':context/detail/short/:item', element: <ShortDetail /> },
                          ],
                        },
                      ],
                    },
                    {
                      path: 'classes',
                      children: [
                        {
                          path: '',
                          element: <ClassesList />,
                          children: [
                            { path: 'detail/:item', element: <Class /> },
                            { path: 'create', element: <Create /> },
                            { path: 'delete/:id', element: <Delete /> },
                          ],
                        },
                        {
                          path: ':type?/:id?',
                          element: <ClassForm />,
                          children: [
                            {
                              path: 'alert/:alertType',
                              element: (
                                <FeatureProvider>
                                  <Alert />
                                </FeatureProvider>
                              ),
                            },
                            { path: 'copy/feature', element: <Copy /> },
                          ],
                        },
                      ],
                    },
                    {
                      path: 'races',
                      children: [
                        {
                          path: '',
                          element: <RacesList />,
                          children: [
                            { path: 'detail/:id', element: <Race /> },
                            { path: 'create', element: <Create /> },
                            { path: 'delete/:id', element: <Delete /> },
                          ],
                        },
                        {
                          path: ':type?/:id?',
                          element: <RaceForm />,
                          children: [
                            {
                              path: 'alert/:alertType',
                              element: (
                                <FeatureProvider>
                                  <Alert />
                                </FeatureProvider>
                              ),
                            },
                            { path: 'copy/feature', element: <Copy /> },
                          ],
                        },
                      ],
                    },
                    {
                      path: 'spells',
                      children: [
                        {
                          path: '',
                          element: <SpellsList />,
                          children: [
                            { path: 'create', element: <Create /> },
                            { path: 'delete/:id', element: <Delete /> },
                          ],
                        },
                        {
                          path: ':type?/:id?',
                          element: <SpellForm />,
                          children: [
                            {
                              path: 'alert/:alertType',
                              element: (
                                <FeatureProvider>
                                  <Alert />
                                </FeatureProvider>
                              ),
                            },
                            { path: 'copy/feature', element: <Copy /> },
                          ],
                        },
                      ],
                    },
                    {
                      path: 'items',
                      children: [
                        {
                          path: '',
                          element: <ItemsList />,
                          children: [
                            { path: 'detail/:id', element: <Item /> },
                            { path: 'create', element: <Create /> },
                            { path: 'delete/:id', element: <Delete /> },
                          ],
                        },
                        {
                          path: ':type?/:id?',
                          element: <ItemForm />,
                          children: [
                            {
                              path: 'alert/:alertType',
                              element: (
                                <FeatureProvider>
                                  <Alert />
                                </FeatureProvider>
                              ),
                            },
                            { path: 'copy/feature', element: <Copy /> },
                          ],
                        },
                      ],
                    },
                    {
                      path: 'feats',
                      children: [
                        {
                          path: '',
                          element: <FeatsList />,
                          children: [
                            { path: 'detail/:id', element: <Feat /> },
                            { path: 'create', element: <Create /> },
                            { path: 'delete/:id', element: <Delete /> },
                          ],
                        },
                        {
                          path: ':type?/:id?',
                          element: <FeatForm />,
                          children: [
                            {
                              path: 'alert/:alertType',
                              element: (
                                <FeatureProvider>
                                  <Alert />
                                </FeatureProvider>
                              ),
                            },
                            { path: 'copy/feature', element: <Copy /> },
                          ],
                        },
                      ],
                    },
                    {
                      path: 'backgrounds',
                      children: [
                        {
                          path: '',
                          element: <BackgroundsList />,
                          children: [
                            { path: 'detail/:id', element: <Background /> },
                            { path: 'create/:type', element: <Create /> },
                            { path: 'delete/:id', element: <Delete /> },
                          ],
                        },
                        {
                          path: ':type?/:id?',
                          element: <BackgroundForm />,
                          children: [
                            {
                              path: 'alert/:alertType',
                              element: (
                                <FeatureProvider>
                                  <Alert />
                                </FeatureProvider>
                              ),
                            },
                            { path: 'copy/feature', element: <Copy /> },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ])

  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
