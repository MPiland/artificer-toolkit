import './scss/styles.scss'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@fortawesome/react-fontawesome'
import '@fortawesome/fontawesome-svg-core'
import {StrictMode} from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { store } from './app/store'
import { Provider } from 'react-redux'
import { disableReactDevTools } from '@fvilers/disable-react-devtools'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { DndProvider } from 'react-dnd-multi-backend'
import { HTML5toTouch } from 'rdndmb-html5-to-touch'

if (import.meta.env.MODE === 'production') disableReactDevTools()

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_REACT_APP_GOOGLE_CLIENT_ID}>
      <Provider store={store}>
        <DndProvider options={HTML5toTouch}>
          <BrowserRouter>
            <Routes>
              <Route path='/*' element={<App />} />
            </Routes>
          </BrowserRouter>
        </DndProvider>
      </Provider>
    </GoogleOAuthProvider>
  </StrictMode>
)
