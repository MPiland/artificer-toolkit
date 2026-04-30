import { useState, type ReactNode } from 'react'
import { ActionIcon, Button, Stack, Text, Tooltip } from '@mantine/core'
import type { DetailDto, FeatureDto, SpeedDto } from '@artificer-toolkit/schema'
import { SPEED_NODE_MAP, type NodeMap } from '@artificer-toolkit/shared'
import IEdit from '#assets/icons/IEdit'
import { IExternalLink } from '#assets/icons/IExternalLink'
import { IMinus } from '#assets/icons/IMinus'
import IX from '#assets/icons/IX'
import {
  AuthoredFormSection
} from '#components/Form/AuthoredFormLayout'
import { FullscreenModal } from '#app/ui/overlays/Modal/FullscreenModal'
import {
  NodeMapRenderer,
  clearRuntimeFormPaths,
  toRuntimeValues,
  useAppForm,
  useNodeRuntimeModel,
  type ClearableRuntimeForm,
  type RuntimeNodeForm
} from '#components/Form/runtime'
import {
  createEmptyAncestry,
  createEmptyAncestryOption,
  createEmptyDetail,
  createEmptyFeature,
  createEmptySpeed,
  upsertById,
  type RaceFormValues
} from './raceAuthoring.utils'
import * as styles from './raceAuthoring.css'

type RaceAncestry = NonNullable<RaceFormValues['ancestry']>
type RaceAncestryOption = RaceAncestry['options'][number]

export function SpeedsSection({
  items,
  readOnly,
  resolveRuntime,
  onChange
}: {
  items: SpeedDto[]
  readOnly: boolean
  resolveRuntime: boolean
  onChange: (items: SpeedDto[]) => void
}) {
  const [editing, setEditing] = useState<SpeedDto | null>(null)

  return (
    <CollectionSection
      title='Speeds'
      description='Add the movement modes this base race grants.'
      addLabel='Add speed'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptySpeed())}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No speeds added yet.</Text> : null}
      {items.map((item) => (
        <CollectionRow
          key={`${item.speedId}:${item.unit}:${item.amount}`}
          title={item.speedId || 'Speed'}
          description={`${item.amount} ${item.unit.toLowerCase().replaceAll('_', ' ')}`}
          readOnly={readOnly}
          onEdit={() => setEditing(item)}
          onRemove={() => onChange(items.filter((current) => current !== item))}
        />
      ))}
      <RuntimeEditorModal
        defaultValue={createEmptySpeed()}
        item={editing}
        mapId='speed'
        nodeMap={SPEED_NODE_MAP as NodeMap<SpeedDto>}
        opened={editing !== null}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        title={readOnly ? 'View Speed' : 'Edit Speed'}
        titleId='race-speed-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(item) => {
          const nextItems = editing && items.includes(editing)
            ? items.map((current) => current === editing ? item : current)
            : [...items, item]
          onChange(nextItems)
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

export function DetailsSection({
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
      title='Details'
      description='Capture culture, appearance, lore, or worldbuilding notes players can read.'
      addLabel='Add detail'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyDetail(items.length + 1))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No race details added yet.</Text> : null}
      {items.map((item) => (
        <CollectionRow
          key={item.id}
          title={item.label || `Detail ${item.order}`}
          description={item.description}
          readOnly={readOnly}
          onEdit={() => setEditing(item)}
          onRemove={() => onChange(items.filter((current) => current.id !== item.id))}
        />
      ))}
      <TextItemEditorModal
        item={editing}
        opened={editing !== null}
        readOnly={readOnly}
        title={readOnly ? 'View Detail' : 'Edit Detail'}
        titleId='race-detail-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(item) => {
          onChange(upsertById(items, item))
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

