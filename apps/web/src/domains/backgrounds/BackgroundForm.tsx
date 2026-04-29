import { useState, type ReactNode } from 'react'
import { ActionIcon, Alert, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import type {
  BackgroundAuthoredDto,
  BackgroundResponseDto,
  DetailDto,
  FeatureDto,
  NodeRuntimePathDto,
  ProficiencyGrantDto,
  StartingEquipmentDto
} from '@artificer-toolkit/schema'
import {
  type NodeMap,
  PROFICIENCY_NODE_MAP,
  STARTING_EQUIPMENT_ITEM_NODE_MAP
} from '@artificer-toolkit/shared'
import IEdit from '#assets/icons/IEdit'
import { IMinus } from '#assets/icons/IMinus'
import IX from '#assets/icons/IX'
import {
  AuthoredFormFooter,
  AuthoredFormHeader,
  AuthoredFormRoot,
  AuthoredFormSection,
  AuthoredFormSectionStack,
  AuthoredFormShell
} from '#components/Form/AuthoredFormLayout'
import { AuthoredFormStepNav } from '#components/Form/AuthoredFormStepNav'
import { FullscreenModal } from '#app/ui/overlays/Modal/FullscreenModal'
import {
  NodeMapRenderer,
  clearRuntimeFormPaths,
  getFirstErroredStep,
  getStepStatuses,
  requiredString,
  toRuntimeValues,
  validatorsFor,
  type ClearableRuntimeForm,
  type RuntimeNodeForm,
  useAppForm,
  useNodeRuntimeModel,
  withForm
} from '#components/Form/runtime'
import {
  createEmptyBackground,
  createEmptyDetail,
  createEmptyFeature,
  createEmptyProficiency,
  createEmptyStartingEquipment,
  createEmptyStartingEquipmentItem,
  getStartingEquipmentItems,
  normalizeBackgroundForSubmit,
  removeStartingEquipmentItem,
  upsertStartingEquipmentItem,
  type BackgroundFormStep
} from './backgroundAuthoring.utils'
import * as styles from './backgroundAuthoring.css'

type StartingEquipmentItemDto = StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]

const backgroundSteps = [
  {
    id: 'basics',
    label: 'Basics',
    description: 'Name and concept'
  },
  {
    id: 'content',
    label: 'Content',
    description: 'Features, proficiencies, and gear'
  },
  {
    id: 'details',
    label: 'Details',
    description: 'Roleplay prompts'
  }
] as const satisfies readonly AuthoredFormStepConfig[]

type AuthoredFormStepConfig = {
  id: BackgroundFormStep
  label: string
  description: string
}

const backgroundFormDefaults = createEmptyBackground({ systemId: '', userId: '' })

const backgroundStepFields = {
  basics: ['label', 'description'],
  content: ['proficiencies', 'features', 'startingEquipment'],
  details: ['details']
} satisfies Record<BackgroundFormStep, readonly string[]>

const BasicsStep = withForm({
  defaultValues: backgroundFormDefaults,
  props: {
    readOnly: false
  },
  render: function BasicsStepRender({ form, readOnly }) {
    return (
      <>
        <AuthoredFormSection
          description='Give players a clear name they can recognize when choosing this background.'
          title='Basics'
          titleId='background-basics-heading'
        >
          <div className={styles.singleField}>
            <form.AppField
              name='label'
              validators={validatorsFor(requiredString('Name'))}
            >
              {(field) => <field.TextField label='Name' readOnly={readOnly} required />}
            </form.AppField>
          </div>
        </AuthoredFormSection>
        <AuthoredFormSection
          description='Describe the place this background has in the world and why a player might pick it.'
          title='Description'
          titleId='background-description-heading'
        >
          <form.AppField
            name='description'
            validators={validatorsFor(requiredString('Description'))}
          >
            {(field) => <field.TextareaField label='Description' readOnly={readOnly} required />}
          </form.AppField>
        </AuthoredFormSection>
      </>
    )
  }
})

