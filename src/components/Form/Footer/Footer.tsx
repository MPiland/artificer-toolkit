import { base } from './Footer.css'
import { Button } from '@mantine/core'
import { UseMutationResult } from '@tanstack/react-query'
import { sprinkles } from '@/css/sprinkles.css'
import type {
  FormDataType,
  SourceDataType,
} from '@/types'
import { useFooterLogic } from '@/hooks'
import { Group } from '@mantine/core'

interface FooterProps<T extends SourceDataType, V extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, V, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, V, unknown>
}

const Footer = <T extends SourceDataType, V extends FormDataType>({
  useAddNewItemMutation,
  useUpdateItemMutation,
}: FooterProps<T, V>) => {
  const { state, handlers } = useFooterLogic({
    useAddNewItemMutation,
    useUpdateItemMutation,
  })

  const { isLastStep, forwardLabel, backLabel, featureStep } = state
  const { handleForward, handleBack, handleUpdate, handleReset } = handlers

  return (
    <Group className={base} justify='space-between'>
      <Group>
        <Button color='red' type='button' onClick={handleBack} className={sprinkles({ marginRight: 'space-2' })}>
          {backLabel}
        </Button>
        <Button color='yellow' type='button' onClick={handleReset}>
          Reset
        </Button>
      </Group>
      <Group>
        {(!isLastStep || (isLastStep && featureStep)) && (
          <Button color='green' type='button' onClick={handleUpdate} className={sprinkles({ marginRight: 'space-2' })}>
            Update
          </Button>
        )}
        <Button
          color={forwardLabel === 'Update' ? 'green' : 'primary'}
          type='button'
          onClick={() => (isLastStep && featureStep == null ? handleUpdate() : handleForward())}
        >
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default Footer
