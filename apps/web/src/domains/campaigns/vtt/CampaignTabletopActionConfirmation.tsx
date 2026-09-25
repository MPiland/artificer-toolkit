import { Alert, Button, Group, Stack } from '@mantine/core'
import type { ReactNode } from 'react'

/** The action drawer's one confirm step: stowing a shield, or "Do it anyway" for rule warnings. */
export function CampaignTabletopActionConfirmation({
  title,
  children,
  confirmLabel,
  confirmIsPrimary,
  disabled,
  onConfirm,
  onCancel
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  /** Rule overrides make Cancel the primary choice; an expected confirmation keeps it on confirm. */
  confirmIsPrimary: boolean
  disabled: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Alert color='yellow' title={title}>
      <Stack gap='sm'>
        {children}
        <Group>
          <Button
            disabled={disabled}
            variant={confirmIsPrimary ? 'filled' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <Button variant={confirmIsPrimary ? 'default' : 'filled'} onClick={onCancel}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Alert>
  )
}