const ContentStep = withForm({
  defaultValues: backgroundFormDefaults,
  props: {
    readOnly: false,
    resolveRuntime: true
  },
  render: function ContentStepRender({ form, readOnly, resolveRuntime }) {
    return (
      <>
        <form.Subscribe selector={(state) => ({
          proficiencies: state.values.proficiencies ?? []
        })}
        >
          {({ proficiencies }) => (
            <ProficienciesSection
              items={proficiencies}
              readOnly={readOnly}
              resolveRuntime={resolveRuntime}
              onChange={(next) => form.setFieldValue('proficiencies', next)}
            />
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.values.features ?? []}>
          {(features) => (
            <FeaturesSection
              items={features}
              readOnly={readOnly}
              onChange={(next) => form.setFieldValue('features', next)}
            />
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.values.startingEquipment}>
          {(startingEquipment) => (
            <StartingEquipmentSection
              startingEquipment={startingEquipment}
              readOnly={readOnly}
              resolveRuntime={resolveRuntime}
              onChange={(next) => form.setFieldValue('startingEquipment', next)}
            />
          )}
        </form.Subscribe>
      </>
    )
  }
})

const DetailsStep = withForm({
  defaultValues: backgroundFormDefaults,
  props: {
    readOnly: false
  },
  render: function DetailsStepRender({ form, readOnly }) {
    return (
      <form.Subscribe selector={(state) => state.values.details ?? []}>
        {(details) => (
          <DetailsSection
            items={details}
            readOnly={readOnly}
            onChange={(next) => form.setFieldValue('details', next)}
          />
        )}
      </form.Subscribe>
    )
  }
})

export function BackgroundForm({
  mode,
  initialBackground,
  response,
  systemId,
  userId,
  resolveRuntime = true,
  onSubmit,
  onCopy
}: {
  mode: 'create' | 'view' | 'edit'
  initialBackground?: BackgroundAuthoredDto
  response?: BackgroundResponseDto
  systemId: string
  userId: string
  resolveRuntime?: boolean
  onSubmit: (background: BackgroundAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState<BackgroundFormStep>('basics')
  const readOnly = mode === 'view' || response?.permissions.canEdit === false
  const background = initialBackground
    ?? response?.item
    ?? createEmptyBackground({ systemId, userId })
  const form = useAppForm({
    defaultValues: background,
    onSubmit: async ({ value }) => {
      if (readOnly) return
      await onSubmit(normalizeBackgroundForSubmit(value))
    }
  })
  const title = getBackgroundStepTitle(activeStep)

  async function handleFormSubmit() {
    await form.handleSubmit()
    const firstErroredStep = getFirstErroredStep(getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: backgroundStepFields }), backgroundSteps)
    if (firstErroredStep) setActiveStep(firstErroredStep)
  }

  async function handleNextStep() {
    await form.validate('submit')
    const statuses = getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: backgroundStepFields })
    if (statuses[activeStep] === 'error') return
    setActiveStep(getNextStep(activeStep))
  }

  return (
    <AuthoredFormRoot>
      <form.Subscribe selector={(state) => getStepStatuses({ fieldMeta: state.fieldMeta, stepFields: backgroundStepFields })}>
        {(stepStatuses) => (
          <AuthoredFormStepNav
            activeStep={activeStep}
            ariaLabel='Background form sections'
            onStepChange={setActiveStep}
            stepStatuses={stepStatuses}
            steps={backgroundSteps}
          />
        )}
      </form.Subscribe>

      <AuthoredFormHeader
        action={readOnly && response?.permissions.canCopy
          ? (
              <Button onClick={onCopy}>Duplicate to edit</Button>
            )
          : null}
        eyebrow={mode !== 'create' ? background.label || 'Untitled Background' : undefined}
        title={title}
      />

      {readOnly
        ? (
            <Alert color='cyan'>
              This background is locked for direct editing. Duplicate it to make your own draft.
            </Alert>
          )
        : null}

      <form.AppForm>
        <AuthoredFormShell
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void handleFormSubmit()
          }}
        >
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <BackgroundRuntimeBridge
                enabled={resolveRuntime}
                values={values}
                onClearPaths={(paths) => clearRuntimeFormPaths(form, paths)}
              />
            )}
          </form.Subscribe>

          <AuthoredFormSectionStack>
            {activeStep === 'basics'
              ? (
                  <BasicsStep form={form} readOnly={readOnly} />
                )
              : null}
            {activeStep === 'content'
              ? (
                  <ContentStep form={form} readOnly={readOnly} resolveRuntime={resolveRuntime} />
                )
              : null}
            {activeStep === 'details'
              ? (
                  <DetailsStep form={form} readOnly={readOnly} />
                )
              : null}
          </AuthoredFormSectionStack>

          <AuthoredFormFooter>
            <Button variant='default' onClick={() => navigate({ to: '/backgrounds' })}>
              Cancel
            </Button>
            <Group justify='flex-end'>
              <Button
                type='button'
                variant='default'
                disabled={activeStep === 'basics'}
                onClick={() => setActiveStep(getPreviousStep(activeStep))}
              >
                Back
              </Button>
              {activeStep === 'details'
                ? (
                    <form.SubmitButton label={mode === 'create' ? 'Create Background' : 'Save Background'} disabled={readOnly} />
                  )
                : (
                    <Button type='button' onClick={() => void handleNextStep()}>
                      Next
                    </Button>
                  )}
            </Group>
          </AuthoredFormFooter>
        </AuthoredFormShell>
      </form.AppForm>
    </AuthoredFormRoot>
  )
}

