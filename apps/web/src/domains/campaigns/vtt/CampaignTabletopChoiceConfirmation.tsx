import { Radio, Stack } from '@mantine/core'
import type { ReactNode } from 'react'

import { CampaignTabletopActionConfirmation } from './CampaignTabletopActionConfirmation'

/** A confirm step that first asks the player to pick one of several options. */
export function CampaignTabletopChoiceConfirmation({
  title,
  groupLabel,
  confirmLabel,
  options,
  value,
  disabled,
  onChange,
  onConfirm,
  onCancel,
  children
}: {
  title: string
  groupLabel: string
  confirmLabel: string
  options: readonly { value: string; label: string }[]
  value: string | null
  disabled: boolean
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}) {
  return (
    <CampaignTabletopActionConfirmation
      confirmIsPrimary
      confirmLabel={confirmLabel}
      disabled={disabled || value === null}
      title={title}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <Radio.Group label={groupLabel} value={value} onChange={onChange}>
        <Stack gap='xs' mt='xs'>
          {options.map((option) => (
            <Radio key={option.value} label={option.label} value={option.value} />
          ))}
        </Stack>
      </Radio.Group>
      {children}
    </CampaignTabletopActionConfirmation>
  )
}
