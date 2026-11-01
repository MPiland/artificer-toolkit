import { List, Text } from '@mantine/core'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'

import { CampaignTabletopActionConfirmation } from './CampaignTabletopActionConfirmation'

/** "Do it anyway" for the overridable rule warnings the server raised for this selection. */
export function CampaignTabletopRuleWarningsConfirmation({
  warnings,
  disabled,
  onConfirm,
  onCancel
}: {
  warnings: readonly EncounterRuleWarningDto[]
  disabled: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <CampaignTabletopActionConfirmation
      confirmIsPrimary={false}
      confirmLabel='Do it anyway'
      disabled={disabled}
      title='This breaks a rule'
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <List size='sm'>
        {warnings.map((warning) => (
          <List.Item key={warning.code}>{warning.message}</List.Item>
        ))}
      </List>
      <Text c='dimmed' size='xs'>
        The GM sees every override in the Encounter history.
      </Text>
    </CampaignTabletopActionConfirmation>
  )
}
