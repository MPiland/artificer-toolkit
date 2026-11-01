import { MultiSelect, NumberInput, Select } from '@mantine/core'
import type {
  EncounterActionChoiceDto,
  EncounterOptionalActionChoicesDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { CastModifierChoice } from './useCastModifierChoice'

/** One select per field the chosen optional rule asks the user to fill. */
export function CampaignTabletopOptionalChoiceFields({
  fields,
  values,
  disabled,
  onChange
}: {
  fields: EncounterOptionalActionChoicesDto['fields']
  values: Record<string, string>
  disabled: boolean
  onChange: (values: Record<string, string>) => void
}) {
  return fields.map((field) => (
    <Select
      comboboxProps={{ withinPortal: false }}
      data={field.options.map((option) => ({ label: option.label, value: option.id }))}
      disabled={disabled}
      key={field.fieldId}
      label={field.label}
      searchable
      value={values[field.fieldId] ?? null}
      onChange={(value) =>
        onChange(
          value === null
            ? Object.fromEntries(Object.entries(values).filter(([id]) => id !== field.fieldId))
            : { ...values, [field.fieldId]: value }
        )
      }
    />
  ))
}

/** The cost the caster may pay on this cast and, when it shapes who the cast affects, the creatures it names. */
export function CampaignTabletopCastModifierInput({
  cast,
  actors,
  disabled
}: {
  cast: CastModifierChoice
  actors: { id: string; label: string }[]
  disabled: boolean
}) {
  return (
    <>
      <Select
        clearable
        comboboxProps={{ withinPortal: false }}
        data={cast.modifiers.map((modifier) => ({
          label: `${modifier.label} (costs ${modifier.cost})`,
          value: modifier.id
        }))}
        disabled={disabled}
        label='Pay a cost'
        placeholder='None'
        value={cast.modifier?.id ?? null}
        onChange={cast.pickModifier}
      />
      {cast.modifier?.targets ? (
        <MultiSelect
          comboboxProps={{ withinPortal: false }}
          data={actors.map((actor) => ({ label: actor.label, value: actor.id }))}
          description={`Up to ${cast.modifier.targets.max}.`}
          disabled={disabled}
          label={
            cast.modifier.targets.outcome === 'EXTRA_TARGET'
              ? 'Further targets'
              : 'Creatures it affects'
          }
          maxValues={cast.modifier.targets.max}
          searchable
          value={cast.actorIds}
          onChange={cast.pickActors}
        />
      ) : null}
    </>
  )
}

/** How many units to spend from the action's pool, between one and what the pool covers. */
export function CampaignTabletopSpendInput({
  spend,
  value,
  disabled,
  onChange
}: {
  spend: NonNullable<EncounterActionChoiceDto['chosenSpend']>
  value: number
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <NumberInput
      allowDecimal={false}
      clampBehavior='strict'
      description={`Each costs ${spend.unitCost}; up to ${spend.max}.`}
      disabled={disabled || spend.max < 1}
      label='Amount to spend'
      max={spend.max}
      min={1}
      value={value}
      onChange={(next) => onChange(Number(next) || 1)}
    />
  )
}

/** What each chosen creature regains from a pool the caster divides; the sum stays within the pool. */
export function CampaignTabletopHealSharesInput({
  divided,
  targets,
  shares,
  disabled,
  onChange
}: {
  divided: NonNullable<EncounterActionChoiceDto['dividedHeal']>
  targets: { id: string; label: string }[]
  shares: Record<string, number>
  disabled: boolean
  onChange: (shares: Record<string, number>) => void
}) {
  const given = targets.reduce((sum, { id }) => sum + (shares[id] ?? 0), 0)
  return (
    <>
      {targets.map(({ id, label }) => (
        <NumberInput
          allowDecimal={false}
          clampBehavior='strict'
          description={`${divided.total - given} of ${divided.total} hit points left to give.`}
          disabled={disabled}
          key={id}
          label={`Hit points for ${label}`}
          max={divided.total}
          min={0}
          value={shares[id] ?? 0}
          onChange={(next) => onChange({ ...shares, [id]: Number(next) || 0 })}
        />
      ))}
    </>
  )
}
