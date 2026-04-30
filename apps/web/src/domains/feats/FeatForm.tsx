import { useState, type ReactNode } from 'react'
import { ActionIcon, Alert, Button, Group, Stack, Text, Tooltip } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import type {
  ChargeDto,
  FeatAuthoredDto,
  FeatResponseDto,
  FeatureDto,
  NodeRuntimePathDto
} from '@artificer-toolkit/schema'
import {
  CHARGE_NODE_MAP,
  FEAT_GRANTS_NODE_MAP,
  FEAT_PREREQUISITES_NODE_MAP,
  type NodeMap
} from '@artificer-toolkit/shared'
import IEdit from '#assets/icons/IEdit'
import { IExternalLink } from '#assets/icons/IExternalLink'
import { IMinus } from '#assets/icons/IMinus'
import IX from '#assets/icons/IX'
import { EffectEditorFieldGroup, type EffectEditorReferenceData } from '#components/EffectEditor'
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
  useAppForm,
  useNodeRuntimeModel,
  type ClearableRuntimeForm,
  type RuntimeNodeForm,
  withForm
} from '#components/Form/runtime'
import {
  createEmptyCharge,
  createEmptyFeat,
  createEmptyFeature,
  createEmptyGrants,
  createEmptyPrerequisites,
  normalizeFeatForSubmit,
  upsertById,
  type FeatFormStep
} from './featAuthoring.utils'
import * as styles from './featAuthoring.css'

type FeatPrerequisites = NonNullable<FeatAuthoredDto['prerequisites']>
type FeatGrants = NonNullable<FeatAuthoredDto['grants']>

const featSteps = [
  {
    id: 'basics',
    label: 'Basics',
    description: 'Name, description, and player-facing details'
  },
  {
    id: 'requirements',
    label: 'Requirements',
    description: 'Character prerequisites and unlock rules'
  },
  {
    id: 'mechanics',
    label: 'Mechanics',
    description: 'Effects, charges, and grants'
  },
  {
    id: 'features',
    label: 'Features',
    description: 'Feat-owned feature basics'
  }
] as const satisfies readonly {
  id: FeatFormStep
  label: string
  description: string
}[]

const featFormDefaults = createEmptyFeat({ systemId: '', userId: '' })

const featStepFields = {
  basics: ['label', 'description', 'detail'],
  requirements: ['prerequisites'],
  mechanics: ['effects', 'charges', 'grants'],
  features: ['features']
} satisfies Record<FeatFormStep, readonly string[]>

const BasicsStep = withForm({
  defaultValues: featFormDefaults,
  props: {
    readOnly: false
  },
  render: function BasicsStepRender({ form, readOnly }) {
    return (
      <>
        <AuthoredFormSection
          description='Give players a clear feat name they can recognize when building a character.'
          title='Basics'
          titleId='feat-basics-heading'
        >
          <div className={styles.fieldGrid}>
            <div className={styles.singleField}>
              <form.AppField
                name='label'
                validators={validatorsFor(requiredString('Name'))}
              >
                {(field) => <field.TextField label='Name' readOnly={readOnly} required />}
              </form.AppField>
            </div>
            <div className={styles.wide}>
              <form.AppField
                name='description'
                validators={validatorsFor(requiredString('Description'))}
              >
                {(field) => <field.TextareaField label='Description' readOnly={readOnly} required />}
              </form.AppField>
            </div>
          </div>
        </AuthoredFormSection>
        <AuthoredFormSection
          description='Use detail text for prerequisites, play notes, or additional explanation players should see.'
          title='Detail'
          titleId='feat-detail-heading'
        >
          <form.AppField name='detail'>
            {(field) => <field.TextareaField label='Detail' readOnly={readOnly} />}
          </form.AppField>
        </AuthoredFormSection>
      </>
    )
  }
})

const RequirementsStep = withForm({
  defaultValues: featFormDefaults,
  props: {
    readOnly: false,
    resolveRuntime: true
  },
  render: function RequirementsStepRender({ form, readOnly, resolveRuntime }) {
    return (
      <form.Subscribe selector={(state) => state.values.prerequisites}>
        {(prerequisites) => (
          <PrerequisitesSection
            prerequisites={prerequisites}
            readOnly={readOnly}
            resolveRuntime={resolveRuntime}
            onChange={(next) => form.setFieldValue('prerequisites', next)}
          />
        )}
      </form.Subscribe>
    )
  }
})

