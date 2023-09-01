import '../scss/modal.scss'
import { useEffect, useCallback } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'

const Modal = ({ children }) => {
  const location = useLocation()
  const navigate = useNavigate()

  const data = location.state.data
  const customFunction = () => location.state.customFunction

  const onEditClicked = () => {
    navigate(
      `${location.state.background.pathname}/edit/${location.state.data.name}`,
      {
        state: { data: data, previous: location },
      }
    )
  }

  // Closes modal when Escape is pressed
  const handleEscKey = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        navigate(`${location.state.background.pathname}`)
      }
    },
    [navigate, location]
  )

  const handleClose = () => {
    navigate(`${location.state.background.pathname}`)
  }

  // Listens for Key to close modal
  useEffect(() => {
    document.addEventListener('keyup', handleEscKey, false)

    return () => {
      document.removeEventListener('keyup', handleEscKey, false)
    }
  }, [handleEscKey])

  const content = (
    // Modal background
    <div
      className='modal d-block bg-body-tertiary bg-opacity-50 py-md-3'
      tabIndex='-1'
      role='dialog'
      id='modal'
      onClick={handleClose}
    >
      <div
        className={`modal-dialog modal-dialog-scrollable ${
          location.state.size && `modal-${location.state.size}`
        } modal-fullscreen-sm-down modal-dialog-centered`}
        role='document'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='modal-content rounded-4 shadow'>
          <div className='modal-header'>
            <h1 className='fw-bold mb-0 fs-2 ms-auto'>
              {location.state.title}
            </h1>
            <button
              type='button'
              className='btn-close'
              aria-label='Close'
              onClick={handleClose}
            ></button>
          </div>
          <div className='modal-body'>
            <Outlet context={{ data, customFunction, handleClose }} />
          </div>
          <div className='modal-footer'>
            {location.state.context === 'itemCard' && (
              <button
                className='btn btn-outline-secondary btn-small'
                onClick={onEditClicked}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return content
}
export default Modal
