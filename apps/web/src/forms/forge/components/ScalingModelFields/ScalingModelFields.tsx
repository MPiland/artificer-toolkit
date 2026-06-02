import { NumberInput, Select } from '@mantine/core'
import type { ScalingModelFieldsProps } from './ScalingModelFields.types'
import * as styles from './ScalingModelFields.css'

export function ScalingModelFields({
  defaultIncrementEvery = 5,
  defaultScalingSource = 'Character level',
  defaultStartsAtLevel = 1,
  defaultValueKind = 'Dice',
  scalingSources = ['Character level', 'Spell slot', 'Class level'],
  valueKinds = ['Dice', 'Flat value', 'Formula']
}: ScalingModelFieldsProps) {
  return (
    <div className={styles.fieldGrid}>
      <Select
        classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
        data={[...valueKinds]}
        defaultValue={defaultValueKind}
        label='Value kind'
      />
      <Select
        classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
        data={[...scalingSources]}
        defaultValue={defaultScalingSource}
        label='Scaling source'
      />
      <NumberInput
        classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
        defaultValue={defaultStartsAtLevel}
        hideControls
        label='Starts at level'
        min={1}
      />
      <NumberInput
        classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
        defaultValue={defaultIncrementEvery}
        hideControls
        label='Increment every'
        min={1}
      />
    </div>
  )
}