const MechanicsStep = withForm({
  defaultValues: featFormDefaults,
  props: {
    readOnly: false,
    resolveRuntime: true
  },
  render: function MechanicsStepRender({ form, readOnly, resolveRuntime }) {
    return (
      <>
        <form.Subscribe selector={(state) => state.values.charges}>
          {(charges) => (
            <ChargesSection
              charges={charges}
              readOnly={readOnly}
              resolveRuntime={resolveRuntime}
              onChange={(next) => form.setFieldValue('charges', next)}
            />
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => state.values.grants}>
          {(grants) => (
            <GrantsSection
              grants={grants}
              readOnly={readOnly}
              resolveRuntime={resolveRuntime}
              onChange={(next) => form.setFieldValue('grants', next)}
            />
          )}
        </form.Subscribe>
      </>
    )
  }
})

const FeaturesStep = withForm({
  defaultValues: featFormDefaults,
  props: {
    readOnly: false
  },
  render: function FeaturesStepRender({ form, readOnly }) {
    return (
      <form.Subscribe selector={(state) => state.values.features ?? []}>
        {(features) => (
          <FeaturesSection
            items={features}
            readOnly={readOnly}
            onChange={(next) => form.setFieldValue('features', next)}
          />
        )}
      </form.Subscribe>
    )
  }
})

export function FeatForm({
  mode,
  initialFeat,
  response,
  references,
  systemId,
  userId,
  resolveRuntime = true,
  onSubmit,
  onSaveDraft,
  onCopy
}: {
  mode: 'create' | 'view' | 'edit'
  initialFeat?: FeatAuthoredDto
  response?: FeatResponseDto
  references: EffectEditorReferenceData
  systemId: string
  userId: string
  resolveRuntime?: boolean
  onSubmit: (feat: FeatAuthoredDto) => Promise<void>
  onSaveDraft?: (feat: FeatAuthoredDto) => Promise<void>
  onCopy?: () => void
}) {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState<FeatFormStep>('basics')
  const readOnly = mode === 'view' || response?.permissions.canEdit === false
  const hasActiveDraft = mode === 'edit' && response != null && initialFeat != null
  const feat = initialFeat ?? response?.item ?? createEmptyFeat({ systemId, userId })
  const form = useAppForm({
    defaultValues: feat,
    onSubmit: async ({ value }) => {
      if (readOnly) return
      await onSubmit(normalizeFeatForSubmit(value))
    }
  })

  async function handleFormSubmit() {
    await form.handleSubmit()
    const firstErroredStep = getFirstErroredStep(getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: featStepFields }), featSteps)
    if (firstErroredStep) setActiveStep(firstErroredStep)
  }

  async function handleSaveDraft() {
    if (readOnly || !onSaveDraft) return
    await onSaveDraft(normalizeFeatForSubmit(form.state.values))
  }

  async function handleNextStep() {
    await form.validate('submit')
    const statuses = getStepStatuses({ fieldMeta: form.state.fieldMeta, stepFields: featStepFields })
    if (statuses[activeStep] === 'error') return
    setActiveStep(getNextStep(activeStep))
  }

  return (
    <AuthoredFormRoot>
      <form.Subscribe selector={(state) => getStepStatuses({ fieldMeta: state.fieldMeta, stepFields: featStepFields })}>
        {(stepStatuses) => (
          <AuthoredFormStepNav
            activeStep={activeStep}
            ariaLabel='Feat form sections'
            onStepChange={setActiveStep}
            stepStatuses={stepStatuses}
            steps={featSteps}
          />
        )}
      </form.Subscribe>

      <AuthoredFormHeader
        action={readOnly && response?.permissions.canCopy
          ? (
              <Button onClick={onCopy}>Duplicate to edit</Button>
            )
          : null}
        eyebrow={mode !== 'create' ? feat.label || 'Untitled Feat' : undefined}
        title={getFeatStepTitle(activeStep)}
      />

      {readOnly
        ? (
            <Alert color='cyan'>
              This feat is locked for direct editing. Duplicate it to make your own draft.
            </Alert>
          )
        : null}

      {hasActiveDraft
        ? (
            <Alert color='blue'>
              You are editing a draft. The active feat stays unchanged until you activate these changes.
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
              <FeatRuntimeBridge
                enabled={resolveRuntime}
                values={values}
                onClearPaths={(paths) => clearRuntimeFormPaths(form, paths)}
              />
            )}
          </form.Subscribe>

          <AuthoredFormSectionStack>
            {activeStep === 'basics' ? <BasicsStep form={form} readOnly={readOnly} /> : null}
            {activeStep === 'requirements' ? <RequirementsStep form={form} readOnly={readOnly} resolveRuntime={resolveRuntime} /> : null}
            {activeStep === 'mechanics'
              ? (
                  <>
                    <EffectEditorFieldGroup
                      form={form}
                      fields={{ effects: 'effects' }}
                      references={references}
                      readOnly={readOnly}
                      sourceLabel='Feat'
                    />
                    <MechanicsStep
                      form={form}
                      readOnly={readOnly}
                      resolveRuntime={resolveRuntime}
                    />
                  </>
                )
              : null}
            {activeStep === 'features' ? <FeaturesStep form={form} readOnly={readOnly} /> : null}
          </AuthoredFormSectionStack>

          <AuthoredFormFooter>
            <Button variant='default' onClick={() => navigate({ to: '/feats' })}>
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
              {activeStep === 'features'
                ? (
                    readOnly
                      ? null
                      : (
                          <>
                            {onSaveDraft
                              ? (
                                  <Button type='button' variant='default' onClick={() => void handleSaveDraft()}>
                                    Save Draft
                                  </Button>
                                )
                              : null}
                            <form.SubmitButton label='Activate Feat' />
                          </>
                        )
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

function FeatRuntimeBridge({
  values,
  enabled,
  onClearPaths
}: {
  values: FeatAuthoredDto
  enabled: boolean
  onClearPaths: (paths: readonly NodeRuntimePathDto[]) => void
}) {
  useNodeRuntimeModel({
    mapId: 'feat',
    values: toRuntimeValues(values),
    systemId: values.systemId,
    enabled,
    debounceMs: 150,
    onClearPaths
  })

  return null
}

function PrerequisitesSection({
  prerequisites,
  readOnly,
  resolveRuntime,
  onChange
}: {
  prerequisites?: FeatPrerequisites
  readOnly: boolean
  resolveRuntime: boolean
  onChange: (prerequisites: FeatPrerequisites) => void
}) {
  const [editing, setEditing] = useState<FeatPrerequisites | null>(null)
  const groupCount = prerequisites?.groups.length ?? 0

  return (
    <AuthoredFormSection
      description='Set the character requirements players must meet before they can choose this feat.'
      title='Requirements'
      titleId='feat-requirements-heading'
    >
      <div className={styles.collectionList}>
        <CollectionRow
          title={groupCount > 0 ? `${groupCount} requirement group${groupCount === 1 ? '' : 's'}` : 'No requirements'}
          description={groupCount > 0 ? 'Open the requirement builder to review or adjust prerequisites.' : 'Leave this empty when any character can choose the feat.'}
          readOnly={readOnly}
          onEdit={() => setEditing(prerequisites ?? createEmptyPrerequisites())}
        />
      </div>
      {!readOnly && !prerequisites
        ? (
            <Button className={styles.sectionAction} type='button' onClick={() => setEditing(createEmptyPrerequisites())}>
              Add requirements
            </Button>
          )
        : null}
      <RuntimeEditorModal
        defaultValue={createEmptyPrerequisites()}
        item={editing}
        mapId='facet'
        nodeMap={FEAT_PREREQUISITES_NODE_MAP as NodeMap<FeatPrerequisites>}
        opened={editing !== null}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        title={readOnly ? 'View Requirements' : 'Edit Requirements'}
        titleId='feat-requirements-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(item) => {
          onChange(item)
          setEditing(null)
        }}
      />
    </AuthoredFormSection>
  )
}

function ChargesSection({
  charges,
  readOnly,
  resolveRuntime,
  onChange
}: {
  charges?: ChargeDto
  readOnly: boolean
  resolveRuntime: boolean
  onChange: (charges: ChargeDto) => void
}) {
  const [editing, setEditing] = useState<ChargeDto | null>(null)

  return (
    <AuthoredFormSection
      description='Use charges when the feat has limited uses or resets after rests.'
      title='Charges'
      titleId='feat-charges-heading'
    >
      <div className={styles.collectionList}>
        <CollectionRow
          title={charges ? 'Charges configured' : 'No charges configured'}
          description={charges ? formatCharges(charges) : 'Leave this empty when the feat is always available.'}
          readOnly={readOnly}
          onEdit={() => setEditing(charges ?? createEmptyCharge())}
        />
      </div>
      {!readOnly && !charges
        ? (
            <Button className={styles.sectionAction} type='button' onClick={() => setEditing(createEmptyCharge())}>
              Add charges
            </Button>
          )
        : null}
      <RuntimeEditorModal
        defaultValue={createEmptyCharge()}
        item={editing}
        mapId='charges'
        nodeMap={CHARGE_NODE_MAP as NodeMap<ChargeDto>}
        opened={editing !== null}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        title={readOnly ? 'View Charges' : 'Edit Charges'}
        titleId='feat-charges-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(item) => {
          onChange(item)
          setEditing(null)
        }}
      />
    </AuthoredFormSection>
  )
}