function BackgroundRuntimeBridge({
  values,
  enabled,
  onClearPaths
}: {
  values: BackgroundAuthoredDto
  enabled: boolean
  onClearPaths: (paths: readonly NodeRuntimePathDto[]) => void
}) {
  useNodeRuntimeModel({
    mapId: 'background',
    values: toRuntimeValues(values),
    enabled,
    debounceMs: 150,
    onClearPaths
  })

  return null
}

function DetailsSection({
  items,
  readOnly,
  onChange
}: {
  items: DetailDto[]
  readOnly: boolean
  onChange: (items: DetailDto[]) => void
}) {
  const [editing, setEditing] = useState<DetailDto | null>(null)

  return (
    <CollectionSection
      title='Suggested Characteristics'
      description='Add roleplay prompts players can choose from when they bring this background to the table.'
      addLabel='Add characteristic'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyDetail(items.length + 1))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No roleplay prompts yet.</Text> : null}
      {items.map((item) => (
        <CollectionRow
          key={item.id}
          title={item.label || `Characteristic ${item.order}`}
          description={item.description}
          readOnly={readOnly}
          onEdit={() => setEditing(item)}
          onRemove={() => onChange(items.filter((current) => current.id !== item.id))}
        />
      ))}
      <DetailEditorModal
        item={editing}
        opened={editing !== null}
        readOnly={readOnly}
        onClose={() => setEditing(null)}
        onSave={(item) => {
          onChange(upsertById(items, item))
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

function ProficienciesSection({
  items,
  readOnly,
  resolveRuntime,
  onChange
}: {
  items: ProficiencyGrantDto[]
  readOnly: boolean
  resolveRuntime: boolean
  onChange: (items: ProficiencyGrantDto[]) => void
}) {
  const [editing, setEditing] = useState<ProficiencyGrantDto | null>(null)

  return (
    <CollectionSection
      title='Proficiencies'
      description='Choose the skills, tools, languages, or other training this background grants.'
      addLabel='Add proficiency'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyProficiency(items.length + 1))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No proficiencies added yet.</Text> : null}
      {items.map((item) => (
        <CollectionRow
          key={item.id}
          title={formatProficiencyTitle(item)}
          description={formatProficiencyDescription(item)}
          readOnly={readOnly}
          onEdit={() => setEditing(item)}
          onRemove={() => onChange(items.filter((current) => current.id !== item.id))}
        />
      ))}
      <ProficiencyEditorModal
        item={editing}
        opened={editing !== null}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        onClose={() => setEditing(null)}
        onSave={(item) => {
          onChange(upsertById(items, item))
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

function FeaturesSection({
  items,
  readOnly,
  onChange
}: {
  items: FeatureDto[]
  readOnly: boolean
  onChange: (items: FeatureDto[]) => void
}) {
  const [editing, setEditing] = useState<FeatureDto | null>(null)

  return (
    <CollectionSection
      title='Features'
      description='Describe the signature benefit that makes this background useful in play.'
      addLabel='Add feature'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyFeature(items.length + 1))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No background feature added yet.</Text> : null}
      {items.map((item) => (
        <CollectionRow
          key={item.id}
          title={item.label || `Feature ${item.order}`}
          description={item.description}
          readOnly={readOnly}
          onEdit={() => setEditing(item)}
          onRemove={() => onChange(items.filter((current) => current.id !== item.id))}
        />
      ))}
      <FeatureEditorModal
        item={editing}
        opened={editing !== null}
        readOnly={readOnly}
        onClose={() => setEditing(null)}
        onSave={(item) => {
          onChange(upsertById(items, item))
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

function StartingEquipmentSection({
  startingEquipment,
  readOnly,
  resolveRuntime,
  onChange
}: {
  startingEquipment?: StartingEquipmentDto
  readOnly: boolean
  resolveRuntime: boolean
  onChange: (equipment: StartingEquipmentDto) => void
}) {
  const [editing, setEditing] = useState<StartingEquipmentItemDto | null>(null)
  const equipment = startingEquipment ?? createEmptyStartingEquipment()
  const items = getStartingEquipmentItems(equipment)

  return (
    <CollectionSection
      title='Starting Equipment'
      description='Set the gear, coin, or choices a character starts with when they take this background.'
      addLabel='Add starting equipment'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyStartingEquipmentItem(items.length + 1))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No starting equipment yet.</Text> : null}
      {items.map((item) => (
        <CollectionRow
          key={item.id}
          title={formatStartingEquipmentTitle(item)}
          description={formatStartingEquipmentDescription(item)}
          readOnly={readOnly}
          onEdit={() => setEditing(item)}
          onRemove={() => onChange(removeStartingEquipmentItem(equipment, item.id))}
        />
      ))}
      <StartingEquipmentItemEditorModal
        item={editing}
        opened={editing !== null}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        onClose={() => setEditing(null)}
        onSave={(item) => {
          onChange(upsertStartingEquipmentItem(equipment, item))
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

function CollectionSection({
  title,
  description,
  addLabel,
  readOnly,
  onAdd,
  children
}: {
  title: string
  description: string
  addLabel: string
  readOnly: boolean
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <AuthoredFormSection
      description={description}
      title={title}
      titleId={`${title.toLowerCase().replaceAll(' ', '-')}-heading`}
    >
      <div className={styles.collectionList}>{children}</div>
      {!readOnly
        ? (
            <Button className={styles.sectionAction} type='button' onClick={onAdd}>
              {addLabel}
            </Button>
          )
        : null}
    </AuthoredFormSection>
  )
}

function CollectionRow({
  title,
  description,
  readOnly,
  onEdit,
  onRemove
}: {
  title: string
  description?: string
  readOnly: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div className={styles.collectionRow}>
      <div>
        <Text className={styles.rowTitle}>{title}</Text>
        {description ? <Text className={styles.rowDescription}>{description}</Text> : null}
      </div>
      <div className={styles.rowActions}>
        <Tooltip label={readOnly ? 'View' : 'Edit'} withArrow>
          <ActionIcon aria-label={readOnly ? `View ${title}` : `Edit ${title}`} variant='subtle' onClick={onEdit}>
            <IEdit />
          </ActionIcon>
        </Tooltip>
        {!readOnly
          ? (
              <Tooltip label='Remove' withArrow>
                <ActionIcon aria-label={`Remove ${title}`} variant='subtle' onClick={onRemove}>
                  <IMinus />
                </ActionIcon>
              </Tooltip>
            )
          : null}
      </div>
    </div>
  )
}

function DetailEditorModal({
  item,
  opened,
  readOnly,
  onClose,
  onSave
}: {
  item: DetailDto | null
  opened: boolean
  readOnly: boolean
  onClose: () => void
  onSave: (item: DetailDto) => void
}) {
  const form = useAppForm({
    defaultValues: item ?? createEmptyDetail(1),
    onSubmit: async ({ value }) => onSave(value)
  })

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='background-detail-editor-heading'>
      <EditorShell
        title={readOnly ? 'View Characteristic' : 'Edit Characteristic'}
        titleId='background-detail-editor-heading'
        readOnly={readOnly}
        onClose={onClose}
        onSubmit={() => form.handleSubmit()}
      >
        <form.AppForm>
          <Stack className={styles.sectionStack}>
            <form.AppField name='label'>
              {(field) => <field.TextField label='Name' readOnly={readOnly} />}
            </form.AppField>
            <form.AppField name='description'>
              {(field) => <field.TextareaField label='Description' readOnly={readOnly} />}
            </form.AppField>
            <form.AppField name='order'>
              {(field) => <field.NumberField label='Order' readOnly={readOnly} />}
            </form.AppField>
          </Stack>
        </form.AppForm>
      </EditorShell>
    </FullscreenModal>
  )
}

function FeatureEditorModal({
  item,
  opened,
  readOnly,
  onClose,
  onSave
}: {
  item: FeatureDto | null
  opened: boolean
  readOnly: boolean
  onClose: () => void
  onSave: (item: FeatureDto) => void
}) {
  const form = useAppForm({
    defaultValues: item ?? createEmptyFeature(1),
    onSubmit: async ({ value }) => onSave(value)
  })

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='background-feature-editor-heading'>
      <EditorShell
        title={readOnly ? 'View Feature' : 'Edit Feature'}
        titleId='background-feature-editor-heading'
        readOnly={readOnly}
        onClose={onClose}
        onSubmit={() => form.handleSubmit()}
      >
        <form.AppForm>
          <Stack className={styles.sectionStack}>
            <form.AppField name='label'>
              {(field) => <field.TextField label='Name' readOnly={readOnly} />}
            </form.AppField>
            <form.AppField name='description'>
              {(field) => <field.TextareaField label='Description' readOnly={readOnly} />}
            </form.AppField>
            <form.AppField name='order'>
              {(field) => <field.NumberField label='Order' readOnly={readOnly} />}
            </form.AppField>
          </Stack>
        </form.AppForm>
      </EditorShell>
    </FullscreenModal>
  )
}

function ProficiencyEditorModal({
  item,
  opened,
  readOnly,
  resolveRuntime,
  onClose,
  onSave
}: {
  item: ProficiencyGrantDto | null
  opened: boolean
  readOnly: boolean
  resolveRuntime: boolean
  onClose: () => void
  onSave: (item: ProficiencyGrantDto) => void
}) {
  const form = useAppForm({
    defaultValues: item ?? createEmptyProficiency(1),
    onSubmit: async ({ value }) => onSave(value)
  })

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='background-proficiency-editor-heading'>
      <EditorShell
        title={readOnly ? 'View Proficiency' : 'Edit Proficiency'}
        titleId='background-proficiency-editor-heading'
        readOnly={readOnly}
        onClose={onClose}
        onSubmit={() => form.handleSubmit()}
      >
        <form.AppForm>
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <RuntimeNodeEditor
                enabled={resolveRuntime}
                form={form}
                mapId='proficiencyGrant'
                nodeMap={PROFICIENCY_NODE_MAP as unknown as NodeMap<ProficiencyGrantDto>}
                readOnly={readOnly}
                values={values}
              />
            )}
          </form.Subscribe>
        </form.AppForm>
      </EditorShell>
    </FullscreenModal>
  )
}

function StartingEquipmentItemEditorModal({
  item,
  opened,
  readOnly,
  resolveRuntime,
  onClose,
  onSave
}: {
  item: StartingEquipmentItemDto | null
  opened: boolean
  readOnly: boolean
  resolveRuntime: boolean
  onClose: () => void
  onSave: (item: StartingEquipmentItemDto) => void
}) {
  const form = useAppForm({
    defaultValues: item ?? createEmptyStartingEquipmentItem(1),
    onSubmit: async ({ value }) => onSave(value)
  })

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='background-equipment-editor-heading'>
      <EditorShell
        title={readOnly ? 'View Starting Equipment' : 'Edit Starting Equipment'}
        titleId='background-equipment-editor-heading'
        readOnly={readOnly}
        onClose={onClose}
        onSubmit={() => form.handleSubmit()}
      >
        <form.AppForm>
          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <RuntimeNodeEditor
                enabled={resolveRuntime}
                form={form}
                mapId='startingEquipmentItem'
                nodeMap={STARTING_EQUIPMENT_ITEM_NODE_MAP as unknown as NodeMap<StartingEquipmentItemDto>}
                readOnly={readOnly}
                values={values}
              />
            )}
          </form.Subscribe>
        </form.AppForm>
      </EditorShell>
    </FullscreenModal>
  )
}

