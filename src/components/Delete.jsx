import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Input from './Input'
import { useDispatch } from 'react-redux'
import { confirmDelete } from '../app/deleteSlice'

const Delete = () => {
  const [deleteState, setDeleteState] = useState('')
  const [className, setClassName] = useState('')

  const dispatch = useDispatch()

  const { data, handleClose } = useOutletContext()

  const onSubmit = () => {
    if (deleteState === 'DELETE') {
      dispatch(confirmDelete({ status: true, data: data }))
      handleClose()
    } else {
      setClassName('is-invalid')
    }
  }

  const handleChange = ({ payload }) => {
    setDeleteState(payload.target.value)
    setClassName('')
  }

  const content = (
    <>
      <div className='modal-header delete'>
        <h4 className='fw-bold mb-0 ms-auto'>{data.value}</h4>
        <button
          type='button'
          className='btn-close'
          aria-label='Close'
          onClick={handleClose}
        />
      </div>
      <div className='modal-body detail-card'>
        <div className='text-center pb-3'>
          <p>
            Type <strong>DELETE</strong> and press 'Submit' to confirm
          </p>
          <div className='d-flex'>
            <Input
              name='deleteItem'
              className={className ?? ''}
              onChange={handleChange}
              value={deleteState}
              validation='del'
              invalidText='Must type DELETE exactly'
            />
            <button
              className='btn btn-danger col-3 ms-2'
              type='button'
              onClick={onSubmit}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </>
  )
  return content
}

export default Delete
