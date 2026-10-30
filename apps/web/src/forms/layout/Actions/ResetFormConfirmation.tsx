import { Button, Drawer, Modal } from '@mantine/core'
import * as styles from './Actions.css'
import { useAuthoringLayout } from '../AuthoringLayoutContext'
import { useAuthoringActions } from '../AuthoringFormContext'
import { useCallback } from 'react'
import { useBreakpoints } from '#ui'

export function ResetFormConfirmation() {
  const { resetFormConfirmOpen, toggleResetFormConfirm } = useAuthoringLayout()
  const { isMobile } = useBreakpoints()
  const { resetForm } = useAuthoringActions()

  const handleConfirmResetForm = useCallback(() => {
    toggleResetFormConfirm()
    void resetForm()
  }, [resetForm])

  const content = (
    <>
      <p className={styles.confirmationText}>
        This clears every changed field in this form and returns it to the last loaded values.
      </p>
      <div className={styles.confirmationActions}>
        <Button type='button' variant='default' onClick={toggleResetFormConfirm}>
          Cancel
        </Button>
        <Button type='button' color='red' onClick={handleConfirmResetForm}>
          Reset form
        </Button>
      </div>
    </>
  )

  return isMobile ? (
    <Drawer
      opened={resetFormConfirmOpen}
      onClose={toggleResetFormConfirm}
      position='bottom'
      title='Reset form?'
      withinPortal
    >
      {content}
    </Drawer>
  ) : (
    <Modal
      centered
      opened={resetFormConfirmOpen}
      onClose={toggleResetFormConfirm}
      title='Reset form?'
      withinPortal
    >
      {content}
    </Modal>
  )
}
