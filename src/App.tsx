import { Suspense, useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Layout from './Layout/Layout'
import ErrorPage from './features/auth/ErrorPage'
import CharactersList from './features/characters/CharactersList'
import Delete from './components/Delete/Delete'
import CharacterForm from './features/characters/CharacterForm'
import Alert from './components/Alert/Alert'
import ClassesList from './features/classes/ClassesList'
import ClassForm from './features/classes/ClassForm'
import RacesList from './features/races/RacesList'
import RaceForm from './features/races/RaceForm'
import SpellsList from './features/spells/SpellsList'
import SpellForm from './features/spells/SpellForm'
import EquipmentList from './features/equipment/EquipmentList'
import EquipmentForm from './features/equipment/EquipmentForm'
import FeatsList from './features/feats/FeatsList'
import FeatForm from './features/feats/FeatForm'
import BackgroundsList from './features/backgrounds/BackgroundsList'
import BackgroundForm from './features/backgrounds/BackgroundForm'
import Class from './features/classes/Class'
import Race from './features/races/Race'
import Feat from './features/feats/Feat'
import Equipment from './features/equipment/Equipment'
import Background from './features/backgrounds/Background'
import Copy from './components/Copy/Copy'
import ShortDetail from './components/Form/ShortDetail'
import FeatureContext, { FeatureOptions } from './components/Form/Features/FeatureContext'
import Auth from './features/auth/Auth'
import RequireAuth from './features/auth/RequireAuth'
import ConfirmSignUp from './features/auth/ConfirmSignUp'
import AuthContext, { AuthOptions } from './features/auth/AuthContext'
import LoadingContext, { LoadingOptions } from './components/Loading/LoadingContext'
import Loading from './components/Loading/Loading'
import FormContext, { FormOptions } from './components/Form/FormContext'

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

  const featureOptions = FeatureOptions()

  const router = createBrowserRouter([
    {
      path: '/',
      element: (
          <AuthContext value={AuthOptions()}>
            <LoadingContext value={LoadingOptions()}>
              <Suspense fallback={<Loading />}>
                <Layout />
              </Suspense>
            </LoadingContext>
          </AuthContext>
      ),
      errorElement: <ErrorPage />,
      children: [
        {
          path: 'sign-in',
          element: <Auth />,
        },
        {
          path: 'sign-up',
          element: <Auth />,
        },
        {
          path: ':signType/confirm-sign-up',
          element: <ConfirmSignUp />,
        },
        {
          path: '',
          element: <RequireAuth />,
          children: [
            {
              element: (
                <Suspense fallback={<Loading />}>
                  <FormContext value={FormOptions()} />
                </Suspense>
              ),
              path: '',
              children: [
                {
                  path: 'characters',
                  children: [
                    {
                      path: '',
                      element: <CharactersList />,
                      children: [{ path: 'delete/:id', element: <Delete /> }],
                    },
                    {
                      path: ':type?/:id?',
                      element: <CharacterForm />,
                      children: [
                        {
                          path: 'alert/:alertType',
                          element: (
                            <FeatureContext value={featureOptions}>
                              <Alert />
                            </FeatureContext>
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
                            <FeatureContext value={featureOptions}>
                              <Alert />
                            </FeatureContext>
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
                            <FeatureContext value={featureOptions}>
                              <Alert />
                            </FeatureContext>
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
                      children: [{ path: 'delete/:id', element: <Delete /> }],
                    },
                    {
                      path: ':type?/:id?',
                      element: <SpellForm />,
                      children: [
                        {
                          path: 'alert/:alertType',
                          element: (
                            <FeatureContext value={featureOptions}>
                              <Alert />
                            </FeatureContext>
                          ),
                        },
                        { path: 'copy/feature', element: <Copy /> },
                      ],
                    },
                  ],
                },
                {
                  path: 'Equipment',
                  children: [
                    {
                      path: '',
                      element: <EquipmentList />,
                      children: [
                        { path: 'detail/:id', element: <Equipment /> },
                        { path: 'delete/:id', element: <Delete /> },
                      ],
                    },
                    {
                      path: ':type?/:id?',
                      element: <EquipmentForm />,
                      children: [
                        {
                          path: 'alert/:alertType',
                          element: (
                            <FeatureContext value={featureOptions}>
                              <Alert />
                            </FeatureContext>
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
                            <FeatureContext value={featureOptions}>
                              <Alert />
                            </FeatureContext>
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
                            <FeatureContext value={featureOptions}>
                              <Alert />
                            </FeatureContext>
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
  ])

  return <RouterProvider router={router} />
}

export default App
