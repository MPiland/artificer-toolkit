import { useEffect, useCallback, cloneElement, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const Modal = ({ child }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const setRef = useRef()

  const onEditClicked = () => {
    navigate(`/spells/edit/${location.state.data.name}`, {
      state: { data: location.state.data, previous: location },
    })
  }

  const clonedElement = cloneElement(child, {
    state: location.state.data,
    ref: setRef,
  })

  // Closes modal when Escape is pressed
  const handleEscKey = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        navigate(`${location.state.background.pathname}`)
      }
    },
    [navigate, location]
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
      className='modal d-block bg-body-tertiary bg-opacity-50 py-md-3'
      tabIndex='-1'
      role='dialog'
      id='modal'
      onClick={() => navigate(`${location.state.background.pathname}`)}
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
              {location.state.context}
            </h1>
            <button
              type='button'
              className='btn-close'
              aria-label='Close'
              onClick={() => navigate(`${location.state.background.pathname}`)}
            ></button>
          </div>
          <div className='modal-body'>{clonedElement}</div>
          <div className='modal-footer'>
            <button
              className='btn btn-outline-secondary btn-small'
              onClick={onEditClicked}
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return content
}
export default Modal
