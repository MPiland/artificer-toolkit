import { useEffect, useState } from 'react'
import { Alert, NumberInput, Select, Stack } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-form'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { ProficiencyGrantDto } from '@artificer-toolkit/schema/grants/proficiency'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared/startingEquipment'
import { CLASS_CATEGORY } from '@artificer-toolkit/shared/core'
import { getEquipmentOptions } from '#app/data/equipment/options'
import { getNodeRuntimeResolve } from '#app/data/nodeRuntime/queries'
import { withForm } from '#forms/app-form/AppForm'
import { GuidedAuthoringFrame } from '#forms/guided/GuidedAuthoringFrame'
import { AuthoringArtworkControl } from '#forms/AuthoringArtworkControl'
import { GuidedFeatureAccordion } from '#forms/guided/GuidedFeatureAccordion'
import {
  createGuidedStartingEquipmentItem,
  isGuidedStartingEquipmentItem
} from '#forms/guided/guidedStartingEquipment'
import type { GuidedDomainAuthoringProps } from '#forms/guided/guidedAuthoring.types'
import { GuidedSummaryRow } from '#forms/guided/GuidedSummaryRow'
import {
  createEmptyStartingEquipment,
  getStartingEquipmentItems,
  upsertStartingEquipmentItem
} from '#forms/rendering/startingEquipmentDefaults'
import * as styles from '#forms/guided/guidedAuthoring.css'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import { createEmptySpellcasting } from '../classAuthoring.utils'
import { EMPTY_GUIDED_FORM_VALUES, toFeatures, toSelectOption } from '#forms/guided/guidedValues'
import { isRecord } from '#forms/utils/valueGuards'

