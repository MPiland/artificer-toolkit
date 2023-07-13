import { useEffect, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const Modal = () => {
  const location = useLocation()

  const navigate = useNavigate()
  // Closes modal when Escape is pressed
  const handleEscKey = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        navigate(-1)
      }
    },
    [navigate]
  )

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
      className='modal d-block bg-body-tertiary bg-opacity-50 py-md-5'
      tabIndex='-1'
      role='dialog'
      id='modal'
      onClick={() => navigate(-1)}
    >
      <div // Modal body
        className='modal-dialog modal-fullscreen-sm-down modal-dialog-centered'
        role='document'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='modal-content rounded-4 shadow'>
          <div className='modal-header p-5 pb-4 border-bottom-0'>
            <h1 className='fw-bold mb-0 fs-2 ms-auto'>
              {location.state.context}
            </h1>
            <button
              type='button'
              className='btn-close'
              aria-label='Close'
              onClick={() => navigate(-1)}
            ></button>
          </div>
          <div className='modal-body p-5 pt-0'>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )

  return content
}
export default Modal
