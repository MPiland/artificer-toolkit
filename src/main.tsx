import './css/theme.css'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { disableReactDevTools } from '@fvilers/disable-react-devtools'
import ThemeProvider from './theme/ThemeProvider'
import { theme } from './css/theme.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Amplify } from 'aws-amplify'
import outputs from '../amplify_outputs.json'

Amplify.configure(outputs)

const queryClient = new QueryClient()

if (import.meta.env.MODE === 'production') disableReactDevTools()

ReactDOM.createRoot(document.getElementById('root') as Element).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
