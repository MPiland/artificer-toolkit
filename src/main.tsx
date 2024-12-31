import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { disableReactDevTools } from '@fvilers/disable-react-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Amplify } from 'aws-amplify'
import ThemeContext, { ThemeOptions } from './theme/ThemeContext'

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

const queryClient = new QueryClient()

if (import.meta.env.MODE === 'production') disableReactDevTools()

ReactDOM.createRoot(document.getElementById('root') as Element).render(
  <StrictMode>
    <ThemeContext value={ThemeOptions()}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeContext>
  </StrictMode>
)
