import './css/theme.css'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { disableReactDevTools } from '@fvilers/disable-react-devtools'
import { GoogleOAuthProvider } from '@react-oauth/google'
import ThemeProvider from './theme/ThemeProvider'
import { theme } from './css/theme.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

if (import.meta.env.MODE === 'production') disableReactDevTools()

ReactDOM.createRoot(document.getElementById('root') as Element).render(
  <StrictMode>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_REACT_APP_GOOGLE_CLIENT_ID}>
        <ThemeProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
  </StrictMode>
)
