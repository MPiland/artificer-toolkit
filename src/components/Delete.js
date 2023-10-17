import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Input from './Input'
import { useDispatch } from 'react-redux'
import { confirmDelete } from '../app/deleteSlice'
import { handleValidation } from '../helpers/form'

const Delete = () => {
  const [deleteState, setDeleteState] = useState('')

  const dispatch = useDispatch()

  const { data, handleClose } = useOutletContext()

  const onSubmit = () => {
    const isValid = handleValidation()
    if (isValid) {
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
          name='deleteItem'
          label={true}
          placeholder='Confirm Delete'
          onChange={handleChange}
          value={deleteState}
          validation='del'
          invalidText='Must type DELETE exactly'
          required={true}
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
