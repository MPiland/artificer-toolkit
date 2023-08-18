import { Outlet } from 'react-router-dom'
import DashHeader from './DashHeader'
import Footer from './Footer'

const Member = () => {
  const content = (
    <>
      <DashHeader />
      <Outlet />
      <Footer />
    </>
  )
  return content
}

export default Member