export function FeaturesSection({
  items,
  readOnly,
  onChange
}: {
  items: FeatureDto[]
  readOnly: boolean
  onChange: (items: FeatureDto[]) => void
}) {
  return (
    <FeatureCollection
      title='Features'
      description='Add the named benefits granted by this race record.'
      items={items}
      readOnly={readOnly}
      onChange={onChange}
    />
  )
}

export function AncestrySection({
  ancestry,
  readOnly,
  onChange
}: {
  ancestry: RaceFormValues['ancestry']
  readOnly: boolean
  onChange: (ancestry: RaceAncestry) => void
}) {
  const [editing, setEditing] = useState(false)
  const current = ancestry ?? createEmptyAncestry()

  return (
    <AuthoredFormSection
      description='Define the choice a player makes inside this base race, then add each option as its own focused item.'
      title='Ancestry'
      titleId='race-ancestry-heading'
    >
      <div className={styles.collectionList}>
        <CollectionRow
          title={current.label || 'Ancestry'}
          description={current.description ?? 'No ancestry description yet.'}
          readOnly={readOnly}
          onEdit={() => setEditing(true)}
        />
        {current.options.length === 0 ? <Text className={styles.emptyCopy}>No ancestry options added yet.</Text> : null}
        {current.options.map((option) => (
          <CollectionRow
            key={option.id}
            title={option.label || `Option ${option.order}`}
            description={option.description}
            readOnly={readOnly}
            onEdit={() => setEditing(true)}
          />
        ))}
      </div>
      {!readOnly
        ? (
            <Button className={styles.sectionAction} type='button' onClick={() => setEditing(true)}>
              {ancestry ? 'Edit ancestry' : 'Add ancestry'}
            </Button>
          )
        : null}
      <AncestryEditorModal
        item={current}
        opened={editing}
        readOnly={readOnly}
        onClose={() => setEditing(false)}
        onSave={(next) => {
          onChange(next)
          setEditing(false)
        }}
      />
    </AuthoredFormSection>
  )
}

function FeatureCollection({
  title,
  description,
  items,
  readOnly,
  onChange
}: {
  title: string
  description: string
  items: FeatureDto[]
  readOnly: boolean
  onChange: (items: FeatureDto[]) => void
}) {
  const [editing, setEditing] = useState<FeatureDto | null>(null)

  return (
    <CollectionSection
      title={title}
      description={description}
      addLabel='Add feature'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyFeature(items.length + 1))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No features added yet.</Text> : null}
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
  description?: string | null
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

