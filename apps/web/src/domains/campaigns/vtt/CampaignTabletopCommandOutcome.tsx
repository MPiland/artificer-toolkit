import { Alert, List, Text } from '@mantine/core'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { CampaignTabletopActionConfirmation } from './CampaignTabletopActionConfirmation'

/** What came of a drawer command: the "Do it anyway" step for rule warnings, then its result. */
export function CampaignTabletopCommandOutcome({
  warnings,
  disabled,
  feedback,
  error,
  onCancel,
  onConfirm
}: {
  /** The rule warnings the command raised, or null when none wait on an override. */
  warnings: EncounterRuleWarningDto[] | null
  disabled: boolean
  feedback: string | null
  error: string | null
  onCancel: () => void
  onConfirm: (warnings: EncounterRuleWarningDto[]) => void
}) {
  return (
    <>
      {warnings ? (
        <CampaignTabletopActionConfirmation
          confirmIsPrimary={false}
          confirmLabel='Do it anyway'
          disabled={disabled}
          title='This breaks a rule'
          onCancel={onCancel}
          onConfirm={() => onConfirm(warnings)}
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
      ) : null}
      {feedback ? (
        <Alert aria-live='polite' color='green'>
          {feedback}
        </Alert>
      ) : null}
      {error ? (
        <Alert aria-live='assertive' color='red'>
          {error}
        </Alert>
      ) : null}
    </>
  )
}
