import { useEffect, useState } from 'react'
import { useSelector } from '@tanstack/react-form'
import { Alert, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { DetailDto } from '@artificer-toolkit/schema/shared'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared/startingEquipment'
import { getEquipmentOptions } from '#app/data/equipment/options'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import type { GuidedDomainAuthoringProps } from '#forms/guided/guidedAuthoring.types'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import { GuidedSummaryRow } from '#forms/guided/GuidedSummaryRow'
import {
  createGuidedStartingEquipmentItem,
  isGuidedStartingEquipmentItem,
  type GuidedStartingEquipmentItem
} from '#forms/guided/guidedStartingEquipment'
import { createEmptyStartingEquipment } from '#forms/rendering/startingEquipmentDefaults'
import {
  createEmptyDetail,
  getStartingEquipmentItems,
  type StartingEquipmentItemDto
} from '../backgroundAuthoring.utils'
import * as styles from '#forms/guided/guidedAuthoring.css'
import RichTextEditor from '#ui/primitives/RichTextEditor'
import {
  EMPTY_GUIDED_FORM_VALUES,
  guidedField,
  readGuidedValues,
  toDetails,
  toFeatures,
  type GuidedValues
} from '#forms/guided/guidedValues'

const STEPS = ['Basics', 'Benefits', 'Starting gear', 'Features', 'Review'] as const

export const GuidedBackgroundAuthoring = withForm({
  defaultValues: EMPTY_GUIDED_FORM_VALUES,
  props: {} as GuidedDomainAuthoringProps,
  render: function RenderGuidedBackgroundAuthoring({
    form,
    onAdvanced,
    onStateChange,
    session,
    system
  }) {
    const [screen, setScreen] = useState(0)
    const values = useSelector(form.store, (state) => state.values)
    const draft = readGuidedValues('background', values)
    const label = draft.label ?? ''
    const details = toDetails(draft.details)
    const features = toFeatures(draft.features)
    const equipment = draft.startingEquipment ?? createEmptyStartingEquipment()

    useEffect(() => {
      onStateChange({ isReview: screen === 4, showPreview: screen > 0 || Boolean(label) })
    }, [label, onStateChange, screen])

    const setFeatures = (next: FeatureDto[]) => {
      form.setFieldValue(guidedField('background', 'features'), next)
    }

    const setDetails = (next: DetailDto[]) => {
      form.setFieldValue(guidedField('background', 'details'), next)
    }

    const setEquipment = (next: StartingEquipmentDto) => {
      form.setFieldValue(guidedField('background', 'startingEquipment'), next)
    }

    const canContinue = screen === 0 ? Boolean(label.trim()) : true
    const next = () => {
      if (!canContinue) return
      setScreen((current) => Math.min(STEPS.length - 1, current + 1))
    }

    return (
      <GuidedAuthoringFrame
        canContinue={canContinue}
        description={DESCRIPTIONS[screen]}
        domainLabel='Background'
        onAdvanced={onAdvanced}
        onBack={screen > 0 ? () => setScreen((current) => current - 1) : undefined}
        onNext={screen < STEPS.length - 1 ? next : undefined}
        stepIndex={screen}
        steps={STEPS}
        title={TITLES[screen]}
      >
        {screen === 0 ? (
          <Stack gap='lg'>
            {session.mode === 'edit' && hasUnsupportedContent(draft) ? (
              <Alert color='blue' title='Some details require Advanced'>
                This background contains detailed proficiency or equipment rules. Guided keeps them
                intact while you edit the common description and features.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={guidedField('background', 'label')}>
                {(field) => (
                  <field.TextField
                    label='Background name'
                    placeholder='A background your table will remember'
                    required
                  />
                )}
              </form.AppField>
              <AuthoringArtworkControl />
            </div>
            <form.AppField name={guidedField('background', 'description')}>
              {(field) => (
                <field.RichTextField
                  label='Description'
                  placeholder='Describe the life this background represents.'
                />
              )}
            </form.AppField>
          </Stack>
        ) : null}

        {screen === 1 ? (
          <Stack gap='lg'>
            <Text c='dimmed'>
              Add the practical benefits this background grants without building a rules matrix.
            </Text>
            <BenefitEditor details={details} onChange={setDetails} />
          </Stack>
        ) : null}

        {screen === 2 ? (
          <StartingGearEditor
            equipment={equipment}
            onChange={setEquipment}
            systemId={session.systemId}
          />
        ) : null}

        {screen === 3 ? (
          <GuidedFeatureAccordion features={features} system={system} onChange={setFeatures} />
        ) : null}

        {screen === 4 ? (
          <Stack gap='md'>
            <Text fw={600}>{label || 'Untitled Background'}</Text>
            <dl className={styles.summary}>
              <GuidedSummaryRow
                label='Benefits'
                value={String(
                  details.filter((item) => item.label || item.description).length || 'None yet'
                )}
              />
              <GuidedSummaryRow
                label='Starting gear'
                value={String(getStartingEquipmentItems(equipment).length || 'None yet')}
              />
              <GuidedSummaryRow label='Features' value={String(features.length || 'None yet')} />
            </dl>
          </Stack>
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

function BenefitEditor({
  details,
  onChange
}: {
  details: DetailDto[]
  onChange: (next: DetailDto[]) => void
}) {
  const detail = details[0] ?? createEmptyDetail(1)
  return (
    <Stack gap='md'>
      <TextInput
        label='Benefit name'
        placeholder='Skill, language, or contact'
        value={detail.label}
        onChange={(event) =>
          onChange([{ ...detail, label: event.currentTarget.value }, ...details.slice(1)])
        }
      />
      <RichTextEditor
        label='Benefit description'
        name={`background-benefit-${detail.id}-description`}
        placeholder='Explain what the character gets.'
        value={detail.description}
        onChange={(description) => onChange([{ ...detail, description }, ...details.slice(1)])}
      />
      {details.length > 1 ? (
        <Alert color='blue'>
          Additional advanced benefit entries are preserved. Edit them in Advanced.
        </Alert>
      ) : null}
    </Stack>
  )
}

function StartingGearEditor({
  equipment,
  onChange,
  systemId
}: {
  equipment: StartingEquipmentDto
  onChange: (next: StartingEquipmentDto) => void
  systemId?: string
}) {
  const equipmentOptions = useQuery(getEquipmentOptions(systemId))
  const items = getStartingEquipmentItems(equipment)
  const item = items.find(isGuidedStartingEquipmentItem) ?? createGuidedStartingEquipmentItem(1)
  const setItem = (patch: Partial<GuidedStartingEquipmentItem>) => {
    const nextItem = { ...item, ...patch }
    onChange(replaceStartingEquipmentItemInPlace(equipment, nextItem))
  }
  return (
    <Stack gap='md'>
      <Text c='dimmed'>
        Choose one unconditional starting item and its quantity. Choice groups remain available in
        Advanced.
      </Text>
      <Select
        data={equipmentOptions.data ?? []}
        disabled={!systemId || equipmentOptions.isPending || equipmentOptions.isError}
        label='Starting item'
        searchable
        placeholder={
          !systemId
            ? 'Select a System first'
            : equipmentOptions.isPending
              ? 'Loading equipment…'
              : equipmentOptions.isError
                ? 'Equipment unavailable'
                : 'Search equipment'
        }
        value={item.equipmentIds?.[0] ?? ''}
        onChange={(value) =>
          setItem({
            authoringModeKind: 'SELECTED',
            equipmentIds: value ? [value] : []
          })
        }
      />
      {equipmentOptions.isError ? (
        <Alert color='red' title='Equipment unavailable'>
          Starting equipment could not be loaded. Please try again later.
        </Alert>
      ) : null}
      <NumberInput
        label='Quantity'
        min={1}
        value={item.quantity}
        onChange={(value) => setItem({ quantity: typeof value === 'number' ? value : 1 })}
      />
      {equipment.sets.length > 1 || equipment.sets[0]?.groups.length > 1 ? (
        <Alert color='blue'>
          Additional starting-equipment choices are preserved. Edit them in Advanced.
        </Alert>
      ) : null}
    </Stack>
  )
}

function replaceStartingEquipmentItemInPlace(
  equipment: StartingEquipmentDto,
  replacement: StartingEquipmentItemDto
): StartingEquipmentDto {
  let replaced = false
  const sets = equipment.sets.map((set) => ({
    ...set,
    groups: set.groups.map((group) => ({
      ...group,
      options: group.options.map((option) => ({
        ...option,
        items: option.items.map((item) => {
          if (item.id !== replacement.id) return item
          replaced = true
          return replacement
        })
      }))
    }))
  }))

  if (replaced) return { ...equipment, sets }

  const firstSet = sets[0] ?? { id: crypto.randomUUID(), order: 1, groups: [] }
  const firstGroup = firstSet.groups[0] ?? { id: crypto.randomUUID(), order: 1, options: [] }
  const firstOption = firstGroup.options[0] ?? { id: crypto.randomUUID(), order: 1, items: [] }
  return {
    ...equipment,
    sets: [
      {
        ...firstSet,
        groups: [
          {
            ...firstGroup,
            options: [
              { ...firstOption, items: [...firstOption.items, replacement] },
              ...firstGroup.options.slice(1)
            ]
          },
          ...firstSet.groups.slice(1)
        ]
      },
      ...sets.slice(1)
    ]
  }
}

function hasUnsupportedContent(draft: GuidedValues<'background'>): boolean {
  const sets = draft.startingEquipment?.sets ?? []
  const hasEquipmentBranches = sets.some(
    (set) => set.groups.length > 1 || set.groups.some((group) => group.options.length > 1)
  )
  return (
    toDetails(draft.details).length > 1 ||
    hasEquipmentBranches ||
    sets.length > 1 ||
    (draft.proficiencies?.length ?? 0) > 0
  )
}

const TITLES = [
  'Name your background',
  'Add the benefits',
  'Choose starting gear',
  'Add features',
  'Review your background'
] as const
const DESCRIPTIONS = [
  'Give this background a memorable identity.',
  'Keep the common benefits clear and player-facing.',
  'Offer one simple starting item; advanced choices stay intact.',
  'Add named traits or actions players can scan.',
  'Check the essentials before saving.'
] as const
