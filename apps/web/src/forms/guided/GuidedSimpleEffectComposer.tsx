import { useState } from 'react'
import {
  Alert,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput
} from '@mantine/core'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import { effectDtoSchema, type EffectDto } from '@artificer-toolkit/schema/effects'
import { parseStandaloneDiceConfiguration } from '@artificer-toolkit/shared/rolls'
import { createDefaultEffect } from '../rendering/authoringNodeDefaults'
import { mapGuidedSpellEffect } from './guidedSimpleEffect.mapping'
import { rehydrateGuidedSpell } from './guidedSimpleEffect.rehydrate'
import {
  createGuidedEffectIds,
  createGuidedSpellDraft,
  GUIDED_DURATION_OPTIONS,
  type GuidedSpellDraft,
  type GuidedSpellIntent
} from './guidedSimpleEffect.types'
import * as styles from './guidedAuthoring.css'

type GuidedSimpleEffectComposerProps = {
  effects: readonly unknown[]
  onChange: (effects: EffectDto[]) => void
  system: NonNullable<SystemResponseDto>
}

type OutcomeChoice = 'DESCRIPTION' | GuidedSpellIntent

export function GuidedSimpleEffectComposer({
  effects,
  onChange,
  system
}: GuidedSimpleEffectComposerProps) {
  const [fallbackIds] = useState(createGuidedEffectIds)
  const rehydrated = effects[0] ? rehydrateGuidedSpell(effects[0], fallbackIds) : null
  const [draft, setDraft] = useState<GuidedSpellDraft | null>(rehydrated?.draft ?? null)
  const [pendingChoice, setPendingChoice] = useState<OutcomeChoice | null>(null)
  const hasUnsupportedEffects = effects.length > 0 && !rehydrated

  const applyChoice = (choice: OutcomeChoice) => {
    if (choice === 'DESCRIPTION') {
      setDraft(null)
      onChange([])
      setPendingChoice(null)
      return
    }

    const nextDraft = createGuidedSpellDraft(choice, {
      damageTypeId:
        system.damageTypes.find((item) => item.code === 'FIRE')?.id ?? system.damageTypes[0]?.id,
      conditionTypeId:
        system.conditionTypes.find((item) => item.code === 'POISONED')?.id ??
        system.conditionTypes[0]?.id
    })
    const base = rehydrated?.effect ?? createDefaultEffect(1)
    const ids = rehydrated?.ids ?? createGuidedEffectIds()
    setDraft(nextDraft)
    onChange([effectDtoSchema.parse(mapGuidedSpellEffect(nextDraft, base, ids))])
    setPendingChoice(null)
  }

  const choose = (choice: OutcomeChoice) => {
    if (hasUnsupportedEffects) {
      setPendingChoice(choice)
      return
    }
    applyChoice(choice)
  }

  const updateDraft = <TKey extends keyof GuidedSpellDraft>(
    key: TKey,
    value: GuidedSpellDraft[TKey]
  ) => {
    if (!draft) return
    const next = { ...draft, [key]: value }
    setDraft(next)
    if ((key === 'damageDice' || key === 'healingDice') && !isValidDice(String(value))) return
    const base =
      rehydrated?.effect ?? effectDtoSchema.safeParse(effects[0]).data ?? createDefaultEffect(1)
    onChange([
      effectDtoSchema.parse(mapGuidedSpellEffect(next, base, rehydrated?.ids ?? fallbackIds))
    ])
  }

  return (
    <Stack gap='lg'>
      {hasUnsupportedEffects ? (
        <Alert color='blue' title='Some details require Advanced'>
          This content has {effects.length} effect{effects.length === 1 ? '' : 's'} Guided cannot
          fully represent. They remain unchanged unless you choose a simple replacement below.
        </Alert>
      ) : null}
      <div className={styles.outcomeGrid} role='group' aria-label='Core outcome'>
        {OUTCOMES.map((outcome) => (
          <Button
            key={outcome.value}
            aria-pressed={
              outcome.value === 'DESCRIPTION'
                ? effects.length === 0
                : draft?.intent === outcome.value
            }
            className={styles.outcomeButton}
            type='button'
            variant='default'
            onClick={() => choose(outcome.value)}
          >
            <span className={styles.choiceCopy}>
              <span className={styles.choiceTitle}>{outcome.label}</span>
              <span className={styles.choiceDescription}>{outcome.description}</span>
            </span>
          </Button>
        ))}
      </div>
      {pendingChoice ? (
        <Alert color='red' title='Replace the existing mechanics?'>
          <Stack gap='sm'>
            <Text size='sm'>
              This replaces the preserved Advanced effects with the selected simple outcome.
            </Text>
            <Group gap='xs'>
              <Button color='red' type='button' onClick={() => applyChoice(pendingChoice)}>
                Replace effects
              </Button>
              <Button type='button' variant='default' onClick={() => setPendingChoice(null)}>
                Keep existing effects
              </Button>
            </Group>
          </Stack>
        </Alert>
      ) : null}
      {draft ? (
        <div className={styles.fields}>
          {draft.intent === 'DAMAGE' ? (
            <>
              <TextInput
                error={isValidDice(draft.damageDice) ? undefined : 'Enter dice such as 1d6.'}
                label='Damage dice'
                value={draft.damageDice}
                onChange={(event) => updateDraft('damageDice', event.currentTarget.value)}
              />
              <Select
                data={system.damageTypes.map((item) => ({ label: item.label, value: item.id }))}
                label='Damage type'
                value={draft.damageTypeId}
                onChange={(value) => updateDraft('damageTypeId', value ?? '')}
              />
            </>
          ) : null}
          {draft.intent === 'CONDITION' ? (
            <>
              <Select
                data={system.conditionTypes.map((item) => ({ label: item.label, value: item.id }))}
                label='Condition'
                value={draft.conditionTypeId}
                onChange={(value) => updateDraft('conditionTypeId', value ?? '')}
              />
              <Select
                data={GUIDED_DURATION_OPTIONS.map((item) => ({
                  label: item.label,
                  value: item.value
                }))}
                label='Duration'
                value={draft.conditionDuration}
                onChange={(value) => {
                  const option = GUIDED_DURATION_OPTIONS.find((item) => item.value === value)
                  if (option) updateDraft('conditionDuration', option.value)
                }}
              />
            </>
          ) : null}
          {draft.intent === 'HEALING' ? (
            <>
              <TextInput
                error={isValidDice(draft.healingDice) ? undefined : 'Enter dice such as 1d6.'}
                label='Healing dice'
                value={draft.healingDice}
                onChange={(event) => updateDraft('healingDice', event.currentTarget.value)}
              />
              <Switch
                checked={draft.temporaryHealing}
                label='Grant temporary hit points'
                onChange={(event) => updateDraft('temporaryHealing', event.currentTarget.checked)}
              />
            </>
          ) : null}
          {draft.intent === 'MOVEMENT' ? (
            <>
              <Select
                data={[
                  { label: 'Push away', value: 'AWAY_FROM_SOURCE' },
                  { label: 'Pull closer', value: 'TOWARD_SOURCE' }
                ]}
                label='Direction'
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
                onChange={(value) =>
                  updateDraft('movementAmount', typeof value === 'number' ? value : 5)
                }
              />
            </>
          ) : null}
        </div>
      ) : null}
    </Stack>
  )
}

function isValidDice(value: string) {
  try {
    parseStandaloneDiceConfiguration(value)
    return true
  } catch {
    return false
  }
}

const OUTCOMES: readonly { description: string; label: string; value: OutcomeChoice }[] = [
  {
    description: 'The description carries the rule.',
    label: 'Description only',
    value: 'DESCRIPTION'
  },
  { description: 'Deal a simple amount of damage.', label: 'Damage', value: 'DAMAGE' },
  { description: 'Apply one familiar condition.', label: 'Condition', value: 'CONDITION' },
  { description: 'Restore or grant hit points.', label: 'Healing', value: 'HEALING' },
  { description: 'Push or pull a creature.', label: 'Movement', value: 'MOVEMENT' }
]
