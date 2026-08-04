import { useEffect, useRef, useState } from 'react'
import { useStore } from '@tanstack/react-form'
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
import { Flame, HeartPulse, MoveRight, ShieldAlert } from 'lucide-react'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import type { AbilityCode } from '@artificer-toolkit/shared/core'
import { parseStandaloneDiceConfiguration } from '@artificer-toolkit/shared/rolls'
import { withForm } from '#forms/app-form/AppForm'
import { useAuthoringForm } from '#forms/layout/AuthoringFormContext'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import type { GuidedAuthoringStateHandler } from '#forms/guided/guidedAuthoring.types'
import { createDefaultEffect } from '#app/forms/rendering/authoringNodeDefaults'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import { mapGuidedSpellEffect } from '#forms/guided/guidedSimpleEffect.mapping'
import {
  createGuidedEffectIds,
  createGuidedSpellDraft,
  GUIDED_ABILITY_OPTIONS,
  GUIDED_DURATION_OPTIONS,
  type GuidedSpellDraft,
  type GuidedSpellIntent
} from '#forms/guided/guidedSimpleEffect.types'
import { rehydrateGuidedSpell } from '#forms/guided/guidedSimpleEffect.rehydrate'
import * as styles from '#forms/guided/guidedAuthoring.css'

type GuidedSpellAuthoringProps = {
  isExistingDraft?: boolean
  system: NonNullable<SystemResponseDto>
  onAdvanced: () => void
  onStateChange: GuidedAuthoringStateHandler
}

