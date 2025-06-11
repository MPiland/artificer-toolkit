import { use, useState } from 'react'
import Input from '@/components/Input'
import { Button } from '@mantine/core'
import { sprinkles } from '@/css/sprinkles.css'
import Modal, { ModalContext, type DeleteModalProps } from '@/components/Modal'
import { Group, Grid } from '@mantine/core'

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
            <Input<{ deleteItem: string }>
              name='deleteItem'
              onChange={{ updateField: ({ value }) => setDeleteState(value) }}
              value={deleteState}
              errorMsg='Must type DELETE exactly'
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
