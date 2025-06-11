import '@mantine/notifications/styles.layer.css'
import '@mantine/core/styles.layer.css'
import '@/css/main.css'
import '@/css/theme.css'
import { StrictMode, use } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { AuthContext } from './pages/auth/AuthContext'
import AuthProvider from './pages/auth/AuthProvider'
import { FormDataType, type FormType } from './types/types'
import ErrorPage from './pages/auth/ErrorPage'
import useSystemPref from './hooks/useSystemPref'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { resolver, theme } from './css/theme'
import { Amplify } from 'aws-amplify'
import { ModalProvider } from '@/components/Modal'
import { generateClient } from 'aws-amplify/api'

export const queryClient = new QueryClient()

Amplify.configure({
  API: {
    REST: {
      InitUserDomainData: {
        endpoint: import.meta.env.VITE_AWS_INIT_USER_DOMAIN_DATA_ENDPOINT,
        region: import.meta.env.VITE_AWS_DEFAULT_REGION,
      },
      InitUserFeatureData: {
        endpoint: import.meta.env.VITE_AWS_INIT_USER_FEATURE_DATA_ENDPOINT,
        region: import.meta.env.VITE_AWS_DEFAULT_REGION,
      },
    },
  },
  Auth: {
    Cognito: {
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
    },
  },
})

export const adminClient = generateClient({
  endpoint: import.meta.env.VITE_AWS_ADMIN_GRAPHQL_ENDPOINT,
  region: import.meta.env.VITE_AWS_DEFAULT_REGION,
  authMode: 'userPool',
})

export const userClient = generateClient({
  endpoint: import.meta.env.VITE_AWS_USER_GRAPHQL_ENDPOINT,
  region: import.meta.env.VITE_AWS_DEFAULT_REGION,
  authMode: 'userPool',
})

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: undefined!,
    form: {
      type: undefined,
      id: undefined,
    },
    systemPref: undefined!,
  },
  scrollRestoration: true,
  defaultNotFoundComponent: ErrorPage,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
  interface HistoryState {
    form?: FormType
    item?: FormDataType
    username?: string
    confirmationCode?: string
  }
}

const App = () => {
  const auth = use(AuthContext)
  const [systemPref] = useSystemPref()
  return <RouterProvider router={router} context={{ auth, systemPref }} />
}

const rootElement = document.getElementById('root')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MantineProvider theme={theme} cssVariablesResolver={resolver}>
            <Notifications />
            <ModalProvider>
              <App />
            </ModalProvider>
          </MantineProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