function RuntimeNodeEditor<TValues extends object>({
  enabled,
  form,
  mapId,
  nodeMap,
  readOnly,
  values
}: {
  enabled: boolean
  form: RuntimeNodeForm & ClearableRuntimeForm<TValues>
  mapId: string
  nodeMap: NodeMap<TValues>
  readOnly: boolean
  values: TValues
}) {
  const runtimeModel = useNodeRuntimeModel({
    mapId,
    values: toRuntimeValues(values),
    enabled,
    debounceMs: 100,
    onClearPaths: (paths) => clearRuntimeFormPaths(form, paths)
  })

  return (
    <NodeMapRenderer
      form={form}
      nodeMap={nodeMap}
      readOnly={readOnly}
      runtimeModel={runtimeModel}
    />
  )
}

function EditorShell({
  children,
  title,
  titleId,
  readOnly,
  onClose,
  onSubmit
}: {
  children: ReactNode
  title: string
  titleId: string
  readOnly: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <form
      className={styles.modalShell}
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onSubmit()
      }}
    >
      <header className={styles.modalHeader}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <ActionIcon aria-label='Close editor' variant='subtle' onClick={onClose}>
          <IX />
        </ActionIcon>
      </header>
      <main className={styles.modalContent}>{children}</main>
      <footer className={styles.modalFooter}>
        <Button type='button' variant='default' onClick={onClose}>Back</Button>
        {!readOnly ? <Button type='submit'>Save</Button> : null}
      </footer>
    </form>
  )
}

