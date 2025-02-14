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
import CopyFeature from './components/Form/Features/CopyFeature/CopyFeature'
import ShortDetail from './components/Form/ShortDetail'
import FeatureProvider from './components/Form/Features/FeatureProvider'
import Auth from './features/auth/Auth'
import RequireAuth from './features/auth/RequireAuth'
import Confirm from './features/auth/Confirm'
import Loading from './components/Loading/Loading'
import FormProvider from './components/Form/FormProvider'
import ThemeProvider from './theme/ThemeProvider'
import AuthProvider from './features/auth/AuthProvider'
import LoadingProvider from './components/Loading/LoadingProvider'
import Spell from './features/spells/Spell'
import Character from './features/characters/Character'
import Copy from './components/List/Copy/Copy'

const App = () => {
  const router = createBrowserRouter([
    {
      path: '/',
      element: (
        <AuthProvider>
          <LoadingProvider>
            <Layout />
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
          element: <Confirm />,
        },
        {
          path: 'sign-in/reset-password',
          element: <Confirm />,
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
                      children: [
                        { path: 'delete/:id', element: <Delete /> },
                        { path: 'copy', element: <Copy /> },
                      ],
                    },
                    { path: ':id', element: <Character />, children: [{ path: 'edit', element: <SpellForm /> }] },
                    {
                      path: 'new/:id?',
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
                        { path: 'delete/:id', element: <Delete /> },
                        { path: 'copy', element: <Copy /> },
                      ],
                    },
                    { path: ':id', element: <Class />, children: [{ path: 'edit', element: <ClassForm /> }] },
                    {
                      path: 'new/:id?',
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
                        { path: 'copy/feature', element: <CopyFeature /> },
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
                        { path: 'delete/:id', element: <Delete /> },
                        { path: 'copy', element: <Copy /> },
                      ],
                    },
                    { path: ':id', element: <Race />, children: [{ path: 'edit', element: <RaceForm /> }] },
                    {
                      path: 'new/:id?',
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
                        { path: 'copy/feature', element: <CopyFeature /> },
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
                        { path: 'delete/:id', element: <Delete /> },
                        { path: 'copy', element: <Copy /> },
                      ],
                    },
                    { path: ':id', element: <Spell />, children: [{ path: 'edit', element: <SpellForm /> }] },
                    {
                      path: 'new/:id?',
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
                        { path: 'copy/feature', element: <CopyFeature /> },
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
                        { path: 'delete/:id', element: <Delete /> },
                        { path: 'copy', element: <Copy /> },
                      ],
                    },
                    { path: ':id', element: <Equipment />, children: [{ path: 'edit', element: <EquipmentForm /> }] },
                    {
                      path: 'new/:id?',
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
                        { path: 'copy/feature', element: <CopyFeature /> },
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
                        { path: 'delete/:id', element: <Delete /> },
                        { path: 'copy', element: <Copy /> },
                      ],
                    },
                    { path: ':id', element: <Feat />, children: [{ path: 'edit', element: <FeatForm /> }] },
                    {
                      path: 'new/:id?',
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
                        { path: 'copy/feature', element: <CopyFeature /> },
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
                        { path: 'delete/:id', element: <Delete /> },
                        { path: 'copy', element: <Copy /> },
                      ],
                    },
                    { path: ':id', element: <Background />, children: [{ path: 'edit', element: <BackgroundForm /> }] },
                    {
                      path: 'new/:id?',
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
                        { path: 'copy/feature', element: <CopyFeature /> },
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
