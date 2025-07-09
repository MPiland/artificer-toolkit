import { use } from 'react'
import { AuthContext } from '@/pages/auth/AuthContext'
import { useSystemPref } from '@/hooks'
import { RouterProvider, type AnyRouter } from '@tanstack/react-router'

const App = ({ router }: { router: AnyRouter }) => {
  const auth = use(AuthContext)
  const [systemPref] = useSystemPref()
  return <RouterProvider router={router} context={{ auth, systemPref }} />
}

export default App
