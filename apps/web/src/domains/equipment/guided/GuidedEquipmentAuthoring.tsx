import { useEffect, useState } from 'react'
import { Alert, Stack } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-form'
import type { EffectDto } from '@artificer-toolkit/schema/effects'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { EQUIPMENT_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import { getEquipmentOptions } from '#app/data/equipment/options'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import { GuidedSimpleEffectComposer } from '#forms/guided/GuidedSimpleEffectComposer'
import type { GuidedDomainAuthoringProps } from '#forms/guided/guidedAuthoring.types'
import { GuidedSummaryRow } from '#forms/guided/GuidedSummaryRow'
import * as styles from '#forms/guided/guidedAuthoring.css'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import { EMPTY_GUIDED_FORM_VALUES, toFeatures, toSelectOption } from '#forms/guided/guidedValues'
import { isRecord } from '#forms/utils/valueGuards'

export const GuidedEquipmentAuthoring = withForm({
  defaultValues: EMPTY_GUIDED_FORM_VALUES,
  props: {} as GuidedDomainAuthoringProps,
  render: function RenderGuidedEquipmentAuthoring({
    form,
    onAdvanced,
    onStateChange,
    session,
    system
  }) {
    const [step, setStep] = useState(0)
    const values = useSelector(form.store, (state) => readEquipmentValues(state.values))
    const categoryLocked = session.mode === 'edit'
    const parentEquipment = useQuery({
      ...getEquipmentOptions(system.id, true),
      enabled: values.category === EQUIPMENT_CATEGORY_CODE.VARIANT
    })

    useEffect(() => {
      onStateChange({
        isReview: step === 4,
        showPreview: session.mode === 'edit' || step > 0 || Boolean(values.label)
      })
    }, [onStateChange, session.mode, step, values.label])

    const setEffects = (effects: EffectDto[]) => {
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['effects']), effects)
    }
    const setFeatures = (features: FeatureDto[]) => {
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['features']), features)
    }

    return (
      <GuidedAuthoringFrame
        canContinue={Boolean(
          values.label &&
          values.rarityId &&
          (values.category !== EQUIPMENT_CATEGORY_CODE.VARIANT || values.parentEquipmentId)
        )}
        description={DESCRIPTIONS[step]}
        domainLabel='Equipment'
        onAdvanced={onAdvanced}
        onBack={step > 0 ? () => setStep((current) => current - 1) : undefined}
        onNext={step < 4 ? () => setStep((current) => current + 1) : undefined}
        stepIndex={step}
        steps={STEPS}
        title={TITLES[step]}
      >
        {step === 0 ? (
          <Stack gap='lg'>
            <div className={styles.identityRow}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['label'])}>
                {(field) => <field.TextField label='Item name' required />}
              </form.AppField>
              <AuthoringArtworkControl />
            </div>
            <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['description'])}>
              {(field) => (
                <field.RichTextField
                  label='Description'
                  placeholder='Describe what the item looks like and why it matters.'
                />
              )}
            </form.AppField>
          </Stack>
        ) : null}
        {step === 1 ? (
          <Stack gap='lg'>
            {categoryLocked ? (
              <Alert color='blue'>
                This item's structural category stays fixed in Guided. Switch to Advanced to change
                it.
              </Alert>
            ) : null}
            <div className={styles.fields}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['category'])}>
                {(field) => (
                  <field.SelectField
                    data={CATEGORY_OPTIONS}
                    label='Item type'
                    readOnly={categoryLocked}
                    required
                  />
                )}
              </form.AppField>
              {values.category === EQUIPMENT_CATEGORY_CODE.VARIANT ? (
                <form.AppField
                  name={toTypedAuthoringFieldName<object>(undefined, ['parentEquipmentId'])}
                >
                  {(field) => (
                    <field.SelectField
                      data={parentEquipment.data ?? []}
                      label='Base item'
                      placeholder={parentEquipment.isLoading ? 'Loading items…' : 'Choose an item'}
                      required
                    />
                  )}
                </form.AppField>
              ) : null}
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['rarityId'])}>
                {(field) => (
                  <field.SelectField
                    data={system.rarities.map(toSelectOption)}
                    label='Rarity'
                    required
                  />
                )}
              </form.AppField>
              {values.category !== EQUIPMENT_CATEGORY_CODE.VARIANT ? (
                <>
                  <form.AppField
                    name={toTypedAuthoringFieldName<object>(undefined, ['weight', 'amount'])}
                  >
                    {(field) => <field.NumberField label='Weight (lb.)' minimum={0} />}
                  </form.AppField>
                  <form.AppField
                    name={toTypedAuthoringFieldName<object>(undefined, ['cost', 'amount'])}
                  >
                    {(field) => <field.NumberField label='Cost' minimum={0} />}
                  </form.AppField>
                  <form.AppField
                    name={toTypedAuthoringFieldName<object>(undefined, ['cost', 'currencyId'])}
                  >
                    {(field) => (
                      <field.SelectField
                        data={system.currencies.map(toSelectOption)}
                        label='Currency'
                      />
                    )}
                  </form.AppField>
                </>
              ) : null}
            </div>
          </Stack>
        ) : null}
        {step === 2 ? (
          <Stack gap='lg'>
            {values.advancedCount ? (
              <Alert color='blue'>
                Modifiers, restrictions, contents, and complex charges remain preserved for
                Advanced.
              </Alert>
            ) : null}
            <GuidedSimpleEffectComposer
              effects={values.effects}
              system={system}
              onChange={setEffects}
            />
          </Stack>
        ) : null}
        {step === 3 ? (
          <GuidedFeatureAccordion
            features={values.features}
            system={system}
            onChange={setFeatures}
          />
        ) : null}
        {step === 4 ? (
          <Stack gap='md'>
            <dl className={styles.summary}>
              <GuidedSummaryRow label='Name' value={values.label || 'Untitled Equipment'} />
              <GuidedSummaryRow label='Item type' value={formatEnum(values.category)} />
              <GuidedSummaryRow label='Core outcomes' value={String(values.effects.length)} />
              <GuidedSummaryRow label='Features' value={String(values.features.length)} />
            </dl>
          </Stack>
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

function readEquipmentValues(values: object) {
  const record: Record<string, unknown> = isRecord(values) ? values : {}
  const array = (key: string) => (Array.isArray(record[key]) ? record[key] : [])
  return {
    advancedCount:
      array('modifiers').length +
      array('contains').length +
      (record.restrictions ? 1 : 0) +
      (record.charges ? 1 : 0),
    category:
      typeof record.category === 'string'
        ? record.category
        : EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    effects: array('effects'),
    features: toFeatures(record.features),
    label: typeof record.label === 'string' ? record.label.trim() : '',
    parentEquipmentId: typeof record.parentEquipmentId === 'string' ? record.parentEquipmentId : '',
    rarityId: typeof record.rarityId === 'string' ? record.rarityId : ''
  }
}

function formatEnum(value: string) {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const STEPS = ['Basics', 'Item details', 'Core outcome', 'Features', 'Review'] as const
const TITLES = [
  'Name the item',
  'Set the item details',
  'Choose the core outcome',
  'Add features',
  'Review your item'
] as const
const DESCRIPTIONS = [
  'Give the item a clear identity and a short player-facing description.',
  'Choose the familiar details players use when carrying or buying it.',
  'Choose one common outcome. Advanced remains available for unusual mechanics.',
  'Add named traits or actions that belong to the item.',
  'Check the essentials before saving or activating.'
] as const
const CATEGORY_OPTIONS = [
  ['WEAPON', 'Weapon'],
  ['ARMOR', 'Armor'],
  ['SHIELD', 'Shield'],
  ['ADVENTURING_GEAR', 'Adventuring gear'],
  ['TOOL', 'Tool'],
  ['VARIANT', 'Variant of an existing item']
].map(([value, label]) => ({ label, value }))