function TextItemEditorModal({
  item,
  opened,
  readOnly,
  title,
  titleId,
  onClose,
  onSave
}: {
  item: DetailDto | null
  opened: boolean
  readOnly: boolean
  title: string
  titleId: string
  onClose: () => void
  onSave: (item: DetailDto) => void
}) {
  const formValue = item ?? createEmptyDetail(1)

  return (
    <TextItemEditorModalForm
      key={getRuntimeEditorFormKey(titleId, item)}
      item={formValue}
      opened={opened}
      readOnly={readOnly}
      title={title}
      titleId={titleId}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function TextItemEditorModalForm({
  item,
  opened,
  readOnly,
  title,
  titleId,
  onClose,
  onSave
}: {
  item: DetailDto
  opened: boolean
  readOnly: boolean
  title: string
  titleId: string
  onClose: () => void
  onSave: (item: DetailDto) => void
}) {
  const form = useAppForm({
    defaultValues: item,
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
      key={getRuntimeEditorFormKey('race-feature-editor-heading', item)}
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
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='race-feature-editor-heading'>
      <EditorShell
        title={readOnly ? 'View Feature' : 'Edit Feature'}
        titleId='race-feature-editor-heading'
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

function AncestryEditorModal({
  item,
  opened,
  readOnly,
  onClose,
  onSave
}: {
  item: RaceAncestry
  opened: boolean
  readOnly: boolean
  onClose: () => void
  onSave: (item: RaceAncestry) => void
}) {
  return (
    <AncestryEditorModalForm
      key={getRuntimeEditorFormKey('race-ancestry-editor-heading', item)}
      item={item}
      opened={opened}
      readOnly={readOnly}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function AncestryEditorModalForm({
  item,
  opened,
  readOnly,
  onClose,
  onSave
}: {
  item: RaceAncestry
  opened: boolean
  readOnly: boolean
  onClose: () => void
  onSave: (item: RaceAncestry) => void
}) {
  const [editingOption, setEditingOption] = useState<RaceAncestryOption | null>(null)
  const form = useAppForm({
    defaultValues: item,
    onSubmit: async ({ value }) => onSave(value)
  })

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='race-ancestry-editor-heading'>
      <EditorShell
        title={readOnly ? 'View Ancestry' : 'Edit Ancestry'}
        titleId='race-ancestry-editor-heading'
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
            <form.Subscribe selector={(state) => state.values.options ?? []}>
              {(options) => (
                <CollectionSection
                  title='Options'
                  description='Add each selectable ancestry option.'
                  addLabel='Add ancestry option'
                  readOnly={readOnly}
                  onAdd={() => setEditingOption(createEmptyAncestryOption(options.length + 1))}
                >
                  {options.length === 0 ? <Text className={styles.emptyCopy}>No ancestry options added yet.</Text> : null}
                  {options.map((option) => (
                    <CollectionRow
                      key={option.id}
                      title={option.label || `Option ${option.order}`}
                      description={option.description}
                      readOnly={readOnly}
                      onEdit={() => setEditingOption(option)}
                      onRemove={() => form.setFieldValue('options', options.filter((current) => current.id !== option.id))}
                    />
                  ))}
                  <AncestryOptionEditorModal
                    item={editingOption}
                    opened={editingOption !== null}
                    readOnly={readOnly}
                    onClose={() => setEditingOption(null)}
                    onSave={(option) => {
                      form.setFieldValue('options', upsertById(options, option))
                      setEditingOption(null)
                    }}
                  />
                </CollectionSection>
              )}
            </form.Subscribe>
          </Stack>
        </form.AppForm>
      </EditorShell>
    </FullscreenModal>
  )
}

function AncestryOptionEditorModal({
  item,
  opened,
  readOnly,
  onClose,
  onSave
}: {
  item: RaceAncestryOption | null
  opened: boolean
  readOnly: boolean
  onClose: () => void
  onSave: (item: RaceAncestryOption) => void
}) {
  const formValue = item ?? createEmptyAncestryOption(1)

  return (
    <AncestryOptionEditorModalForm
      key={getRuntimeEditorFormKey('race-ancestry-option-editor-heading', item)}
      item={formValue}
      opened={opened}
      readOnly={readOnly}
      onClose={onClose}
      onSave={onSave}
    />
  )
}

function AncestryOptionEditorModalForm({
  item,
  opened,
  readOnly,
  onClose,
  onSave
}: {
  item: RaceAncestryOption
  opened: boolean
  readOnly: boolean
  onClose: () => void
  onSave: (item: RaceAncestryOption) => void
}) {
  const form = useAppForm({
    defaultValues: item,
    onSubmit: async ({ value }) => onSave(value)
  })

  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy='race-ancestry-option-editor-heading'>
      <EditorShell
        title={readOnly ? 'View Ancestry Option' : 'Edit Ancestry Option'}
        titleId='race-ancestry-option-editor-heading'
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
            <form.Subscribe selector={(state) => state.values.features ?? []}>
              {(features) => (
                <FeatureCollection
                  title='Features'
                  description='Preserve and edit simple feature basics for this ancestry option.'
                  items={features}
                  readOnly={readOnly}
                  onChange={(next) => form.setFieldValue('features', next)}
                />
              )}
            </form.Subscribe>
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

function getRuntimeEditorFormKey<TValues extends object>(titleId: string, item: TValues | null): string {
  return item === null ? `${titleId}:closed` : `${titleId}:${JSON.stringify(item)}`
}
