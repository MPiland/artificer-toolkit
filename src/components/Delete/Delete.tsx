import { use, useState } from 'react'
import { sprinkles } from '@/css/sprinkles.css'
import Modal, { ModalContext, type DeleteModalProps } from '@/components/Modal'
import { Group, Grid, TextInput, Button } from '@mantine/core'

const Delete = () => {
  const { modalProps, hideModal } = use(ModalContext)
  const [deleteState, setDeleteState] = useState<string>('')

  const { label, onDelete } = modalProps as DeleteModalProps

  const handleSubmit = () => {
    if (deleteState === 'DELETE') {
      onDelete()
      hideModal()
    }
  }

  return (
    <Modal.Dialogue size='xs'>
      <Modal.Header title={`Delete ${label}`} onClose={hideModal} />
      <Modal.Content>
        <Grid>
          <Grid.Col>
            <p className={sprinkles({ mb: 'space-2' })}>
              {`Type`} <strong>{`DELETE`}</strong> {`and press 'Submit' to confirm`}
            </p>
          </Grid.Col>
          <Grid.Col>
            <TextInput
              name='deleteItem'
              onChange={(e) => setDeleteState(e.target.value)}
              value={deleteState}
              error={deleteState !== 'DELETE' && 'Must type DELETE exactly'}
              id='delete_input'
            />
          </Grid.Col>
        </Grid>
      </Modal.Content>
      <Modal.Footer>
        <Group justify='space-between' grow>
          <Button color='rgba(97, 97, 97, 1)' onClick={hideModal}>
            Cancel
          </Button>
          <Button color='red' onClick={handleSubmit}>
            Submit
          </Button>
        </Group>
      </Modal.Footer>
    </Modal.Dialogue>
  )
}

export default Delete
