import { use, useState } from 'react'
import Input from '../Input/Input'
import Modal from '../Modal/Modal'
import Button from '../Button/Button'
import { sprinkles } from '../../css/sprinkles.css'
import Group from '../Group/Group'
import Grid from '../Grid/Grid'
import { ModalContext } from '../Modal/ModalContext'

const Delete = () => {
  const { modalProps, hideModal } = use(ModalContext)
  const [deleteState, setDeleteState] = useState<string>('')

  const handleSubmit = () => {
    if (deleteState === 'DELETE') {
      modalProps.onDelete()
      hideModal()
    }
  }

  return (
    <Modal.Dialogue size='xs'>
      <Modal.Header title={`Delete ${modalProps.item.label}`} onClose={hideModal} />
      <Modal.Content>
        <Grid>
          <Grid.Item>
            <p className={sprinkles({ mb: 'space-2' })}>
              {`Type`} <strong>{`DELETE`}</strong> {`and press 'Submit' to confirm`}
            </p>
          </Grid.Item>
          <Grid.Item>
            <Input<{ deleteItem: string }>
              name='deleteItem'
              onChange={{ updateField: ({ value }) => setDeleteState(value) }}
              value={deleteState}
              errorMsg='Must type DELETE exactly'
              id='delete_input'
            />
          </Grid.Item>
        </Grid>
      </Modal.Content>
      <Modal.Footer>
        <Group directionVariant='row' justifyContentVariant='spaceBetween'>
          <Button color='main' type='button' onClick={hideModal}>
            Cancel
          </Button>
          <Button color='danger' type='button' onClick={handleSubmit}>
            Submit
          </Button>
        </Group>
      </Modal.Footer>
    </Modal.Dialogue>
  )
}

export default Delete