function GrantsSection({
  grants,
  readOnly,
  resolveRuntime,
  onChange
}: {
  grants?: FeatGrants
  readOnly: boolean
  resolveRuntime: boolean
  onChange: (grants: FeatGrants) => void
}) {
  const [editing, setEditing] = useState<FeatGrants | null>(null)

  return (
    <AuthoredFormSection
      description='Review the rules, proficiencies, senses, spells, or feats granted by this feat.'
      title='Grants'
      titleId='feat-grants-heading'
    >
      <div className={styles.collectionList}>
        <CollectionRow
          title='Granted content'
          description={formatGrantSummary(grants)}
          readOnly={readOnly}
          onEdit={() => setEditing(grants ?? createEmptyGrants())}
        />
      </div>
      {!readOnly && !grants
        ? (
            <Button className={styles.sectionAction} type='button' onClick={() => setEditing(createEmptyGrants())}>
              Add grants
            </Button>
          )
        : null}
      <RuntimeEditorModal
        defaultValue={createEmptyGrants()}
        item={editing}
        mapId='featureGrants'
        nodeMap={FEAT_GRANTS_NODE_MAP as NodeMap<FeatGrants>}
        opened={editing !== null}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        title={readOnly ? 'View Grants' : 'Edit Grants'}
        titleId='feat-grants-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(item) => {
          onChange(item)
          setEditing(null)
        }}
      />
    </AuthoredFormSection>
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
      title='Feat Features'
      description='Add the named benefits players will see when they choose this feat.'
      addLabel='Add feature'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyFeature(items.length + 1))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No feat features added yet.</Text> : null}
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
  onRemove?: () => void
}) {
  const Icon = readOnly ? IExternalLink : IEdit

  return (
    <div className={styles.collectionRow}>
      <div>
        <Text className={styles.rowTitle}>{title}</Text>
        {description ? <Text className={styles.rowDescription}>{description}</Text> : null}
      </div>
      <div className={styles.rowActions}>
        <Tooltip label={readOnly ? 'View' : 'Edit'} withArrow>
          <ActionIcon aria-label={readOnly ? `View ${title}` : `Edit ${title}`} variant='subtle' onClick={onEdit}>
            <Icon size={18} />
          </ActionIcon>
        </Tooltip>
        {!readOnly && onRemove
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
  const formValue = item ?? createEmptyFeature(1)

  return (
    <FeatureEditorModalForm
      key={getRuntimeEditorFormKey('feat-feature-editor-heading', item)}
      item={formValue}
      opened={opened}
      readOnly={readOnly}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function FeatureEditorModalForm({
  item,
  opened,
  readOnly,
  onClose,
  onSave
}: {
  item: FeatureDto
  opened: boolean
  readOnly: boolean
  onClose: () => void
  onSave: (item: FeatureDto) => void
}) {
  const form = useAppForm({
    defaultValues: item,
    onSubmit: async ({ value }) => onSave(value)
  })

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='feat-feature-editor-heading'>
      <EditorShell
        title={readOnly ? 'View Feature' : 'Edit Feature'}
        titleId='feat-feature-editor-heading'
        readOnly={readOnly}
        onClose={onClose}
        onSubmit={() => form.handleSubmit()}
      >
        <form.AppForm>
          <Stack className={styles.collectionList}>
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

function RuntimeEditorModal<TValues extends object>({
  defaultValue,
  item,
  opened,
  readOnly,
  resolveRuntime,
  mapId,
  nodeMap,
  title,
  titleId,
  onClose,
  onSave
}: {
  defaultValue: TValues
  item: TValues | null
  opened: boolean
  readOnly: boolean
  resolveRuntime: boolean
  mapId: string
  nodeMap: NodeMap<TValues>
  title: string
  titleId: string
  onClose: () => void
  onSave: (item: TValues) => void
}) {
  const formValue = item ?? defaultValue

  return (
    <RuntimeEditorModalForm
      key={getRuntimeEditorFormKey(titleId, item)}
      defaultValue={formValue}
      opened={opened}
      readOnly={readOnly}
      resolveRuntime={resolveRuntime}
      mapId={mapId}
      nodeMap={nodeMap}
      title={title}
      titleId={titleId}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function RuntimeEditorModalForm<TValues extends object>({
  defaultValue,
  opened,
  readOnly,
  resolveRuntime,
  mapId,
  nodeMap,
  title,
  titleId,
  onClose,
  onSave
}: {
  defaultValue: TValues
  opened: boolean
  readOnly: boolean
  resolveRuntime: boolean
  mapId: string
  nodeMap: NodeMap<TValues>
  title: string
  titleId: string
  onClose: () => void
  onSave: (item: TValues) => void
}) {
  const form = useAppForm({
    defaultValues: defaultValue,
    onSubmit: async ({ value }) => onSave(value)
  })

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy={titleId}>
      <EditorShell
        title={title}
        titleId={titleId}
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
                mapId={mapId}
                nodeMap={nodeMap}
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

function getRuntimeEditorFormKey<TValues extends object>(titleId: string, item: TValues | null): string {
  return item === null ? `${titleId}:closed` : `${titleId}:${JSON.stringify(item)}`
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
        <h2 id={titleId} className={styles.rowTitle}>{title}</h2>
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

function getFeatStepTitle(step: FeatFormStep) {
  if (step === 'requirements') return 'Feat Requirements'
  if (step === 'mechanics') return 'Feat Mechanics'
  if (step === 'features') return 'Feat Features'
  return 'Feat Basics'
}

function getNextStep(step: FeatFormStep): FeatFormStep {
  if (step === 'basics') return 'requirements'
  if (step === 'requirements') return 'mechanics'
  return 'features'
}

function getPreviousStep(step: FeatFormStep): FeatFormStep {
  if (step === 'features') return 'mechanics'
  if (step === 'mechanics') return 'requirements'
  return 'basics'
}

function formatCharges(charges: ChargeDto): string {
  if (charges.limitKind === 'FIXED_AMOUNT' && charges.scalingKind === 'NONE') {
    return `${charges.amount} use${charges.amount === 1 ? '' : 's'} / ${formatCode(charges.resetKind).toLowerCase()}`
  }

  return `${formatCode(charges.limitKind)} / ${formatCode(charges.resetKind).toLowerCase()}`
}

function formatGrantSummary(grants: FeatAuthoredDto['grants']): string {
  if (!grants) return 'No grants configured yet.'

  const parts = [
    summarizeCount(grants.feats?.length ?? 0, 'feat grant'),
    summarizeCount(grants.modifiers?.length ?? 0, 'modifier'),
    summarizeCount(grants.proficiencies?.length ?? 0, 'proficiency'),
    summarizeCount(grants.senses?.length ?? 0, 'sense'),
    summarizeCount(grants.spells?.length ?? 0, 'spell')
  ].filter((part): part is string => part !== null)

  return parts.length > 0 ? parts.join(', ') : 'No grants configured yet.'
}

function summarizeCount(count: number, label: string): string | null {
  if (count === 0) return null
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function formatCode(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase())
}
