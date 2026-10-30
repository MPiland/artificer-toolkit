import { SegmentedControl, Select } from '@mantine/core'
import type { SummonPointTarget } from './summonPicks.model'

/** The form a summon conjures and the Creature Type it takes, for a summon that offers them. */
export function CampaignTabletopSummonPicks({
  target,
  formId,
  creatureTypeId,
  disabled,
  onFormChange,
  onCreatureTypeChange
}: {
  target: SummonPointTarget
  formId?: string
  creatureTypeId?: string
  disabled: boolean
  onFormChange: (formId: string | null) => void
  onCreatureTypeChange: (creatureTypeId: string) => void
}) {
  return (
    <>
      {target.summonForms ? (
        <Select
          aria-label='Summon form'
          allowDeselect={false}
          data={target.summonForms.map((form) => ({ label: form.label, value: form.id }))}
          disabled={disabled}
          searchable
          value={formId ?? null}
          onChange={onFormChange}
        />
      ) : null}
      {target.creatureTypes ? (
        <SegmentedControl
          aria-label='Creature type'
          data={target.creatureTypes.map((type) => ({ label: type.label, value: type.id }))}
          disabled={disabled}
          fullWidth
          value={creatureTypeId}
          onChange={onCreatureTypeChange}
        />
      ) : null}
    </>
  )
}
