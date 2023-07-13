import { NavLink, useLocation } from 'react-router-dom'

const Header = () => {
  const location = useLocation()

  const content = (
    <nav className='navbar navbar-expand-md bg-body-tertiary sticky-top'>
      <div className='container-fluid'>
        <NavLink className='navbar-brand' to='/'>
          Artificer's Toolkit
        </NavLink>
        <button
          className='navbar-toggler'
          type='button'
          data-bs-toggle='offcanvas'
          data-bs-target='#offcanvasNavbar'
          aria-controls='offcanvasNavbar'
          aria-label='Toggle navigation'
        >
          <span className='navbar-toggler-icon'></span>
        </button>
        <div
          className='offcanvas offcanvas-end'
          tabIndex='-1'
          id='offcanvasNavbar'
          aria-labelledby='offcanvasNavbarLabel'
        >
          <div className='offcanvas-header'>
            <h5 className='offcanvas-title' id='offcanvasNavbarLabel'>
              Menu
            </h5>
            <button
              type='button'
              className='btn-close'
              data-bs-dismiss='offcanvas'
              aria-label='Close'
            ></button>
          </div>
          <div className='offcanvas-body'>
            <ul className='navbar-nav justify-content-end flex-grow-1 pe-3'>
              <li data-bs-dismiss='offcanvas' className='nav-item'>
                <NavLink className='nav-link'>Media</NavLink>
              </li>
              <li data-bs-dismiss='offcanvas' className='nav-item'>
                <NavLink className='nav-link'>Pricing</NavLink>
              </li>
              <li data-bs-dismiss='offcanvas' className='nav-item'>
                <NavLink className='nav-link'>About</NavLink>
              </li>
              <li data-bs-dismiss='offcanvas' className='nav-item'>
                <NavLink
                  className='nav-link'
                  to='/register'
                  state={{ background: location, context: 'Register' }}
                >
                  Register
                </NavLink>
              </li>
              <li data-bs-dismiss='offcanvas' className='nav-item'>
                <NavLink
                  className='nav-link'
                  to='/login'
                  state={{ background: location, context: 'Login' }}
                >
                  Login
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  )

  return content
}
export default Header
