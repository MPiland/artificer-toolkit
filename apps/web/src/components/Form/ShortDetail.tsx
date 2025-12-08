import { Button } from '@mantine/core'
import Modal from '~components/Modal'
import { startCase } from 'lodash-es'
import { ReactNode } from 'react'
import { Grid, ScrollArea } from '@mantine/core'

const ShortDetail = ({
  children,
  context,
  onClose,
  onSelect,
}: {
  children: ReactNode
  context: 'race' | 'class'
  onClose: () => void
  onSelect: () => void
}) => {
  const handleSelect = () => {
    onSelect()
    onClose()
  }

  return (
    <Modal
      props={{
        footer: {
          children: <Button onClick={handleSelect}>{`Select ${startCase(context)}`}</Button>,
        },
      }}
    >
      <ScrollArea>
        <Grid>{children}</Grid>
      </ScrollArea>
    </Modal>
  )
}

export default ShortDetail