function upsertById<TItem extends { id: string }>(items: TItem[], item: TItem): TItem[] {
  const index = items.findIndex((current) => current.id === item.id)
  if (index === -1) return [...items, item]
  return items.map((current) => current.id === item.id ? item : current)
}

function getBackgroundStepTitle(step: BackgroundFormStep) {
  if (step === 'content') return 'Background Content'
  if (step === 'details') return 'Background Details'
  return 'Background Basics'
}

function getNextStep(step: BackgroundFormStep): BackgroundFormStep {
  if (step === 'basics') return 'content'
  return 'details'
}

function getPreviousStep(step: BackgroundFormStep): BackgroundFormStep {
  if (step === 'details') return 'content'
  return 'basics'
}

function formatProficiencyTitle(item: ProficiencyGrantDto): string {
  const kind = formatCode(item.proficiencyKind).toLowerCase()
  if (item.selectionKind === 'CHOSEN') {
    const count = item.count ?? 1
    return `Choose ${count} ${kind} ${count === 1 ? 'proficiency' : 'proficiencies'}`
  }

  return `${formatCode(item.proficiencyKind)} proficiency`
}

function formatProficiencyDescription(item: ProficiencyGrantDto): string {
  const target = item.authoringModeKind === 'SELECTED' ? 'from selected options' : `from any ${formatCode(item.proficiencyKind).toLowerCase()} option`
  return item.selectionKind === 'CHOSEN'
    ? `Player chooses ${item.count ?? 1} ${target}.`
    : `Granted automatically ${target}.`
}

function formatStartingEquipmentTitle(item: StartingEquipmentItemDto): string {
  return item.startingEquipmentKind === 'CURRENCY' ? 'Currency' : 'Equipment'
}

function formatStartingEquipmentDescription(item: StartingEquipmentItemDto): string {
  if (item.startingEquipmentKind === 'CURRENCY') {
    return item.currencies.map((currency) => `${currency.amount} ${currency.currencyId}`).join(', ') || 'No currency selected yet.'
  }

  const amount = item.selectionKind === 'CHOSEN'
    ? `Player chooses ${item.count ?? 1}`
    : `Grants ${item.quantity ?? 1}`
  const target = item.authoringModeKind === 'SELECTED'
    ? `${item.equipmentIds.length} selected option${item.equipmentIds.length === 1 ? '' : 's'}`
    : 'matching equipment'

  return `${amount} from ${target}.`
}

function formatCode(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}
