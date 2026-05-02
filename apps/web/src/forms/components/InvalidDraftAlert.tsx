import { Alert, Button, Group, Text } from '@mantine/core'

export interface InvalidDraftAlertProps {
  domainLabel: string
  isDiscarding?: boolean
  onDiscard: () => void
}

export function InvalidDraftAlert({
  domainLabel,
  isDiscarding = false,
  onDiscard
}: InvalidDraftAlertProps) {
  return (
    <Alert color='yellow' title='Draft could not be loaded'>
      <Text size='sm'>
        {`This saved ${domainLabel} draft no longer matches the current editor shape. The active version is still safe.
        Discard the stale draft to continue editing from the active version.`}
      </Text>
      <Group mt='sm'>
        <Button
          loading={isDiscarding}
          type='button'
          variant='default'
          onClick={onDiscard}
        >
          Discard stale draft
        </Button>
      </Group>
    </Alert>
  )
}
