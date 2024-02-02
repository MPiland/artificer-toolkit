import './css/global.css'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { store } from './app/store'
import { Provider } from 'react-redux'
import { disableReactDevTools } from '@fvilers/disable-react-devtools'
import { GoogleOAuthProvider } from '@react-oauth/google'

if (import.meta.env.MODE === 'production') disableReactDevTools()

const root = ReactDOM.createRoot(document.getElementById('root') as Element)
root.render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <GoogleOAuthProvider
          clientId={import.meta.env.VITE_REACT_APP_GOOGLE_CLIENT_ID}
        >
            <Routes>
              <Route path='/*' element={<App />} />
            </Routes>
        </GoogleOAuthProvider>
      </BrowserRouter>
    </Provider>
  </StrictMode>
)
