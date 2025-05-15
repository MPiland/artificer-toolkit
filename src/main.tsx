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
import { resolver, theme } from './css/theme'
import { Amplify } from 'aws-amplify'

const queryClient = new QueryClient()

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_AWS_GRAPHQL_ENDPOINT || process.env.AWS_GRAPHQL_ENDPOINT!,
      region: import.meta.env.VITE_AWS_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION!,
      defaultAuthMode: 'userPool',
    },
  },
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
  console.log({ auth })
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
            <App />
          </MantineProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
