import { Alert, NumberInput, Select } from '@mantine/core'
import type { ChargeUseDto } from '@artificer-toolkit/schema/shared'
import { findOption } from '#forms/utils/valueGuards'
import {
  CHARGE_RESET_OPTIONS,
  createCharge,
  isSimpleCharge,
  type SimpleChargeDto
} from './guidedCharge'
import * as styles from './guidedAuthoring.css'

const RESET_VALUES = CHARGE_RESET_OPTIONS.map((option) => option.value)

/** Limited-uses editor shared by feats and features; advanced charge models are preserved untouched. */
export function GuidedChargeFields({
  charges,
  onChange,
  subject
}: {
  charges: ChargeUseDto | undefined
  onChange: (next: SimpleChargeDto | undefined) => void
  subject: 'feat' | 'feature'
}) {
  return (
    <>
      <Select
        label='Does it have limited uses?'
        data={[
          { value: 'no', label: 'No, use it whenever it applies' },
          { value: 'yes', label: 'Yes, it has a resettable limit' }
        ]}
        allowDeselect={false}
        value={charges ? 'yes' : 'no'}
        onChange={(value) => {
          if (value === 'no' && charges && !isSimpleCharge(charges)) return
          if (value === 'yes' && !charges) onChange(createCharge())
          else if (value === 'no') onChange(undefined)
        }}
      />
      {charges && isSimpleCharge(charges) ? (
        <div className={styles.fields}>
          <NumberInput
            label='Uses'
            min={1}
            max={100}
            value={charges.amount}
            onChange={(value) =>
              onChange({ ...charges, amount: typeof value === 'number' ? value : 1 })
            }
          />
          <Select
            label='Reset timing'
            data={CHARGE_RESET_OPTIONS}
            allowDeselect={false}
            value={charges.resetKind}
            onChange={(value) => {
              const resetKind = findOption(RESET_VALUES, value)
              if (resetKind) onChange({ ...charges, resetKind })
            }}
          />
        </div>
      ) : null}
      {charges && !isSimpleCharge(charges) ? (
        <Alert color='blue' title='Advanced charge model preserved'>
          This {subject} uses a scaling or source-based charge model. Guided keeps it intact; switch
          to Advanced to change or remove it.
        </Alert>
      ) : null}
    </>
  )
}
