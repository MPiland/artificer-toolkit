import { SegmentedControl, Text } from '@mantine/core'
import type {
  CharacterSheetRollDestination as RollDestination,
  CharacterSheetRollDestinationOption
} from './dice.types'
import * as diceStyles from './dice.css'

export function CharacterSheetRollDestination({
  options,
  value,
  onChange
}: {
  options: readonly CharacterSheetRollDestinationOption[]
  value: RollDestination
  onChange: (destination: RollDestination) => void
}) {
  if (!options.length) return null
  return (
    <div className={diceStyles.manualDestination}>
      <Text fw={600} size='sm'>
        Roll to
      </Text>
      <SegmentedControl
        aria-label='Roll destination'
        data={[...options]}
        size='xs'
        value={value}
        onChange={(next) =>
          onChange(options.find((option) => option.value === next)?.value ?? value)
        }
      />
    </div>
  )
}