export const GuidedClassAuthoring = withForm({
  defaultValues: EMPTY_GUIDED_FORM_VALUES,
  props: {} as GuidedDomainAuthoringProps,
  render: function RenderGuidedClassAuthoring({
    form,
    onAdvanced,
    onStateChange,
    session,
    system
  }) {
    const [step, setStep] = useState(0)
    const values = useSelector(form.store, (state) => readClassValues(state.values))
    const isSubclass = values.category === CLASS_CATEGORY.SUBCLASS
    const steps = isSubclass ? SUBCLASS_STEPS : BASE_STEPS
    const categoryLocked = session.mode === 'edit'
    const parentClasses = useQuery({
      ...getNodeRuntimeResolve(
        {
          mapId: 'class',
          systemId: session.systemId ?? '',
          values: { category: CLASS_CATEGORY.SUBCLASS }
        },
        isSubclass && Boolean(session.systemId)
      ),
      select: (response) =>
        response.steps
          .flatMap((step) => step.sections)
          .flatMap((section) => section.nodes)
          .flatMap((node) =>
            node.kind === 'INPUT' &&
            'options' in node &&
            node.path.length === 1 &&
            node.path[0] === 'parentClassId'
              ? node.options
              : []
          )
    })
    const equipment = useQuery(
      getEquipmentOptions(!isSubclass && step === 2 ? session.systemId : undefined)
    )

    if (step >= steps.length) setStep(0)
    useEffect(() => {
      onStateChange({
        isReview: step === steps.length - 1,
        showPreview: session.mode === 'edit' || step > 0 || Boolean(values.label)
      })
    }, [onStateChange, session.mode, step, steps.length, values.label])

    const setFeatures = (features: FeatureDto[]) => {
      form.setFieldValue(toTypedAuthoringFieldName<object>(undefined, ['features']), features)
    }
    const setProficiencies = (skillIds: string[]) => {
      form.setFieldValue(
        toTypedAuthoringFieldName<object>(undefined, ['proficiencies']),
        replaceSimpleSkillProficiency(values.proficiencies, skillIds)
      )
    }
    const setStartingItem = (equipmentId: string, quantity: number) => {
      const startingEquipment = values.startingEquipment ?? createEmptyStartingEquipment()
      const item = values.startingItem ?? createGuidedStartingEquipmentItem(1)
      form.setFieldValue(
        toTypedAuthoringFieldName<object>(undefined, ['startingEquipment']),
        upsertStartingEquipmentItem(startingEquipment, {
          ...item,
          authoringModeKind: 'SELECTED',
          equipmentIds: equipmentId ? [equipmentId] : [],
          quantity
        })
      )
    }

    const canContinue = Boolean(
      values.label && values.category && (!isSubclass || values.parentClassId)
    )
    const title = isSubclass ? SUBCLASS_TITLES[step] : BASE_TITLES[step]
    const description = isSubclass ? SUBCLASS_DESCRIPTIONS[step] : BASE_DESCRIPTIONS[step]

    return (
      <GuidedAuthoringFrame
        canContinue={canContinue}
        description={description}
        domainLabel='Class'
        onAdvanced={onAdvanced}
        onBack={step > 0 ? () => setStep((current) => current - 1) : undefined}
        onNext={step < steps.length - 1 ? () => setStep((current) => current + 1) : undefined}
        stepIndex={step}
        steps={steps}
        title={title}
      >
        {step === 0 ? (
          <Stack gap='lg'>
            {categoryLocked ? (
              <Alert color='blue'>
                This draft remains a {isSubclass ? 'subclass' : 'base class'} in Guided. Switch to
                Advanced to change its structure.
              </Alert>
            ) : null}
            <div className={styles.identityRow}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['label'])}>
                {(field) => <field.TextField label='Class name' required />}
              </form.AppField>
              <AuthoringArtworkControl />
            </div>
            <div className={styles.fields}>
              <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['category'])}>
                {(field) => (
                  <field.SelectField
                    data={[
                      { label: 'Base class', value: CLASS_CATEGORY.BASE },
                      { label: 'Subclass', value: CLASS_CATEGORY.SUBCLASS }
                    ]}
                    label='Class type'
                    readOnly={categoryLocked}
                    required
                  />
                )}
              </form.AppField>
              {isSubclass ? (
                <form.AppField
                  name={toTypedAuthoringFieldName<object>(undefined, ['parentClassId'])}
                >
                  {(field) => (
                    <field.SelectField
                      data={parentClasses.data ?? []}
                      error={
                        parentClasses.isError ? 'Parent classes could not be loaded.' : undefined
                      }
                      label='Parent class'
                      placeholder={
                        !session.systemId
                          ? 'Select a System first'
                          : parentClasses.isPending
                            ? 'Loading classes…'
                            : parentClasses.isError
                              ? 'Parent classes unavailable'
                              : 'Choose a base class'
                      }
                      readOnly={
                        !session.systemId || parentClasses.isPending || parentClasses.isError
                      }
                      required
                    />
                  )}
                </form.AppField>
              ) : null}
              <div className={styles.full}>
                <form.AppField name={toTypedAuthoringFieldName<object>(undefined, ['description'])}>
                  {(field) => <field.RichTextField label='Description' />}
                </form.AppField>
              </div>
            </div>
          </Stack>
        ) : null}

        {!isSubclass && step === 1 ? (
          <div className={styles.fields}>
            <form.AppField
              name={toTypedAuthoringFieldName<object>(undefined, ['hitpoint', 'dieConfig'])}
            >
              {(field) => (
                <field.SelectField
                  data={['1d6', '1d8', '1d10', '1d12'].map((value) => ({ label: value, value }))}
                  label='Hit die'
                  required
                />
              )}
            </form.AppField>
            <form.AppField
              name={toTypedAuthoringFieldName<object>(undefined, ['subclassSelectionLevel'])}
            >
              {(field) => (
                <field.NumberField label='Subclass choice level' minimum={1} maximum={20} />
              )}
            </form.AppField>
          </div>
        ) : null}

        {!isSubclass && step === 2 ? (
          <Stack gap='lg'>
            {values.advancedProficiencyCount || values.complexStartingEquipment ? (
              <Alert color='blue'>
                Advanced proficiency rules and equipment choices remain preserved. Guided edits only
                the simple skill list and first unconditional item.
              </Alert>
            ) : null}
            <Select
              clearable
              data={system.skills.map(toSelectOption)}
              label='Skill proficiency'
              placeholder='Add one common skill proficiency'
              searchable
              value={values.skillIds[0] ?? null}
              onChange={(value) => setProficiencies(value ? [value] : [])}
            />
            <div className={styles.fields}>
              <Select
                data={equipment.data ?? []}
                disabled={!session.systemId || equipment.isPending || equipment.isError}
                label='Starting item'
                placeholder={
                  !session.systemId
                    ? 'Select a System first'
                    : equipment.isPending
                      ? 'Loading equipment…'
                      : equipment.isError
                        ? 'Equipment unavailable'
                        : 'Search equipment'
                }
                searchable
                value={values.startingItem?.equipmentIds?.[0] ?? null}
                onChange={(value) =>
                  setStartingItem(value ?? '', values.startingItem?.quantity ?? 1)
                }
              />
              <NumberInput
                label='Quantity'
                min={1}
                value={values.startingItem?.quantity ?? 1}
                onChange={(value) =>
                  setStartingItem(
                    values.startingItem?.equipmentIds?.[0] ?? '',
                    typeof value === 'number' ? value : 1
                  )
                }
              />
            </div>
            {equipment.isError ? (
              <Alert color='red' title='Equipment unavailable'>
                Starting equipment could not be loaded. Please try again later.
              </Alert>
            ) : null}
          </Stack>
        ) : null}

        {step === (isSubclass ? 1 : 3) ? (
          <GuidedFeatureAccordion
            features={values.features}
            showAvailableLevel
            system={system}
            onChange={setFeatures}
          />
        ) : null}

        {!isSubclass && step === 4 ? (
          <Stack gap='lg'>
            {values.complexSpellcasting ? (
              <Alert color='blue'>
                Full slot, preparation, and resource tables are preserved. Switch to Advanced to
                change those tables.
              </Alert>
            ) : null}
            <Select
              data={[
                { label: 'No spellcasting', value: 'no' },
                { label: 'This class casts spells', value: 'yes' }
              ]}
              disabled={values.complexSpellcasting}
              label='Does this class cast spells?'
              value={values.hasSpellcasting ? 'yes' : 'no'}
              onChange={(value) =>
                form.setFieldValue(
                  toTypedAuthoringFieldName<object>(undefined, ['spellcasting']),
                  value === 'yes' ? (values.spellcasting ?? createEmptySpellcasting()) : undefined
                )
              }
            />
            {values.hasSpellcasting ? (
              <div className={styles.fields}>
                <form.AppField
                  name={toTypedAuthoringFieldName<object>(undefined, ['spellcasting', 'magicName'])}
                >
                  {(field) => <field.TextField label='What is the magic called?' />}
                </form.AppField>
                <form.AppField
                  name={toTypedAuthoringFieldName<object>(undefined, ['spellcasting', 'ability'])}
                >
                  {(field) => (
                    <field.SelectField data={ABILITY_OPTIONS} label='Spellcasting ability' />
                  )}
                </form.AppField>
                <form.AppField
                  name={toTypedAuthoringFieldName<object>(undefined, [
                    'spellcasting',
                    'maxSpellLevel'
                  ])}
                >
                  {(field) => (
                    <field.NumberField label='Maximum spell level' minimum={1} maximum={9} />
                  )}
                </form.AppField>
              </div>
            ) : null}
          </Stack>
        ) : null}

        {step === steps.length - 1 ? (
          <Stack gap='md'>
            <dl className={styles.summary}>
              <GuidedSummaryRow label='Name' value={values.label || 'Untitled Class'} />
              <GuidedSummaryRow label='Type' value={isSubclass ? 'Subclass' : 'Base class'} />
              <GuidedSummaryRow label='Features' value={String(values.features.length)} />
              {!isSubclass ? (
                <GuidedSummaryRow
                  label='Spellcasting'
                  value={values.hasSpellcasting ? 'Yes' : 'No'}
                />
              ) : null}
            </dl>
          </Stack>
        ) : null}
      </GuidedAuthoringFrame>
    )
  }
})

