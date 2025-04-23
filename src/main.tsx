import { StrictMode, use } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Amplify } from 'aws-amplify'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'
import AuthProvider from './pages/auth/AuthProvider'
import ThemeProvider from './theme/ThemeProvider'
import { AuthContext } from './pages/auth/AuthContext'
import { FormDataType, type FormType } from './types/types'
import ErrorPage from './pages/auth/ErrorPage'
import useSystemPref from './hooks/useSystemPref'

const queryClient = new QueryClient()

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: 'https://uk3olnkzrbepvipuimv4prry2e.appsync-api.us-east-1.amazonaws.com/graphql',
      region: 'us-east-1',
      defaultAuthMode: 'userPool',
    },
  },
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_siXBHaOwk',
      userPoolClientId: '7oa02bpv1vbmadbuvuv9h8lv9e',
      identityPoolId: 'us-east-1:e6dc283e-1bb5-40e9-acf0-f8e4bc6e70d0',
      loginWith: {
        email: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        email: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
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
  const [systemPref] = useSystemPref()
  return <RouterProvider router={router} context={{ auth, systemPref }} />
}

const rootElement = document.getElementById('root')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>
  )
}
