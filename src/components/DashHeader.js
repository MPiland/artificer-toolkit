import { NavLink, useNavigate } from 'react-router-dom'
import { useSendLogoutMutation } from '../features/auth/authApiSlice'
import usePersist from '../hooks/usePersist'

const DashHeader = () => {
  const navigate = useNavigate()

  const [sendLogout] = useSendLogoutMutation()
  const [persist, setPersist] = usePersist()

  const onLogoutClick = async () => {
    setPersist(false)
    navigate('/')
    sendLogout()
  }

  const content = (
    <nav className='navbar navbar-expand-lg bg-body-tertiary sticky-top'>
      <div className='container-fluid'>
        <NavLink className='navbar-brand' to='/characters'>
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
              Offcanvas
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
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link' to='characters'>
                  Characters
                </NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link'>Classes</NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link' to='races'>
                  Races
                </NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link' to='spells'>
                  Spells
                </NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link' to='items'>
                  Items
                </NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link'>Backgrounds</NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link' to='features'>Features</NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link'>Monsters</NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink className='nav-link'>Campaigns</NavLink>
              </li>
              <li data-bs-dismiss='offcanvas'>
                <NavLink onClick={onLogoutClick} className='nav-link'>
                  Logout
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
export default DashHeader
