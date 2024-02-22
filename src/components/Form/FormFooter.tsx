import { FC } from 'react'
import { form_footer } from './Form.css'
import Group from '../Group/Group'
import Button from '../Button/Button'

interface FormFooterProps {
  handleBack: () => void
  backLabel: string
  handleForward: () => void
  forwardLabel: string
  handleReset?: () => void
  handleUpdate?: () => void
}

const FormFooter: FC<FormFooterProps> = ({
  handleBack,
  backLabel,
  handleForward,
  forwardLabel,
  handleReset,
  handleUpdate,
}) => {
  return (
    <Group className={form_footer} justifyContentVariant={'spaceBetween'}>
      <Group>
        <Button variant='default' type='button' onClick={handleBack}>
          {backLabel}
        </Button>
        {handleReset && (
          <Button variant='warning' type='button' onClick={handleReset}>
            Reset
          </Button>
        )}
      </Group>
      <Group>
        {handleUpdate && (
          <Button variant='update' type='button' onClick={handleUpdate}>
            Update
          </Button>
        )}
        <Button variant='primary' type='button' onClick={handleForward}>
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default FormFooter
