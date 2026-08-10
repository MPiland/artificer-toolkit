import { NumberInput, Select, Stack, Switch, TextInput } from '@mantine/core'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { AbilityCode } from '@artificer-toolkit/shared/core'
import {
  GUIDED_ABILITY_OPTIONS,
  GUIDED_DURATION_OPTIONS,
  type GuidedSpellDraft
} from '#forms/guided/guidedSimpleEffect.types'
import * as styles from '#forms/guided/guidedAuthoring.css'

export function GuidedSpellMechanicsScreen({
  draft,
  system,
  updateDraft,
  isValidDiceConfiguration
}: {
  draft: GuidedSpellDraft
  system: NonNullable<SystemResponseDto>
  updateDraft: <TKey extends keyof GuidedSpellDraft>(
    key: TKey,
    value: GuidedSpellDraft[TKey]
  ) => void
  isValidDiceConfiguration: (value: string) => boolean
}) {
  const damageTypeOptions = system.damageTypes.map((item) => ({
    value: item.id,
    label: item.label
  }))
  const conditionTypeOptions = system.conditionTypes.map((item) => ({
    value: item.id,
    label: item.label
  }))

  return (
    <Stack gap='lg'>
      <div className={styles.fields}>
        <Select
          label='Who is affected?'
          data={[
            { value: 'SELF', label: 'Self' },
            { value: 'CREATURE', label: 'One creature' }
          ]}
          value={draft.target}
          onChange={(value) => updateDraft('target', value === 'SELF' ? 'SELF' : 'CREATURE')}
        />
        {draft.intent !== 'HEALING' ? (
          <Select
            label='Saving throw'
            data={[
              { value: '', label: 'No save' },
              ...GUIDED_ABILITY_OPTIONS.map((item) => ({ value: item.value, label: item.label }))
            ]}
            value={draft.saveAbility}
            onChange={(value) => updateDraft('saveAbility', (value ?? '') as AbilityCode | '')}
          />
        ) : null}
        {draft.target === 'CREATURE' ? (
          <NumberInput
            label='Range (feet)'
            min={1}
            value={draft.targetDistance}
            onChange={(value) => {
              const distance = typeof value === 'number' && Number.isFinite(value) ? value : 60
              updateDraft('targetDistance', distance)
            }}
          />
        ) : null}
      </div>

      {draft.intent === 'DAMAGE' ? (
        <div className={styles.fields}>
          <TextInput
            description='Choose a starting dice expression, then adjust it for your spell.'
            error={
              isValidDiceConfiguration(draft.damageDice) ? undefined : 'Enter dice such as 1d6.'
            }
            label='Damage dice'
            value={draft.damageDice}
            onChange={(event) => updateDraft('damageDice', event.currentTarget.value)}
            placeholder='1d6'
          />
          <Select
            description='This starting type can be changed.'
            label='Damage type'
            data={damageTypeOptions}
            value={draft.damageTypeId || null}
            onChange={(value) => updateDraft('damageTypeId', value ?? '')}
            placeholder='Choose a type'
            disabled={!damageTypeOptions.length}
          />
        </div>
      ) : null}

      {draft.intent === 'CONDITION' ? (
        <div className={styles.fields}>
          <Select
            description='This starting condition can be changed.'
            label='Condition'
            data={conditionTypeOptions}
            value={draft.conditionTypeId || null}
            onChange={(value) => updateDraft('conditionTypeId', value ?? '')}
            placeholder='Choose a condition'
            disabled={!conditionTypeOptions.length}
          />
          <Select
            label='Duration'
            data={GUIDED_DURATION_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            value={draft.conditionDuration}
            onChange={(value) => {
              const option = GUIDED_DURATION_OPTIONS.find((item) => item.value === value)
              if (option) updateDraft('conditionDuration', option.value)
            }}
          />
        </div>
      ) : null}

      {draft.intent === 'HEALING' ? (
        <Stack gap='md'>
          <TextInput
            description='Choose a starting dice expression, then adjust it for your spell.'
            error={
              isValidDiceConfiguration(draft.healingDice) ? undefined : 'Enter dice such as 1d6.'
            }
            label='Healing dice'
            value={draft.healingDice}
            onChange={(event) => updateDraft('healingDice', event.currentTarget.value)}
            placeholder='1d6'
          />
          <Switch
            label='Give temporary hit points instead'
            checked={draft.temporaryHealing}
            onChange={(event) => updateDraft('temporaryHealing', event.currentTarget.checked)}
          />
        </Stack>
      ) : null}

      {draft.intent === 'MOVEMENT' ? (
        <div className={styles.fields}>
          <Select
            label='Move the creature'
            data={[
              { value: 'AWAY_FROM_SOURCE', label: 'Away from you' },
              { value: 'TOWARD_SOURCE', label: 'Toward you' }
            ]}
            value={draft.movementDirection}
            onChange={(value) =>
              updateDraft(
                'movementDirection',
                value === 'TOWARD_SOURCE' ? 'TOWARD_SOURCE' : 'AWAY_FROM_SOURCE'
              )
            }
          />
          <NumberInput
            label='Distance (feet)'
            min={1}
            value={draft.movementAmount}
            onChange={(value) => {
              const amount = typeof value === 'number' && Number.isFinite(value) ? value : 5
              updateDraft('movementAmount', amount)
            }}
          />
        </div>
      ) : null}
    </Stack>
  )
}
