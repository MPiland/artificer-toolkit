import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Input from './Input'
import { useDispatch } from 'react-redux'
import { confirmDelete } from '../app/deleteSlice'

const Delete = () => {
  const inputRef = useRef()
  const [deleteState, setDeleteState] = useState('')

  const dispatch = useDispatch()

  const { data, handleClose } = useOutletContext()

  const onSubmit = () => {
    const isValid = inputRef.current.getValidation()
    if (!isValid) {
      inputRef.current.setClass('is-invalid')
    } else if (isValid) {
      inputRef.current.setClass('is-valid')
      dispatch(confirmDelete({ status: true, data: data }))
      handleClose()
    }
  }

  const handleChange = ({ payload }) => {
    setDeleteState(payload.target.value)
  }

  const content = (
    <div className='text-center pb-3'>
      <p>Are you sure you want to delete {data.value}?</p>
      <p>
        Type <strong>DELETE</strong> and press 'Submit' to confirm
      </p>
      <div className='row g-1'>
        <Input
          ref={inputRef}
          name='deleteItem'
          label={true}
          placeholder='Confirm Delete'
          onChange={handleChange}
          value={deleteState}
          validation='delete'
          invalidText='Must type DELETE exactly'
        />
        <button
          className='btn btn-danger col-2 ms-2'
          type='button'
          onClick={onSubmit}
        >
          Submit
        </button>
      </div>
    </div>
  )
  return content
}

export default Delete
