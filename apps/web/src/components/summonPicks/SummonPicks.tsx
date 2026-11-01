import { NumberInput, SegmentedControl, Select } from '@mantine/core'
import type { SummonPickOptionsDto } from '@artificer-toolkit/schema/api/summonPickOptions'

/** The form a summon conjures and the Creature Type it takes, for a summon that offers them. */
export function SummonPicks({
  options,
  formId,
  creatureTypeId,
  count,
  disabled,
  onFormChange,
  onCountChange,
  onCreatureTypeChange
}: {
  options: SummonPickOptionsDto
  formId?: string
  creatureTypeId?: string
  count?: number
  disabled: boolean
  onFormChange: (formId: string | null) => void
  onCountChange: (count: number) => void
  onCreatureTypeChange: (creatureTypeId: string) => void
}) {
  return (
    <>
      {options.summonForms ? (
        <Select
          aria-label='Summon form'
          allowDeselect={false}
          data={options.summonForms.map((form) => ({ label: form.label, value: form.id }))}
          disabled={disabled}
          searchable
          value={formId ?? null}
          onChange={onFormChange}
        />
      ) : null}
      {count !== undefined ? (
        <NumberInput
          allowDecimal={false}
          aria-label='Creature count'
          disabled={disabled}
          max={options.summonForms?.find((form) => form.id === formId)?.maxCount}
          min={1}
          value={count}
          onChange={(value) => onCountChange(Number(value))}
        />
      ) : null}
      {options.creatureTypes ? (
        <SegmentedControl
          aria-label='Creature type'
          data={options.creatureTypes.map((type) => ({ label: type.label, value: type.id }))}
          disabled={disabled}
          fullWidth
          value={creatureTypeId}
          onChange={onCreatureTypeChange}
        />
      ) : null}
    </>
  )
}
