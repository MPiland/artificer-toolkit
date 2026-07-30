import { Button, Text } from '@mantine/core'
import * as panelStyles from './panel.css'
import * as rowStyles from './rows.css'
import * as featureUseStyles from './featureUse.css'

export function CharacterSheetFeatureUseControl({
  cost,
  disabled,
  label,
  maximum,
  onUse,
  remaining
}: {
  cost: number
  disabled: boolean
  label: string
  maximum: number
  onUse: () => void
  remaining: number
}) {
  return (
    <div className={featureUseStyles.control}>
      <Text className={panelStyles.muted}>
        {cost} {cost === 1 ? 'charge' : 'charges'} · {remaining} / {maximum}
      </Text>
      <Button
        aria-label={`Use ${label}`}
        className={rowStyles.compactActionControl}
        disabled={disabled}
        size='compact-xs'
        variant='default'
        onClick={onUse}
      >
        Use
      </Button>
    </div>
  )
}
