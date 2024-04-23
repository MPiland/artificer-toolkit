import { useState } from 'react'
import Input from '../Input/Input'
import { useLocation } from 'react-router-dom'
import Modal from '../Modal/Modal'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import { useNavigate } from 'react-router-dom'
import Group from '../Group/Group'

const Delete = () => {
  const [deleteState, setDeleteState] = useState<string>('')

  const navigate = useNavigate()
  const location = useLocation()

  const input = document.getElementById('delete_input') as HTMLInputElement

  console.log({ deleteLocation: location })

  const handleSubmit = () => {
    if (deleteState === 'DELETE') {
      navigate(`${location.state.background.pathname}`, {
        state: {
          delete: true,
          item: location.state.item,
        },
      })
    } else {
      input.classList.add('invalid')
      input.dispatchEvent(
        new CustomEvent('setErrorState', {
          detail: true,
        })
      )
    }
  }

  const handleChange = ({ target }: any) => {
    setDeleteState(target.value)
  }

  const handleCancel = () => {
    navigate(-1)
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
          onChange={handleChange}
          value={deleteState}
          errorMsg='Must type DELETE exactly'
          id='delete_input'
        />
      </Modal.Body>
      <Modal.Footer>
        <Group directionVariant='row' justifyContentVariant='spaceBetween'>
          <Button variant='default' type='button' onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant='danger' type='button' onClick={handleSubmit}>
            Submit
          </Button>
        </Group>
      </Modal.Footer>
    </>
  )
  return content
}

export default Delete
