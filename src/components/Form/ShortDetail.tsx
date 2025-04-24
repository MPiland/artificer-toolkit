import Button from '@/components/Button'
import Modal from '@/components/Modal'
import ScrollArea from '../ScrollArea/ScrollArea'
import { startCase } from 'lodash'
import { ReactNode } from 'react'
import { Race, Class } from '@/types'
import Grid from '@/components/Grid'

const ShortDetail = ({
  children,
  context,
  label,
  onClose,
  onSelect,
}: {
  children: ReactNode
  context: 'race' | 'class'
  label: Race['label'] | Class['label']
  onClose: () => void
  onSelect: () => void
}) => {
  const handleSelect = () => {
    onSelect()
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <Modal.Dialogue>
        <Modal.Header title={label} onClose={onClose} />
        <Modal.Content>
          <ScrollArea>
            <Grid>{children}</Grid>
          </ScrollArea>
        </Modal.Content>
        <Modal.Footer>
          <Button color='primary' onClick={handleSelect}>{`Select ${startCase(context)}`}</Button>
        </Modal.Footer>
      </Modal.Dialogue>
    </Modal>
  )
}

export default ShortDetail
