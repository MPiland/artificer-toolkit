import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@fortawesome/react-fontawesome'
import '@fortawesome/fontawesome-svg-core'
import './css/index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { store } from './app/store'
import { Provider } from 'react-redux'
import { disableReactDevTools } from '@fvilers/disable-react-devtools'
import { GoogleOAuthProvider } from '@react-oauth/google'

if (process.env.NODE_ENV === 'production') disableReactDevTools()

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <Provider store={store}>
        <BrowserRouter>
          <Routes>
            <Route path='/*' element={<App />} />
          </Routes>
        </BrowserRouter>
      </Provider>
    </GoogleOAuthProvider>
  </React.StrictMode>
)