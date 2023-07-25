import { Outlet } from 'react-router-dom'
import DashHeader from './DashHeader'
import Footer from './Footer'

const Member = () => {
  const content = (
    <>
      <DashHeader />
      <div className='main-container flex-grow-1' id='main-container'>
        <Outlet />
      </div>
      <Footer />
    </>
  )
  return content
}

export default Member
