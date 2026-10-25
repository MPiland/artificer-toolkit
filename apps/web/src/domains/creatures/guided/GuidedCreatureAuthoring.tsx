import { useEffect, useState } from 'react'
import { Alert, Stack, Text } from '@mantine/core'
import { useSelector } from '@tanstack/react-form'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import type { GuidedDomainAuthoringProps } from '#forms/guided/guidedAuthoring.types'
import { GuidedSummaryRow } from '#forms/guided/GuidedSummaryRow'
import * as styles from '#forms/guided/guidedAuthoring.css'
import {
  EMPTY_GUIDED_FORM_VALUES,
  guidedField,
  guidedSizeOptions,
  readGuidedValues,
  toFeatures,
  toSelectOption
} from '#forms/guided/guidedValues'

export const GuidedCreatureAuthoring = withForm({
  defaultValues: EMPTY_GUIDED_FORM_VALUES,
  props: {} as GuidedDomainAuthoringProps,
  render: function RenderGuidedCreatureAuthoring({
    form,
    onAdvanced,
    onStateChange,
    session,
    system
  }) {
    const [step, setStep] = useState(0)
    const values = useSelector(form.store, (state) => state.values)
    const draft = readGuidedValues('creature', values)
    const label = (draft.label ?? '').trim()
    const features = toFeatures(draft.features)
    const advancedCount = (draft.details?.length ?? 0) + (draft.proficiencies?.length ?? 0)
    const categoryLocked = session.mode === 'edit'

    useEffect(() => {
      onStateChange({
        isReview: step === 5,
        showPreview: session.mode === 'edit' || step > 0 || Boolean(label)
      })
    }, [onStateChange, session.mode, step, label])

    const setFeatures = (next: FeatureDto[]) => {
      form.setFieldValue(guidedField('creature', 'features'), next)
    }

    return (
      <GuidedAuthoringFrame
        canContinue={Boolean(label)}
        description={DESCRIPTIONS[step]}
        domainLabel='Creature'
        onAdvanced={onAdvanced}
        onBack={step > 0 ? () => setStep((current) => current - 1) : undefined}
        onNext={step < 5 ? () => setStep((current) => current + 1) : undefined}
        stepIndex={step}
        steps={STEPS}
        title={TITLES[step]}
      >
        {step === 0 ? (
          <Stack gap='lg'>
            {categoryLocked ? (
              <Alert color='blue'>
                This creature's category stays fixed in Guided. Switch to Advanced to change its
                structural profile.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={guidedField('creature', 'label')}>
                {(field) => <field.TextField label='Creature name' required />}
              </form.AppField>
              <AuthoringArtworkControl />
            </div>
            <div className={styles.fields}>
              <form.AppField name={guidedField('creature', 'category')}>
                {(field) => (
                  <field.SelectField
                    data={CREATURE_CATEGORIES}
                    label='Category'
                    readOnly={categoryLocked}
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name={guidedField('creature', 'creatureTypeId')}>
                {(field) => (
                  <field.SelectField
                    data={system.creatureTypes.map(toSelectOption)}
                    label='Creature type'
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name={guidedField('creature', 'size')}>
                {(field) => (
                  <field.SelectField
                    data={guidedSizeOptions(session.systemId)}
                    label='Size'
                    required
                  />
                )}
              </form.AppField>
              <form.AppField name={guidedField('creature', 'alignmentId')}>
                {(field) => (
                  <field.SelectField
                    data={system.alignments.map(toSelectOption)}
                    label='Alignment'
                  />
                )}
              </form.AppField>
              <div className={styles.full}>
                <form.AppField name={guidedField('creature', 'description')}>
                  {(field) => <field.RichTextField label='Description' />}
                </form.AppField>
              </div>
            </div>
          </Stack>
        ) : null}
        {step === 1 ? (
          <div className={styles.fields}>
            <form.AppField name={guidedField('creature', 'naturalArmorBonus')}>
              {(field) => <field.NumberField label='Natural armor bonus' minimum={0} required />}
            </form.AppField>
            <form.AppField name={guidedField('creature', 'hitPoints')}>
              {(field) => <field.NumberField label='Hit Points' minimum={1} required />}
            </form.AppField>
            <form.AppField name={guidedField('creature', 'challengeRatingId')}>
              {(field) => (
                <field.SelectField
                  data={system.challengeRatings.map(toSelectOption)}
                  label='Challenge rating'
                />
              )}
            </form.AppField>
            <form.AppField name={guidedField('creature', 'passivePerception')}>
              {(field) => <field.NumberField label='Passive Perception' minimum={0} />}
            </form.AppField>
            <Text className={styles.full} c='dimmed' size='sm'>
              These controls describe the creature; they do not claim to balance it.
            </Text>
          </div>
        ) : null}
        {step === 2 ? (
          <div className={styles.fields}>
            {ABILITY_FIELDS.map(([path, label]) => (
              <form.AppField key={path} name={guidedField('creature', 'abilityScores', path)}>
                {(field) => <field.NumberField label={label} minimum={1} maximum={30} required />}
              </form.AppField>
            ))}
          </div>
        ) : null}
        {step === 3 ? (
          <div className={styles.fields}>
            <form.AppField name={guidedField('creature', 'damageVulnerabilities')}>
              {(field) => (
                <field.MultiSelectField
                  data={system.damageTypes.map(toSelectOption)}
                  label='Damage vulnerabilities'
                />
              )}
            </form.AppField>
            <form.AppField name={guidedField('creature', 'damageResistances')}>
              {(field) => (
                <field.MultiSelectField
                  data={system.damageTypes.map(toSelectOption)}
                  label='Damage resistances'
                />
              )}
            </form.AppField>
            <form.AppField name={guidedField('creature', 'damageImmunities')}>
              {(field) => (
                <field.MultiSelectField
                  data={system.damageTypes.map(toSelectOption)}
                  label='Damage immunities'
                />
              )}
            </form.AppField>
            <form.AppField name={guidedField('creature', 'conditionImmunities')}>
              {(field) => (
                <field.MultiSelectField
                  data={system.conditionTypes.map(toSelectOption)}
                  label='Condition immunities'
                />
              )}
            </form.AppField>
          </div>
        ) : null}
        {step === 4 ? (
          <Stack gap='md'>
            {advancedCount ? (
              <Alert color='blue'>
                {advancedCount} Advanced-only profile or proficiency section
                {advancedCount === 1 ? ' is' : 's are'} preserved.
              </Alert>
            ) : null}
            <GuidedFeatureAccordion
              features={features}
              label='Features and actions'
              system={system}
              onChange={setFeatures}
            />
          </Stack>
        ) : null}
        {step === 5 ? (
          <Stack gap='md'>
            <dl className={styles.summary}>
              <GuidedSummaryRow label='Name' value={label || 'Untitled Creature'} />
              <GuidedSummaryRow
                label='Natural armor bonus'
                value={String(draft.naturalArmorBonus ?? '—')}
              />
              <GuidedSummaryRow label='Hit Points' value={String(draft.hitPoints ?? '—')} />
              <GuidedSummaryRow label='Features and actions' value={String(features.length)} />
            </dl>
          </Stack>
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

const STEPS = [
  'Basics',
  'Combat stats',
  'Ability scores',
  'Defenses',
  'Features and actions',
  'Review'
] as const
const TITLES = [
  'Start with the basics',
  'Set the combat stats',
  'Set the ability scores',
  'Choose the defenses',
  'Add features and actions',
  'Review your creature'
] as const
const DESCRIPTIONS = [
  'Establish what the creature is and how players will recognize it.',
  'Enter the numbers most often used during an encounter.',
  'Use familiar ability scores. Defaults are ordinary, not a balance recommendation.',
  'Add only the vulnerabilities, resistances, and immunities that matter.',
  'Describe the traits and actions that make this creature distinct.',
  'Check the stat block essentials before saving or activating.'
] as const
const CREATURE_CATEGORIES = ['MONSTER', 'BEAST', 'NPC', 'COMPANION', 'SUMMON'].map((value) => ({
  label: value.charAt(0) + value.slice(1).toLowerCase(),
  value
}))
const ABILITY_FIELDS = [
  ['STRENGTH', 'Strength'],
  ['DEXTERITY', 'Dexterity'],
  ['CONSTITUTION', 'Constitution'],
  ['INTELLIGENCE', 'Intelligence'],
  ['WISDOM', 'Wisdom'],
  ['CHARISMA', 'Charisma']
] as const
