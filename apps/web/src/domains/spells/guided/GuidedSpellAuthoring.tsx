import { useEffect, useState } from 'react'
import { useSelector } from '@tanstack/react-form'
import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import { parseStandaloneDiceConfiguration } from '@artificer-toolkit/shared/rolls'
import { withForm } from '#forms/app-form/AppForm'
import { useAuthoringForm } from '#forms/layout/AuthoringFormContext'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import type { GuidedAuthoringStateHandler } from '#forms/guided/guidedAuthoring.types'
import { createDefaultEffect } from '#app/forms/rendering/authoringNodeDefaults'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import { mapGuidedSpellEffect } from '#forms/guided/guidedSimpleEffect.mapping'
import {
  createGuidedEffectIds,
  createGuidedSpellDraft,
  type GuidedSpellDraft,
  type GuidedSpellIntent
} from '#forms/guided/guidedSimpleEffect.types'
import { rehydrateGuidedSpell } from '#forms/guided/guidedSimpleEffect.rehydrate'
import * as styles from '#forms/guided/guidedAuthoring.css'
import { GuidedSpellIntentScreen } from './GuidedSpellIntentScreen'
import { GuidedSpellMechanicsScreen } from './GuidedSpellMechanicsScreen'
import { GuidedSpellReviewScreen } from './GuidedSpellReviewScreen'

type GuidedSpellAuthoringProps = {
  isExistingDraft?: boolean
  system: NonNullable<SystemResponseDto>
  onAdvanced: (() => void) | undefined
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
    const effects = useSelector(form.store, (state) => readSpellEffects(state.values))
    const rehydrated = effects?.[0] ? rehydrateGuidedSpell(effects[0], fallbackEffectIds) : null
    const baseEffect = rehydrated?.effect ?? null
    const canonicalDraft = rehydrated?.draft ?? null
    const [localDraft, setLocalDraft] = useState<GuidedSpellDraft | null>(null)
    const [pendingIntent, setPendingIntent] = useState<GuidedSpellIntent | null>(null)
    const draft = localDraft ?? canonicalDraft
    const effectIds = rehydrated?.ids ?? fallbackEffectIds
    const [screen, setScreen] = useState(!isExistingDraft && draft ? 3 : 0)
    const hasEffects = Boolean(effects?.length)
    const [hadEffects, setHadEffects] = useState(hasEffects)
    const basics = useSelector(form.store, (state) => readSpellBasics(state.values))
    const { canFinalize } = useAuthoringForm()

    useEffect(() => {
      onStateChange({ isReview: screen === 3, showPreview: isExistingDraft || screen >= 2 })
    }, [isExistingDraft, onStateChange, screen])

    if (hadEffects !== hasEffects) {
      setHadEffects(hasEffects)
      if (hadEffects) {
        setLocalDraft(null)
        setScreen(0)
      }
    }

    if (screen > 0 && !basics.label) setScreen(0)

    const applyIntent = (intent: GuidedSpellIntent) => {
      const nextDraft = createGuidedSpellDraft(intent, {
        damageTypeId:
          system.damageTypes.find((item) => item.code === 'FIRE')?.id ?? system.damageTypes[0]?.id,
        conditionTypeId:
          system.conditionTypes.find((item) => item.code === 'POISONED')?.id ??
          system.conditionTypes[0]?.id
      })
      const nextEffectIds = createGuidedEffectIds()
      const nextEffect = mapGuidedSpellEffect(nextDraft, createDefaultEffect(1), nextEffectIds)
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
              <Alert color='blue' title='Some details require Advanced'>
                This draft contains {effects.length} effect{effects.length === 1 ? '' : 's'} that
                Guided cannot fully represent. You can edit the spell's common details here or
                switch to Advanced to edit those mechanics.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <div className={styles.identityFields}>
                <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['label'])}>
                  {(field) => (
                    <field.TextField
                      label='Spell name'
                      placeholder='A name your table will remember'
                      required
                    />
                  )}
                </form.AppField>
                <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['level'])}>
                  {(field) => (
                    <field.NumberSelectField data={SPELL_LEVEL_OPTIONS} label='Level' required />
                  )}
                </form.AppField>
              </div>
              <AuthoringArtworkControl />
            </div>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['description'])}>
              {(field) => (
                <field.RichTextField
                  label='Description'
                  placeholder='Describe the spell in your own words.'
                />
              )}
            </form.AppField>
          </Stack>
        ) : null}
        {screen === 1 ? (
          <Stack gap='lg'>
            <GuidedSpellIntentScreen selectedIntent={draft?.intent} onSelect={chooseIntent} />
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
          <GuidedSpellMechanicsScreen
            draft={draft}
            system={system}
            updateDraft={updateDraft}
            isValidDiceConfiguration={isValidDiceConfiguration}
          />
        ) : null}
        {screen === 3 && draft ? (
          <GuidedSpellReviewScreen
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

function readSpellEffects(values: object): readonly unknown[] | undefined {
  if (!('effects' in values) || !Array.isArray(values.effects)) return undefined
  return values.effects
}