function readClassValues(values: object) {
  const record: Record<string, unknown> = isRecord(values) ? values : {}
  const proficiencies = Array.isArray(record.proficiencies)
    ? record.proficiencies.filter(isProficiencyGrant)
    : []
  const startingEquipment = isStartingEquipment(record.startingEquipment)
    ? record.startingEquipment
    : undefined
  const startingItems = getStartingEquipmentItems(startingEquipment)
  const spellcasting = isRecord(record.spellcasting) ? record.spellcasting : undefined
  return {
    advancedProficiencyCount: proficiencies.filter((grant) => !isSimpleSkillGrant(grant)).length,
    category:
      record.category === CLASS_CATEGORY.BASE || record.category === CLASS_CATEGORY.SUBCLASS
        ? record.category
        : '',
    complexSpellcasting: Boolean(
      spellcasting &&
      ((Array.isArray(spellcasting.spellLimits) && spellcasting.spellLimits.length) ||
        spellcasting.prepareLimit ||
        (Array.isArray(spellcasting.attributes) && spellcasting.attributes.length))
    ),
    complexStartingEquipment: Boolean(
      startingEquipment &&
      (startingEquipment.sets.length > 1 ||
        startingEquipment.sets.some(
          (set) => set.groups.length > 1 || set.groups.some((group) => group.options.length > 1)
        ))
    ),
    features: toFeatures(record.features),
    hasSpellcasting: Boolean(spellcasting),
    label: typeof record.label === 'string' ? record.label.trim() : '',
    parentClassId: typeof record.parentClassId === 'string' ? record.parentClassId : '',
    proficiencies,
    skillIds: proficiencies.find(isSimpleSkillGrant)?.skillIds ?? [],
    spellcasting,
    startingEquipment,
    startingItem: startingItems.find(isGuidedStartingEquipmentItem)
  }
}

