import { Suspense } from 'react'
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
import FeatureProvider from './components/Form/Features/FeatureProvider'
import Auth from './features/auth/Auth'
import RequireAuth from './features/auth/RequireAuth'
import ConfirmSignUp from './features/auth/ConfirmSignUp'
import Loading from './components/Loading/Loading'
import FormProvider from './components/Form/FormProvider'
import ThemeProvider from './theme/ThemeProvider'
import AuthProvider from './features/auth/AuthProvider'
import LoadingProvider from './components/Loading/LoadingProvider'
import Spell from './features/spells/Spell'

const App = () => {
  const router = createBrowserRouter([
    {
      path: '/',
      element: (
        <AuthProvider>
          <LoadingProvider>
            <Suspense fallback={<Loading />}>
              <Layout />
            </Suspense>
          </LoadingProvider>
        </AuthProvider>
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
                  <FormProvider />
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
                        { path: ':id', element: <Race /> },
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
                      children: [{ path: 'delete/:id', element: <Delete /> }],
                    },
                    { path: ':id', element: <Spell />, children: [{ path: 'edit', element: <SpellForm /> }] },
                    {
                      path: 'new',
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
  ])

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default App
