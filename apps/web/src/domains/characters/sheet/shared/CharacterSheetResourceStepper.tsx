import { Button, Text } from '@mantine/core'
import * as rowStyles from './rows.css'

export function CharacterSheetResourceStepper({
  decreaseLabel,
  decreaseDisabled,
  increaseLabel,
  increaseDisabled,
  label,
  maximum,
  onDecrease,
  onIncrease,
  remaining
}: {
  decreaseLabel: string
  decreaseDisabled?: boolean
  increaseLabel: string
  increaseDisabled?: boolean
  label: string
  maximum: number
  onDecrease: () => void
  onIncrease: () => void
  remaining: number
}) {
  return (
    <div
      aria-label={`${label}, ${remaining} of ${maximum} uses remaining`}
      className={rowStyles.resourceStepper}
      role='group'
    >
      <Button
        aria-label={decreaseLabel}
        className={rowStyles.resourceStepButton}
        disabled={decreaseDisabled || remaining <= 0}
        size='compact-xs'
        variant='default'
        onClick={onDecrease}
      >
        −
      </Button>
      <Text aria-live='polite' className={rowStyles.resourceStepValue} component='output'>
        {remaining} / {maximum}
      </Text>
      <Button
        aria-label={increaseLabel}
        className={rowStyles.resourceStepButton}
        disabled={increaseDisabled || remaining >= maximum}
        size='compact-xs'
        variant='default'
        onClick={onIncrease}
      >
        +
      </Button>
    </div>
  )
}
