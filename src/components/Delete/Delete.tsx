import { useState } from 'react'
import Input from '../Input/Input'
import { useDispatch } from 'react-redux'
import { confirmDelete } from '../../app/deleteSlice'
import { useLocation } from 'react-router-dom'
import Modal from '../Modal/Modal'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import { useNavigate } from 'react-router-dom'

const Delete = () => {
  const [deleteState, setDeleteState] = useState<string>('')
  const [errorState, setErrorState] = useState<boolean>(false)

  const navigate = useNavigate()
  const dispatch = useDispatch()
  const location = useLocation()

  const onSubmit = () => {
    if (deleteState === 'DELETE') {
      dispatch(confirmDelete({ status: true, data: location.state.data }))
      navigate(-1)
    } else {
      setErrorState(true)
    }
  }

  const handleChange = ({ target }: any) => {
    setErrorState(false)
    setDeleteState(target.value)
  }

  const content = (
    <>
      <Modal.Header title={`Delete ${location.state.title}`} />
      <Modal.Body>
        <p className={sprinkles({ mb: 'size-2' })}>
          {`Type`} <strong>{`DELETE`}</strong> {`and press 'Submit' to confirm`}
        </p>
        <Input
          name='deleteItem'
          error={errorState}
          onChange={handleChange}
          value={deleteState}
          errorMsg='Must type DELETE exactly'
        />
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant='danger'
          type='button'
          onClick={onSubmit}
          className={sprinkles({ justifySelf: 'flex-end' })}
        >
          Submit
        </Button>
      </Modal.Footer>
    </>
  )
  return content
}

export default Delete