export const GuidedSpellAuthoring = withForm({
  defaultValues: {} as object,
  props: {} as GuidedSpellAuthoringProps,
  render: function RenderGuidedSpellAuthoring({
    form,
    isExistingDraft = false,
    onAdvanced,
    onStateChange,
    system
  }) {
    const [fallbackEffectIds] = useState(createGuidedEffectIds)
    const effects = useStore(form.store, (state) => readSpellEffects(state.values))
    const rehydrated = effects?.[0] ? rehydrateGuidedSpell(effects[0], fallbackEffectIds) : null
    const baseEffect = rehydrated?.effect ?? null
    const canonicalDraft = rehydrated?.draft ?? null
    const [localDraft, setLocalDraft] = useState<GuidedSpellDraft | null>(null)
    const [pendingIntent, setPendingIntent] = useState<GuidedSpellIntent | null>(null)
    const draft = localDraft ?? canonicalDraft
    const effectIds = rehydrated?.ids ?? fallbackEffectIds
    const [screen, setScreen] = useState(!isExistingDraft && draft ? 3 : 0)
    const hadEffectsRef = useRef(Boolean(effects?.length))
    const basics = useStore(form.store, (state) => readSpellBasics(state.values))
    const { canFinalize } = useAuthoringForm()

    useEffect(() => {
      onStateChange({ isReview: screen === 3, showPreview: isExistingDraft || screen >= 2 })
    }, [isExistingDraft, onStateChange, screen])

    useEffect(() => {
      const hasEffects = Boolean(effects?.length)
      const effectsCleared = hadEffectsRef.current && !hasEffects
      hadEffectsRef.current = hasEffects
      if (!effectsCleared) return

      setLocalDraft(null)
      setScreen(0)
    }, [effects])

    useEffect(() => {
      if (screen > 0 && !basics.label) setScreen(0)
    }, [basics.label, screen])

    const applyIntent = (intent: GuidedSpellIntent) => {
      const nextDraft = createGuidedSpellDraft(intent, {
        damageTypeId:
          system.damageTypes.find((item) => item.code === 'FIRE')?.id ?? system.damageTypes[0]?.id,
        conditionTypeId:
          system.conditionTypes.find((item) => item.code === 'POISONED')?.id ??
          system.conditionTypes[0]?.id
      })
      const nextEffectIds = createGuidedEffectIds()
      const nextEffect = mapGuidedSpellEffect(
        nextDraft,
        createDefaultEffect(1) as EffectAuthored,
        nextEffectIds
      )
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['effects']), [nextEffect])
      setLocalDraft(nextDraft)
      setPendingIntent(null)
    }

    const chooseIntent = (intent: GuidedSpellIntent) => {
      if (effects?.length && !rehydrated) {
        setPendingIntent(intent)
        return
      }
      applyIntent(intent)
    }

    const updateDraft = <TKey extends keyof GuidedSpellDraft>(
      key: TKey,
      value: GuidedSpellDraft[TKey]
    ) => {
      if (!baseEffect || !draft) return
      const nextDraft = { ...draft, [key]: value }
      setLocalDraft(nextDraft)
      if (
        (key === 'damageDice' || key === 'healingDice') &&
        !isValidDiceConfiguration(String(value))
      ) {
        return
      }
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['effects']), [
        mapGuidedSpellEffect(nextDraft, baseEffect, effectIds)
      ])
    }

    const next = () => {
      if (screen === 0 && !basics.label) return
      if (screen === 1 && !draft) return
      if (screen === 2 && draft && !canContinueMechanics(draft)) return
      const nextScreen = Math.min(3, screen + 1)
      setScreen(nextScreen)
    }

    const back = () => {
      const nextScreen = Math.max(0, screen - 1)
      setScreen(nextScreen)
    }
    return (
      <GuidedAuthoringFrame
        canContinue={
          (screen !== 0 || Boolean(basics.label)) &&
          (screen !== 1 || Boolean(draft)) &&
          (screen !== 2 || Boolean(draft && canContinueMechanics(draft)))
        }
        description={SCREEN_DESCRIPTIONS[screen]}
        domainLabel='Spell'
        onAdvanced={onAdvanced}
        onBack={screen > 0 ? back : undefined}
        onNext={screen < 3 ? next : undefined}
        stepIndex={screen}
        steps={SCREEN_LABELS}
        title={SCREEN_TITLES[screen]}
      >
        {screen === 0 ? (
          <Stack gap='lg'>
            {effects?.length && !rehydrated ? (
              <Alert color='blue' title='Advanced mechanics preserved'>
                This draft contains {effects.length} effect{effects.length === 1 ? '' : 's'} that
                Guided cannot fully represent. You can edit the spell's common details here or
                switch to Advanced to edit those mechanics.
              </Alert>
            ) : null}
            <div className={styles.fields}>
              <div className={styles.full}>
                <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['label'])}>
                  {(field) => (
                    <field.TextField
                      label='Spell name'
                      placeholder='A name your table will remember'
                      required
                    />
                  )}
                </form.AppField>
              </div>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['level'])}>
                {(field) => (
                  <field.NumberSelectField data={SPELL_LEVEL_OPTIONS} label='Level' required />
                )}
              </form.AppField>
              <div className={styles.full}>
                <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['description'])}>
                  {(field) => (
                    <field.TextareaField
                      label='What should players know?'
                      description='A short, plain-language description is enough.'
                      placeholder='Describe the spell in your own words.'
                    />
                  )}
                </form.AppField>
              </div>
            </div>
          </Stack>
        ) : null}
        {screen === 1 ? (
          <Stack gap='lg'>
            <IntentScreen selectedIntent={draft?.intent} onSelect={chooseIntent} />
            {pendingIntent ? (
              <Alert color='red' title='Replace the existing effects?'>
                <Stack gap='sm'>
                  <Text size='sm'>
                    Guided will replace the preserved Advanced effects with one simple outcome. This
                    cannot be undone after you save.
                  </Text>
                  <Group gap='xs'>
                    <Button color='red' type='button' onClick={() => applyIntent(pendingIntent)}>
                      Replace effects
                    </Button>
                    <Button type='button' variant='default' onClick={() => setPendingIntent(null)}>
                      Keep existing effects
                    </Button>
                  </Group>
                </Stack>
              </Alert>
            ) : null}
          </Stack>
        ) : null}
        {screen === 2 && draft ? (
          <MechanicsScreen draft={draft} system={system} updateDraft={updateDraft} />
        ) : null}
        {screen === 3 && draft ? (
          <ReviewScreen
            canFinalize={canFinalize}
            description={basics.description}
            draft={draft}
            label={basics.label}
            level={basics.level}
            system={system}
          />
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

function IntentScreen({
  selectedIntent,
  onSelect
}: {
  selectedIntent?: GuidedSpellIntent
  onSelect: (intent: GuidedSpellIntent) => void
}) {
  return (
    <div className={styles.choiceGrid} role='group' aria-label='Spell outcome'>
      <Button
        aria-pressed={selectedIntent === 'DAMAGE'}
        className={styles.choiceButton}
        data-selected={selectedIntent === 'DAMAGE' ? 'true' : undefined}
        justify='flex-start'
        leftSection={<Flame className={styles.choiceIcon} size={24} aria-hidden />}
        variant='default'
        onClick={() => onSelect('DAMAGE')}
      >
        <span className={styles.choiceCopy}>
          <span className={styles.choiceTitle}>Damage</span>
          <span className={styles.choiceDescription}>
            Deal damage, like a bolt of fire or burst of cold.
          </span>
        </span>
      </Button>
      <Button
        aria-pressed={selectedIntent === 'CONDITION'}
        className={styles.choiceButton}
        data-selected={selectedIntent === 'CONDITION' ? 'true' : undefined}
        justify='flex-start'
        leftSection={<ShieldAlert className={styles.choiceIcon} size={24} aria-hidden />}
        variant='default'
        onClick={() => onSelect('CONDITION')}
      >
        <span className={styles.choiceCopy}>
          <span className={styles.choiceTitle}>Condition</span>
          <span className={styles.choiceDescription}>
            Apply a state, like blinded, charmed, or restrained.
          </span>
        </span>
      </Button>
      <Button
        aria-pressed={selectedIntent === 'HEALING'}
        className={styles.choiceButton}
        data-selected={selectedIntent === 'HEALING' ? 'true' : undefined}
        justify='flex-start'
        leftSection={<HeartPulse className={styles.choiceIcon} size={24} aria-hidden />}
        variant='default'
        onClick={() => onSelect('HEALING')}
      >
        <span className={styles.choiceCopy}>
          <span className={styles.choiceTitle}>Healing</span>
          <span className={styles.choiceDescription}>
            Restore hit points or grant temporary hit points.
          </span>
        </span>
      </Button>
      <Button
        aria-pressed={selectedIntent === 'MOVEMENT'}
        className={styles.choiceButton}
        data-selected={selectedIntent === 'MOVEMENT' ? 'true' : undefined}
        justify='flex-start'
        leftSection={<MoveRight className={styles.choiceIcon} size={24} aria-hidden />}
        variant='default'
        onClick={() => onSelect('MOVEMENT')}
      >
        <span className={styles.choiceCopy}>
          <span className={styles.choiceTitle}>Movement</span>
          <span className={styles.choiceDescription}>
            Push or pull a creature across the battlefield.
          </span>
        </span>
      </Button>
    </div>
  )
}

function MechanicsScreen({
  draft,
  system,
  updateDraft
}: {
  draft: GuidedSpellDraft
  system: NonNullable<SystemResponseDto>
  updateDraft: <TKey extends keyof GuidedSpellDraft>(
    key: TKey,
    value: GuidedSpellDraft[TKey]
  ) => void
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

function ReviewScreen({
  canFinalize,
  description,
  draft,
  label,
  level,
  system
}: {
  canFinalize: boolean
  description?: string
  draft: GuidedSpellDraft
  label: string
  level?: number
  system: NonNullable<SystemResponseDto>
}) {
  const typeLabel = system.damageTypes.find((item) => item.id === draft.damageTypeId)?.label
  const conditionLabel = system.conditionTypes.find(
    (item) => item.id === draft.conditionTypeId
  )?.label
  const targetLabel =
    draft.target === 'SELF' ? 'Self' : `One creature within ${draft.targetDistance} feet`
  const saveLabel = draft.saveAbility
    ? (GUIDED_ABILITY_OPTIONS.find((item) => item.value === draft.saveAbility)?.label ??
      draft.saveAbility)
    : 'No saving throw'

  const outcome =
    draft.intent === 'DAMAGE'
      ? `${draft.damageDice} ${typeLabel ?? 'damage'}`
      : draft.intent === 'CONDITION'
        ? `${conditionLabel ?? 'Condition'} for ${
            GUIDED_DURATION_OPTIONS.find((item) => item.value === draft.conditionDuration)?.label
          }`
        : draft.intent === 'HEALING'
          ? `${draft.healingDice} ${draft.temporaryHealing ? 'temporary hit points' : 'hit points'}`
          : `${draft.movementDirection === 'TOWARD_SOURCE' ? 'Pull' : 'Push'} ${draft.movementAmount} feet`

  return (
    <Stack gap='lg'>
      {!canFinalize ? (
        <Alert color='yellow'>
          Activation is not ready yet. Go Back to fix details or switch to advanced authoring.
        </Alert>
      ) : null}
      <dl className={styles.summary}>
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Name</dt>
          <dd className={styles.summaryValue}>{label || 'Untitled Spell'}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Level</dt>
          <dd className={styles.summaryValue}>{formatSpellLevel(level)}</dd>
        </div>
        {description ? (
          <div className={styles.summaryRow}>
            <dt className={styles.summaryLabel}>Description</dt>
            <dd className={styles.summaryValue}>{description}</dd>
          </div>
        ) : null}
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Outcome</dt>
          <dd className={styles.summaryValue}>{outcome}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Target</dt>
          <dd className={styles.summaryValue}>{targetLabel}</dd>
        </div>
        <div className={styles.summaryRow}>
          <dt className={styles.summaryLabel}>Save</dt>
          <dd className={styles.summaryValue}>{saveLabel}</dd>
        </div>
      </dl>
      <Text c='dimmed'>
        Save Draft keeps your work in progress. Review the details before activating it for play.
      </Text>
    </Stack>
  )
}

const SCREEN_TITLES = [
  'Start with the basics',
  'What does the spell do?',
  'Describe the mechanics',
  'Review your spell'
] as const

const SCREEN_LABELS = ['Basics', 'Outcome', 'Mechanics', 'Review'] as const

const SCREEN_DESCRIPTIONS = [
  'Give the spell a name and a short description. Everything else can stay simple.',
  'Choose the main thing this spell does. You can refine the details next.',
  'Answer a few focused questions. Advanced mode remains available for anything unusual.',
  'Take a quick look, then use the action bar to save or activate the spell.'
] as const

const SPELL_LEVEL_OPTIONS = [
  { value: '0', label: 'Cantrip' },
  ...Array.from({ length: 9 }, (_, index) => ({
    value: String(index + 1),
    label: `Level ${index + 1}`
  }))
]

function canContinueMechanics(draft: GuidedSpellDraft): boolean {
  if (draft.target === 'CREATURE' && draft.targetDistance <= 0) return false

  switch (draft.intent) {
    case 'DAMAGE':
      return Boolean(isValidDiceConfiguration(draft.damageDice) && draft.damageTypeId)
    case 'CONDITION':
      return Boolean(draft.conditionTypeId)
    case 'HEALING':
      return isValidDiceConfiguration(draft.healingDice)
    case 'MOVEMENT':
      return draft.movementAmount > 0
  }
}

function readSpellBasics(values: object): {
  description?: string
  label: string
  level?: number
} {
  return {
    description:
      'description' in values && typeof values.description === 'string'
        ? values.description.trim()
        : undefined,
    label: 'label' in values && typeof values.label === 'string' ? values.label.trim() : '',
    level: 'level' in values && typeof values.level === 'number' ? values.level : undefined
  }
}

function isValidDiceConfiguration(value: string): boolean {
  if (!value.trim()) return false
  try {
    parseStandaloneDiceConfiguration(value)
    return true
  } catch {
    return false
  }
}

function formatSpellLevel(level: number | undefined): string {
  return level === 0 ? 'Cantrip' : `Level ${level ?? 0}`
}

function readSpellEffects(values: object): readonly unknown[] | undefined {
  if (!('effects' in values) || !Array.isArray(values.effects)) return undefined
  return values.effects
}
