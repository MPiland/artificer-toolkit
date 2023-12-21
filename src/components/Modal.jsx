import { useEffect, useCallback, memo } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'

const Modal = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const data = location.state.data

  // Closes modal when Escape is pressed
  const handleEscKey = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        navigate(`${location.state.background.pathname}`, {
          state: location.state,
        })
      }
    },
    [navigate, location]
  )

  const handleClose = () => {
    navigate(`${location.state.background.pathname}`, {
      state: location.state,
    })
  }

  // Listens for Key to close modal
  useEffect(() => {
    document.addEventListener('keyup', handleEscKey)

    return () => document.removeEventListener('keyup', handleEscKey)
  }, [handleEscKey])

  const content = (
    <div
      className='modal d-block bg-body-tertiary bg-opacity-50 py-md-3'
      tabIndex='-1'
      role='dialog'
      id='modal'
      onClick={handleClose}
    >
      <div
        className={`modal-dialog modal-dialog-scrollable ${
          location.state.size ? `modal-${location.state.size}` : ''
        } ${
          location.state.context !== 'delete'
            ? 'modal-fullscreen-sm-down'
            : ''
        }  modal-dialog-centered`}
        role='document'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='modal-content rounded-4 shadow'>
          <Outlet context={{ data, handleClose }} />
        </div>
      </div>
    </div>
  )

  return content
}

const memoizedModal = memo(Modal)

export default memoizedModal