function replaceSimpleSkillProficiency(
  proficiencies: ProficiencyGrantDto[],
  skillIds: string[]
): ProficiencyGrantDto[] {
  const existing = proficiencies.find(isSimpleSkillGrant)
  const remaining = proficiencies.filter((grant) => grant !== existing)
  if (!skillIds.length) return remaining
  const next: ProficiencyGrantDto = {
    ...(existing ?? {
      grantKind: 'PROFICIENCY_GRANT',
      id: crypto.randomUUID(),
      order: proficiencies.length + 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      level: 'FULL'
    }),
    authoringModeKind: 'SELECTED',
    proficiencyKind: 'SKILL',
    skillIds
  }
  return [...remaining, next]
}

function isSimpleSkillGrant(grant: ProficiencyGrantDto) {
  return grant.proficiencyKind === 'SKILL' && grant.authoringModeKind === 'SELECTED'
}

function isStartingEquipment(value: unknown): value is StartingEquipmentDto {
  return isRecord(value) && Array.isArray(value.sets)
}

function isProficiencyGrant(value: unknown): value is ProficiencyGrantDto {
  return isRecord(value) && value.grantKind === 'PROFICIENCY_GRANT'
}

const BASE_STEPS = [
  'Basics',
  'Chassis',
  'Proficiencies and gear',
  'Features',
  'Spellcasting',
  'Review'
] as const
const SUBCLASS_STEPS = ['Basics', 'Features', 'Review'] as const
const BASE_TITLES = [
  'Name the class',
  'Build the chassis',
  'Choose proficiencies and gear',
  'Add class features',
  'Set up spellcasting',
  'Review your class'
] as const
const SUBCLASS_TITLES = [
  'Name the subclass',
  'Add subclass features',
  'Review your subclass'
] as const
const BASE_DESCRIPTIONS = [
  'Choose a base class and explain its place in the game.',
  'Set the durable numbers that define its basic shape.',
  'Choose a simple skill proficiency and one unconditional starting item.',
  'Add the level features that form the class progression.',
  'Describe common spellcasting. Full progression tables remain Advanced.',
  'Check the chassis before saving or activating.'
] as const
const SUBCLASS_DESCRIPTIONS = [
  'Choose the parent class and explain this subclass path.',
  'Add the level features that distinguish the subclass.',
  'Check the essentials before saving or activating.'
] as const
const ABILITY_OPTIONS = [
  'STRENGTH',
  'DEXTERITY',
  'CONSTITUTION',
  'INTELLIGENCE',
  'WISDOM',
  'CHARISMA'
].map((value) => ({
  label: value.charAt(0) + value.slice(1).toLowerCase(),
  value
}))
