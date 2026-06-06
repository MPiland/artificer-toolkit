import { Select } from '@mantine/core'
import type { ScalingModelFieldsProps } from './ScalingModelFields.types'
import * as styles from './ScalingModelFields.css'

export function ScalingModelFields({
  defaultScalingKind = 'Per Level',
  defaultScalingSource = 'Spell Cast Level',
  defaultValueKind = 'Dice',
  scalingKinds = ['None', 'Per Level'],
  scalingSources = ['Character Level', 'Class Level', 'Parent Class Level', 'Spell Cast Level'],
  valueKinds = ['Dice', 'Fixed Amount', 'Pool']
}: ScalingModelFieldsProps) {
  return (
    <div className={styles.fieldGrid}>
      <Select
        classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
        data={[...valueKinds]}
        defaultValue={defaultValueKind}
        label='Damage Value Kind'
      />
      <Select
        classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
        data={[...scalingKinds]}
        defaultValue={defaultScalingKind}
        label='Scaling Kind'
      />
      <Select
        classNames={{ input: styles.fieldInput, label: styles.fieldLabel }}
        data={[...scalingSources]}
        defaultValue={defaultScalingSource}
        label='Scaling Source'
      />
    </div>
  )
}
