import { Outlet } from 'react-router-dom'

const Layout = () => {
  const content = (
    <div className='layout-container'>
      <Outlet />
    </div>
  )

  return content
}
export default Layout
