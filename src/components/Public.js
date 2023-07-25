import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

const Public = () => {
  const content = (
    <>
      <Header />
      <div className='main-container flex-grow-1' id='main-container'>
        <Outlet />
      </div>
      <Footer />
    </>
  )
  return content
}

export default Public
