import { Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Member from './Member'
import Public from './Public'

const Layout = () => {
  const { id } = useAuth()
  const Wrapper = id ? Member : Public
  const content = (
    <Wrapper>
      <Outlet />
    </Wrapper>
  )

  return content
}
export default Layout
