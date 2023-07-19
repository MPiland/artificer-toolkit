import { Outlet } from 'react-router-dom'

const Layout = () => {
  const content = (
    <div className='totalView'>
      <Outlet />
    </div>
  )

  return content
}
export default Layout
