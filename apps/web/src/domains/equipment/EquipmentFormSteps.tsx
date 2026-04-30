import { useState, type ReactNode } from 'react'
import { ActionIcon, Alert, Button, Stack, Text, Tooltip } from '@mantine/core'
import type {
  ChargeDto,
  ContainsDto,
  EquipmentAuthoredDto,
  FacetDto,
  FeatureDto,
  ModifierGrantDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema'
import {
  CONTAINS_NODE_MAP,
  EQUIPMENT_ATTRIBUTE_OPTIONS,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_CHARGE_NODE_MAP,
  EQUIPMENT_FEATURE_NODE_MAP,
  EQUIPMENT_MODIFIER_NODE_MAP,
  EQUIPMENT_RESTRICTIONS_NODE_MAP,
  MEASUREMENT_UNIT_OPTIONS,
  type NodeMap
} from '@artificer-toolkit/shared'
import IEdit from '#assets/icons/IEdit'
import { IExternalLink } from '#assets/icons/IExternalLink'
import { IMinus } from '#assets/icons/IMinus'
import IX from '#assets/icons/IX'
import {
  AuthoredFormSection
} from '#components/Form/AuthoredFormLayout'
import { EffectEditorFieldGroup, type EffectEditorReferenceData } from '#components/EffectEditor'
import { FullscreenModal } from '#app/ui/overlays/Modal/FullscreenModal'
import {
  NodeMapRenderer,
  clearRuntimeFormPaths,
  getRuntimeNodeOptions,
  getRuntimeNodeVisible,
  requiredNumber,
  requiredSelect,
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
  createEmptyCapacity,
  createEmptyCharge,
  createEmptyContains,
  createEmptyCost,
  createEmptyFeature,
  createEmptyModifier,
  createEmptyRestrictions,
  createEmptyWeight,
  type EquipmentFormStep,
  type EquipmentFormValues
} from './equipmentAuthoring.utils'
import * as styles from './equipmentAuthoring.css'

export const equipmentSteps = [
  {
    id: 'basics',
    label: 'Basics',
    description: 'Name, type, rarity, and parent item'
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'Cost, weight, capacity, and stack rules'
  },
  {
    id: 'rules',
    label: 'Rules',
    description: 'Properties, attributes, armor, and bonuses'
  },
  {
    id: 'content',
    label: 'Content',
    description: 'Effects, modifiers, and item features'
  },
  {
    id: 'charges',
    label: 'Charges',
    description: 'Limited-use behavior'
  },
  {
    id: 'contents',
    label: 'Contents',
    description: 'Items contained by this equipment'
  }
] as const satisfies readonly {
  id: EquipmentFormStep
  label: string
  description: string
}[]

export const equipmentStepFields = {
  basics: ['label', 'description', 'quote', 'category', 'rarityId', 'parentEquipmentId'],
  inventory: ['cost', 'weight', 'capacity', 'maxStack'],
  rules: ['attributes', 'properties', 'armorClass', 'maxBonus', 'restrictions'],
  content: ['effects', 'modifiers', 'features'],
  charges: ['charges'],
  contents: ['contains']
} satisfies Record<EquipmentFormStep, readonly string[]>

const equipmentFormDefaults: EquipmentFormValues = {
  kind: 'EQUIPMENT',
  id: '',
  label: '',
  description: '',
  status: 'DRAFT',
  quote: '',
  rarityId: '',
  userId: '',
  systemId: '',
  category: EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  attributes: [],
  properties: [],
  weight: createEmptyWeight(),
  effects: [],
  modifiers: [],
  features: [],
  contains: []
}

const categoryOptions = toOptions(EQUIPMENT_CATEGORY_OPTIONS)
const attributeOptions = toOptions(EQUIPMENT_ATTRIBUTE_OPTIONS)
const measurementUnitOptions = toOptions(MEASUREMENT_UNIT_OPTIONS)
const emptyEffectReferences: EffectEditorReferenceData = {
  damageTypes: [],
  conditionTypes: [],
  creatures: []
}

export const BasicsStep = withForm({
  defaultValues: equipmentFormDefaults,
  props: {
    readOnly: false,
    runtimeModel: undefined as NodeRuntimeResolveResponseDto | undefined
  },
  render: function BasicsStepRender({ form, readOnly, runtimeModel }) {
    return (
      <>
        <AuthoredFormSection
          description='Give players an item name and a clear description they can recognize in inventory and play.'
          title='Basics'
          titleId='equipment-basics-heading'
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
            <form.AppField
              name='category'
              validators={validatorsFor(requiredSelect('Category'))}
            >
              {(field) => (
                <field.SelectField
                  label='Category'
                  data={getRuntimeNodeOptions(runtimeModel, 'category', categoryOptions)}
                  readOnly={readOnly}
                  required
                />
              )}
            </form.AppField>
            <form.AppField
              name='rarityId'
              validators={validatorsFor(requiredSelect('Rarity'))}
            >
              {(field) => (
                <field.SelectField
                  label='Rarity'
                  data={getRuntimeNodeOptions(runtimeModel, 'rarityId', [])}
                  readOnly={readOnly}
                  required
                />
              )}
            </form.AppField>
            <form.Subscribe selector={(state) => state.values.category}>
              {(category) => getRuntimeNodeVisible(runtimeModel, 'parentEquipmentId', category === EQUIPMENT_CATEGORY_CODE.VARIANT)
                ? (
                    <form.AppField
                      name='parentEquipmentId'
                      validators={validatorsFor(requiredSelect('Parent equipment'))}
                    >
                      {(field) => (
                        <field.SelectField
                          label='Parent Equipment'
                          data={getRuntimeNodeOptions(runtimeModel, 'parentEquipmentId', [])}
                          readOnly={readOnly}
                          required
                        />
                      )}
                    </form.AppField>
                  )
                : null}
            </form.Subscribe>
            <div className={styles.wide}>
              <form.AppField name='quote'>
                {(field) => <field.TextField label='Quote' readOnly={readOnly} />}
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
      </>
    )
  }
})

export const InventoryStep = withForm({
  defaultValues: equipmentFormDefaults,
  props: {
    readOnly: false,
    runtimeModel: undefined as NodeRuntimeResolveResponseDto | undefined
  },
  render: function InventoryStepRender({ form, readOnly, runtimeModel }) {
    return (
      <form.Subscribe selector={(state) => state.values.category}>
        {(category) => {
          if (category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
            return (
              <Alert color='blue'>
                Variant equipment inherits inventory basics from its parent. Use Rules and Content for the changes this variant adds.
              </Alert>
            )
          }

          return (
            <>
              <AuthoredFormSection
                description='Set how this item behaves in inventory, shops, and containers.'
                title='Inventory'
                titleId='equipment-inventory-heading'
              >
                <div className={styles.fieldGrid}>
                  <form.AppField name='cost.amount'>
                    {(field) => <field.NumberField label='Cost Amount' readOnly={readOnly} />}
                  </form.AppField>
                  <form.AppField name='cost.currencyId'>
                    {(field) => (
                      <field.SelectField
                        label='Currency'
                        data={getRuntimeNodeOptions(runtimeModel, 'currencyId', [])}
                        readOnly={readOnly}
                      />
                    )}
                  </form.AppField>
                  <form.AppField
                    name='weight.amount'
                    validators={validatorsFor(requiredNumber('Weight'))}
                  >
                    {(field) => <field.NumberField label='Weight' readOnly={readOnly} required />}
                  </form.AppField>
                  <form.AppField
                    name='weight.unit'
                    validators={validatorsFor(requiredSelect('Weight unit'))}
                  >
                    {(field) => (
                      <field.SelectField
                        label='Weight Unit'
                        data={getRuntimeNodeOptions(runtimeModel, 'unit', measurementUnitOptions)}
                        readOnly={readOnly}
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField name='capacity.amount'>
                    {(field) => <field.NumberField label='Capacity Amount' readOnly={readOnly} />}
                  </form.AppField>
                  <form.AppField name='capacity.unit'>
                    {(field) => (
                      <field.SelectField
                        label='Capacity Unit'
                        data={getRuntimeNodeOptions(runtimeModel, 'unit', measurementUnitOptions)}
                        readOnly={readOnly}
                      />
                    )}
                  </form.AppField>
                  {getRuntimeNodeVisible(runtimeModel, 'maxStack', true)
                    ? (
                        <form.AppField name='maxStack'>
                          {(field) => <field.NumberField label='Max Stack' readOnly={readOnly} />}
                        </form.AppField>
                      )
                    : null}
                </div>
              </AuthoredFormSection>
            </>
          )
        }}
      </form.Subscribe>
    )
  }
})

export const RulesStep = withForm({
  defaultValues: equipmentFormDefaults,
  props: {
    readOnly: false,
    resolveRuntime: true,
    runtimeModel: undefined as NodeRuntimeResolveResponseDto | undefined
  },
  render: function RulesStepRender({ form, readOnly, resolveRuntime, runtimeModel }) {
    return (
      <>
        <AuthoredFormSection
          description='Choose the rules-facing traits that drive proficiency, equip behavior, and derived bonuses.'
          title='Rules'
          titleId='equipment-rules-heading'
        >
          <div className={styles.fieldGrid}>
            {getRuntimeNodeVisible(runtimeModel, 'attributes', true)
              ? (
                  <form.AppField name='attributes'>
                    {(field) => (
                      <field.MultiSelectField
                        label='Attributes'
                        data={getRuntimeNodeOptions(runtimeModel, 'attributes', attributeOptions)}
                        readOnly={readOnly}
                      />
                    )}
                  </form.AppField>
                )
              : null}
            <form.AppField name='properties'>
              {(field) => (
                <field.MultiSelectField
                  label='Properties'
                  data={getRuntimeNodeOptions(runtimeModel, 'properties', [])}
                  readOnly={readOnly}
                />
              )}
            </form.AppField>
            {getRuntimeNodeVisible(runtimeModel, 'armorClass', true)
              ? (
                  <form.AppField name='armorClass'>
                    {(field) => <field.NumberField label='Armor Class' readOnly={readOnly} />}
                  </form.AppField>
                )
              : null}
            <form.AppField name='maxBonus'>
              {(field) => <field.NumberField label='Max Bonus' readOnly={readOnly} />}
            </form.AppField>
          </div>
        </AuthoredFormSection>
        <form.Subscribe selector={(state) => ({
          restrictions: state.values.restrictions,
          systemId: state.values.systemId
        })}
        >
          {({ restrictions, systemId }) => (
            <RestrictionsSection
              item={restrictions}
              readOnly={readOnly}
              resolveRuntime={resolveRuntime}
              systemId={systemId}
              onChange={(next) => form.setFieldValue('restrictions', next)}
              onRemove={() => form.setFieldValue('restrictions', undefined)}
            />
          )}
        </form.Subscribe>
      </>
    )
  }
})

export const ContentStep = withForm({
  defaultValues: equipmentFormDefaults,
  props: {
    readOnly: false,
    resolveRuntime: true,
    references: emptyEffectReferences
  },
  render: function ContentStepRender({ form, readOnly, references, resolveRuntime }) {
    return (
      <>
        <EffectEditorFieldGroup
          form={form}
          fields={{ effects: 'effects' }}
          references={references}
          readOnly={readOnly}
          sourceLabel='Equipment'
        />
        <form.Subscribe selector={(state) => state.values.features ?? []}>
          {(features) => (
            <FeaturesSection
              items={features}
              readOnly={readOnly}
              onChange={(next) => form.setFieldValue('features', next)}
            />
          )}
        </form.Subscribe>
        <form.Subscribe selector={(state) => ({
          modifiers: state.values.modifiers ?? [],
          systemId: state.values.systemId
        })}
        >
          {({ modifiers, systemId }) => (
            <ModifiersSection
              items={modifiers}
              readOnly={readOnly}
              resolveRuntime={resolveRuntime}
              systemId={systemId}
              onChange={(next) => form.setFieldValue('modifiers', next)}
            />
          )}
        </form.Subscribe>
      </>
    )
  }
})

export const ChargesStep = withForm({
  defaultValues: equipmentFormDefaults,
  props: {
    readOnly: false,
    resolveRuntime: true,
    runtimeModel: undefined as NodeRuntimeResolveResponseDto | undefined
  },
  render: function ChargesStepRender({ form, readOnly, resolveRuntime, runtimeModel }) {
    const [editing, setEditing] = useState<ChargeDto | null>(null)

    return (
      <form.Subscribe selector={(state) => state.values.charges}>
        {(charges) => (
          <AuthoredFormSection
            description='Use charges when an item has a limited number of uses before it resets.'
            title='Charges'
            titleId='equipment-charges-heading'
          >
            {getRuntimeNodeVisible(runtimeModel, 'charges', true)
              ? (
                  <Stack gap='md'>
                    {charges
                      ? (
                          <CollectionRow
                            title='Charge rules'
                            description={`${charges.limitKind} / ${charges.resetKind}`}
                            readOnly={readOnly}
                            onOpen={() => setEditing(charges)}
                            onRemove={() => form.setFieldValue('charges', undefined)}
                          />
                        )
                      : (
                          <Text className={styles.emptyCopy}>No charge rules added yet.</Text>
                        )}
                    {!readOnly
                      ? (
                          <Button
                            className={styles.sectionAction}
                            variant='default'
                            onClick={() => setEditing(charges ?? createEmptyCharge())}
                          >
                            {charges ? 'Edit charges' : 'Add charges'}
                          </Button>
                        )
                      : null}
                    <RuntimeEditorModal
                      editorKey={editing ? 'charges' : 'empty'}
                      item={editing}
                      labelledBy='equipment-charge-editor-heading'
                      mapId='charge'
                      nodeMap={EQUIPMENT_CHARGE_NODE_MAP as NodeMap<ChargeDto>}
                      opened={editing != null}
                      readOnly={readOnly}
                      resolveRuntime={resolveRuntime}
                      title={readOnly ? 'View Charges' : 'Edit Charges'}
                      titleId='equipment-charge-editor-heading'
                      onClose={() => setEditing(null)}
                      onSave={(next) => {
                        form.setFieldValue('charges', next)
                        setEditing(null)
                      }}
                    />
                  </Stack>
                )
              : (
                  <Text className={styles.emptyCopy}>Charges are available for variants or limited-use base equipment.</Text>
                )}
          </AuthoredFormSection>
        )}
      </form.Subscribe>
    )
  }
})

export const ContentsStep = withForm({
  defaultValues: equipmentFormDefaults,
  props: {
    readOnly: false,
    runtimeModel: undefined as NodeRuntimeResolveResponseDto | undefined
  },
  render: function ContentsStepRender({ form, readOnly, runtimeModel }) {
    return (
      <form.Subscribe selector={(state) => ({
        category: state.values.category,
        contains: state.values.contains ?? [],
        systemId: state.values.systemId
      })}
      >
        {({ category, contains, systemId }) => {
          if (category === EQUIPMENT_CATEGORY_CODE.VARIANT) {
            return (
              <Alert color='blue'>
                Variant equipment inherits contents from its parent item.
              </Alert>
            )
          }

          return (
            <ContainsSection
              items={contains}
              readOnly={readOnly}
              runtimeModel={runtimeModel}
              systemId={systemId}
              onChange={(next) => form.setFieldValue('contains', next)}
            />
          )
        }}
      </form.Subscribe>
    )
  }
})

function RestrictionsSection({
  item,
  readOnly,
  resolveRuntime,
  systemId,
  onChange,
  onRemove
}: {
  item?: FacetDto
  readOnly: boolean
  resolveRuntime: boolean
  systemId: string
  onChange: (item: FacetDto) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState<FacetDto | null>(null)

  return (
    <CollectionSection
      title='Restrictions'
      description='Limit when this item can be used or applied without burying the rule inside notes.'
      addLabel={item ? 'Edit restrictions' : 'Add restrictions'}
      readOnly={readOnly}
      onAdd={() => setEditing(item ?? createEmptyRestrictions())}
    >
      {item
        ? (
            <CollectionRow
              title='Equipment restrictions'
              description={`${item.groups.length} group${item.groups.length === 1 ? '' : 's'} configured`}
              readOnly={readOnly}
              onOpen={() => setEditing(item)}
              onRemove={onRemove}
            />
          )
        : <Text className={styles.emptyCopy}>No restrictions added yet.</Text>}
      <RuntimeEditorModal
        editorKey={editing?.id ?? 'empty'}
        item={editing}
        labelledBy='equipment-restrictions-editor-heading'
        mapId='facet'
        nodeMap={EQUIPMENT_RESTRICTIONS_NODE_MAP as NodeMap<FacetDto>}
        opened={editing != null}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        systemId={systemId}
        title={readOnly ? 'View Restrictions' : 'Edit Restrictions'}
        titleId='equipment-restrictions-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(next) => {
          onChange(next)
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

function ModifiersSection({
  items,
  readOnly,
  resolveRuntime,
  systemId,
  onChange
}: {
  items: ModifierGrantDto[]
  readOnly: boolean
  resolveRuntime: boolean
  systemId: string
  onChange: (items: ModifierGrantDto[]) => void
}) {
  const [editing, setEditing] = useState<ModifierGrantDto | null>(null)
  const nextOrder = items.length + 1

  return (
    <CollectionSection
      title='Modifiers'
      description='Add bonuses, limits, and replacements that the engine can apply during play.'
      addLabel='Add modifier'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyModifier(nextOrder))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No modifiers added yet.</Text> : null}
      {items.map((item) => (
        <CollectionRow
          key={item.id}
          title={formatModifierTitle(item)}
          description={formatModifierDescription(item)}
          readOnly={readOnly}
          onOpen={() => setEditing(item)}
          onRemove={() => onChange(items.filter((current) => current.id !== item.id))}
        />
      ))}
      <RuntimeEditorModal
        editorKey={editing?.id ?? 'empty'}
        item={editing}
        labelledBy='equipment-modifier-editor-heading'
        mapId='modifierGrant'
        nodeMap={EQUIPMENT_MODIFIER_NODE_MAP as NodeMap<ModifierGrantDto>}
        opened={editing != null}
        readOnly={readOnly}
        resolveRuntime={resolveRuntime}
        systemId={systemId}
        title={readOnly ? 'View Modifier' : 'Edit Modifier'}
        titleId='equipment-modifier-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(next) => {
          onChange(upsertById(items, next))
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
  const nextOrder = items.length + 1

  return (
    <CollectionSection
      title='Features'
      description='Add item-owned feature basics. Deeper feature authoring remains preserved until the standalone Feature pass.'
      addLabel='Add feature'
      readOnly={readOnly}
      onAdd={() => setEditing(createEmptyFeature(nextOrder))}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No equipment features added yet.</Text> : null}
      {items.map((item) => (
        <CollectionRow
          key={item.id}
          title={item.label || `Feature ${item.order}`}
          description={item.description}
          readOnly={readOnly}
          onOpen={() => setEditing(item)}
          onRemove={() => onChange(items.filter((current) => current.id !== item.id))}
        />
      ))}
      <RuntimeEditorModal
        editorKey={editing?.id ?? 'empty'}
        item={editing}
        labelledBy='equipment-feature-editor-heading'
        mapId='feature'
        nodeMap={EQUIPMENT_FEATURE_NODE_MAP as NodeMap<FeatureDto>}
        opened={editing != null}
        readOnly={readOnly}
        resolveRuntime={false}
        title={readOnly ? 'View Feature' : 'Edit Feature'}
        titleId='equipment-feature-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(next) => {
          onChange(upsertById(items, next))
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

function ContainsSection({
  items,
  readOnly,
  runtimeModel,
  systemId,
  onChange
}: {
  items: ContainsDto[]
  readOnly: boolean
  runtimeModel?: NodeRuntimeResolveResponseDto
  systemId: string
  onChange: (items: ContainsDto[]) => void
}) {
  const [editing, setEditing] = useState<{
    item: ContainsDto
    index: number | null
    editorKey: string
  } | null>(null)
  const options = getRuntimeNodeOptions(runtimeModel, 'equipmentId', [])

  return (
    <CollectionSection
      title='Contents'
      description='Represent bundles and containers honestly by listing the equipment this item contains.'
      addLabel='Add contained item'
      readOnly={readOnly}
      onAdd={() => setEditing({
        item: createEmptyContains(),
        index: null,
        editorKey: `new-${items.length + 1}`
      })}
    >
      {items.length === 0 ? <Text className={styles.emptyCopy}>No contained equipment yet.</Text> : null}
      {items.map((item, index) => (
        <ContainedEquipmentRow
          key={`${item.equipmentId}-${index}`}
          item={item}
          options={options}
          readOnly={readOnly}
          onOpen={() => setEditing({
            item,
            index,
            editorKey: `${index}-${item.equipmentId}-${item.quantity}`
          })}
          onRemove={() => onChange(items.filter((_current, itemIndex) => itemIndex !== index))}
        />
      ))}
      <RuntimeEditorModal
        editorKey={editing?.editorKey ?? 'empty'}
        item={editing?.item ?? null}
        labelledBy='equipment-contains-editor-heading'
        mapId='contains'
        nodeMap={CONTAINS_NODE_MAP as NodeMap<ContainsDto>}
        opened={editing != null}
        readOnly={readOnly}
        resolveRuntime
        systemId={systemId}
        title={readOnly ? 'View Contained Item' : 'Edit Contained Item'}
        titleId='equipment-contains-editor-heading'
        onClose={() => setEditing(null)}
        onSave={(next) => {
          onChange(editing?.index == null
            ? [...items, next]
            : items.map((current, itemIndex) => itemIndex === editing.index ? next : current))
          setEditing(null)
        }}
      />
    </CollectionSection>
  )
}

function ContainedEquipmentRow({
  item,
  options,
  readOnly,
  onOpen,
  onRemove
}: {
  item: ContainsDto
  options: readonly { value: string, label: string }[]
  readOnly: boolean
  onOpen: () => void
  onRemove: () => void
}) {
  const label = options.find((option) => option.value === item.equipmentId)?.label ?? (item.equipmentId || 'Unselected item')

  return (
    <div className={styles.collectionRow}>
      <div>
        <Text className={styles.rowTitle}>{label}</Text>
        <Text className={styles.rowDescription}>Quantity {item.quantity}</Text>
      </div>
      <div className={styles.rowActions}>
        <Tooltip label={readOnly ? 'View' : 'Edit'}>
          <ActionIcon
            aria-label={`${readOnly ? 'View' : 'Edit'} ${label}`}
            variant='subtle'
            onClick={onOpen}
          >
            {readOnly ? <IExternalLink size={16} /> : <IEdit size={16} />}
          </ActionIcon>
        </Tooltip>
        {!readOnly
          ? (
              <Tooltip label='Remove'>
                <ActionIcon aria-label={`Remove ${label}`} color='red' variant='subtle' onClick={onRemove}>
                  <IMinus />
                </ActionIcon>
              </Tooltip>
            )
          : null}
      </div>
    </div>
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
      action={!readOnly ? <Button onClick={onAdd}>{addLabel}</Button> : null}
      description={description}
      title={title}
      titleId={`equipment-${title.toLowerCase().replaceAll(' ', '-')}-heading`}
    >
      <div className={styles.collectionList}>{children}</div>
    </AuthoredFormSection>
  )
}

function CollectionRow({
  title,
  description,
  readOnly,
  onOpen,
  onRemove
}: {
  title: string
  description?: string | null
  readOnly: boolean
  onOpen: () => void
  onRemove: () => void
}) {
  return (
    <div className={styles.collectionRow}>
      <div>
        <Text className={styles.rowTitle}>{title}</Text>
        {description ? <Text className={styles.rowDescription}>{description}</Text> : null}
      </div>
      <div className={styles.rowActions}>
        <Tooltip label={readOnly ? 'View' : 'Edit'}>
          <ActionIcon
            aria-label={`${readOnly ? 'View' : 'Edit'} ${title}`}
            variant='subtle'
            onClick={onOpen}
          >
            {readOnly ? <IExternalLink size={16} /> : <IEdit size={16} />}
          </ActionIcon>
        </Tooltip>
        {!readOnly
          ? (
              <Tooltip label='Remove'>
                <ActionIcon aria-label={`Remove ${title}`} color='red' variant='subtle' onClick={onRemove}>
                  <IMinus />
                </ActionIcon>
              </Tooltip>
            )
          : null}
      </div>
    </div>
  )
}

function RuntimeEditorModal<TValues extends object>({
  editorKey,
  item,
  labelledBy,
  mapId,
  nodeMap,
  opened,
  readOnly,
  resolveRuntime,
  systemId,
  title,
  titleId,
  onClose,
  onSave
}: {
  editorKey: string
  item: TValues | null
  labelledBy: string
  mapId: string
  nodeMap: NodeMap<TValues>
  opened: boolean
  readOnly: boolean
  resolveRuntime: boolean
  systemId?: string
  title: string
  titleId: string
  onClose: () => void
  onSave: (item: TValues) => void
}) {
  return (
    <FullscreenModal opened={opened} onClose={onClose} labelledBy={labelledBy}>
      {item
        ? (
            <RuntimeEditorForm
              key={editorKey}
              defaultValue={item}
              mapId={mapId}
              nodeMap={nodeMap}
              readOnly={readOnly}
              resolveRuntime={resolveRuntime}
              systemId={systemId}
              title={title}
              titleId={titleId}
              onClose={onClose}
              onSave={onSave}
            />
          )
        : null}
    </FullscreenModal>
  )
}

function RuntimeEditorForm<TValues extends object>({
  defaultValue,
  mapId,
  nodeMap,
  readOnly,
  resolveRuntime,
  systemId,
  title,
  titleId,
  onClose,
  onSave
}: {
  defaultValue: TValues
  mapId: string
  nodeMap: NodeMap<TValues>
  readOnly: boolean
  resolveRuntime: boolean
  systemId?: string
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
    <form.AppForm>
      <RuntimeEditorShell
        title={title}
        titleId={titleId}
        readOnly={readOnly}
        onClose={onClose}
        onSubmit={() => form.handleSubmit()}
      >
        <form.Subscribe selector={(state) => state.values}>
          {(values) => (
            <RuntimeNodeEditor
              enabled={resolveRuntime}
              form={form}
              mapId={mapId}
              nodeMap={nodeMap}
              readOnly={readOnly}
              systemId={systemId}
              values={values}
            />
          )}
        </form.Subscribe>
      </RuntimeEditorShell>
    </form.AppForm>
  )
}

function RuntimeNodeEditor<TValues extends object>({
  enabled,
  form,
  mapId,
  nodeMap,
  readOnly,
  systemId,
  values
}: {
  enabled: boolean
  form: RuntimeNodeForm & ClearableRuntimeForm<TValues>
  mapId: string
  nodeMap: NodeMap<TValues>
  readOnly: boolean
  systemId?: string
  values: TValues
}) {
  const runtimeModel = useNodeRuntimeModel({
    mapId,
    values: toRuntimeValues(values),
    systemId,
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

function RuntimeEditorShell({
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
        <h2 id={titleId} className={styles.modalTitle}>{title}</h2>
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
  const existing = items.some((current) => current.id === item.id)
  if (!existing) return [...items, item]
  return items.map((current) => current.id === item.id ? item : current)
}

function formatModifierTitle(modifier: ModifierGrantDto): string {
  return `${formatCodeLabel(modifier.valueDomainCode)} ${formatCodeLabel(modifier.modifierKind)}`
}

function formatModifierDescription(modifier: ModifierGrantDto): string {
  const scope = formatCodeLabel(modifier.scope)
  const selection = formatCodeLabel(modifier.selectionKind)
  return `${selection} / ${scope}`
}

function formatCodeLabel(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function toOptions(options: readonly { code: string, label: string }[]) {
  return options.map((option) => ({
    value: option.code,
    label: option.label
  }))
}
