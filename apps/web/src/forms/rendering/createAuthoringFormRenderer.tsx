import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ActionIcon, Alert, Button, Collapse, Group, Menu, Text, Tooltip } from '@mantine/core'
import { useStore } from '@tanstack/react-form'
import type { DeepKeys } from '@tanstack/form-core'
import type { NodeRuntimeNodeDto, NodeRuntimePathDto, NodeRuntimeSectionDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { EffectDto } from '@artificer-toolkit/schema/effects'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import ITrash from '#assets/icons/ITrash'
import { AuthoringFocusedWorkspace } from '../editors/AuthoringFocusedWorkspace'
import { useAuthoringEditorFooterState, useAuthoringEditorStepNav } from '../editors/AuthoringEditorHeaderContext'
import { AuthoringFormSectionRow } from '../components/AuthoringFormSectionRow'
import { useAuthoringForm, useAuthoringFormRegistration } from '../components/AuthoringFormContext'
import { AuthoringFormStepNav } from '../navigation/AuthoringFormStepNav'
import { clearResolvedNodeFormPaths, toResolvedNodeValues } from '../node-map/nodeFormUtils'
import { getVisibleAuthoringSteps, useAuthoringResolvedModel } from '../hooks/useAuthoringResolvedModel'
import { requiredArray, requiredNumber, requiredSelect, requiredString, validatorsFor } from '../validation/formValidation'
import { withFieldGroup, withForm } from '../app-form/AppForm'
import {
  createDefaultAuthoringArrayItem,
  createDefaultAuthoringNodeValue,
  createDefaultAuthoringObjectItem,
  formatEffectDescription,
  formatEffectSummary,
  formatResultBlockSummary,
  type AuthoringGroupValues
} from './authoringNodeDefaults'
import {
  getAuthoringFieldValue,
  prefixRuntimePaths,
  toTypedAuthoringArrayFieldName,
  toTypedAuthoringFieldName,
  toTypedAuthoringGroupFieldName
} from '../utils/pathUtils'
import {
  fieldGrid,
  formShell,
  compactInlineArrayItem,
  compactInlineArrayItemContent,
  damageScalingArrayList,
  damageScalingItem,
  inlineArrayItemActions,
  inlineArrayItemBody,
  inlineArrayItemChevron,
  inlineArrayItemChevronOpen,
  inlineArrayItemDescription,
  inlineArrayItem,
  inlineArrayItemHeader,
  inlineArrayItemTitle,
  inlineArrayItemTrigger,
  inlineArrayList,
  inlineObjectSection,
  inlineObjectStack,
  sectionStack,
  startingEquipmentArrayList,
  startingEquipmentGroupItem,
  startingEquipmentItemRow,
  startingEquipmentOptionItem,
  startingEquipmentSetBody,
  startingEquipmentSetItem,
  wideField
} from '../components/formStyles.css'
import * as styles from '../layout/AuthoringFormLayout.css'

const EMPTY_CLEAR_PATHS: readonly NodeRuntimePathDto[] = []
const EMPTY_ANCESTORS: readonly Record<string, unknown>[] = []
const INLINE_OBJECT_GROUP_CHILD_MAP_IDS = new Set(['charges', 'facet', 'featureGrants', 'raceAncestry', 'startingEquipment'])
const DETAIL_CHILD_MAP_IDS = new Set(['backgroundDetail', 'classDetail', 'creatureDetail', 'detail', 'raceDetail', 'vehicleDetail'])
const EFFECT_ARRAY_CHILD_MAP_IDS = new Set(['effect'])
const GRANT_ARRAY_CHILD_MAP_IDS = new Set(['featGrant', 'modifierGrant', 'proficiencyGrant', 'senseGrant', 'spellGrant'])
const OPTION_ARRAY_CHILD_MAP_IDS = new Set(['featureOptionChoice', 'option', 'raceAncestryOption'])
const STARTING_EQUIPMENT_ARRAY_CHILD_MAP_IDS = new Set([
  'startingEquipmentCurrency',
  'startingEquipmentGroup',
  'startingEquipmentItem',
  'startingEquipmentOption',
  'startingEquipmentSet'
])
const COLLAPSIBLE_INLINE_ARRAY_CHILD_MAP_IDS = new Set([
  ...EFFECT_ARRAY_CHILD_MAP_IDS,
  ...GRANT_ARRAY_CHILD_MAP_IDS,
  ...OPTION_ARRAY_CHILD_MAP_IDS,
  ...STARTING_EQUIPMENT_ARRAY_CHILD_MAP_IDS
])
const INLINE_ARRAY_GROUP_CHILD_MAP_IDS = new Set([
  ...DETAIL_CHILD_MAP_IDS,
  ...EFFECT_ARRAY_CHILD_MAP_IDS,
  ...GRANT_ARRAY_CHILD_MAP_IDS,
  ...OPTION_ARRAY_CHILD_MAP_IDS,
  ...STARTING_EQUIPMENT_ARRAY_CHILD_MAP_IDS,
  'speed'
])
const DIRECT_INLINE_OBJECT_CHILD_MAP_IDS = new Set(['raceAncestry'])
const EFFECT_EDITOR_DIRECT_INLINE_OBJECT_CHILD_MAP_IDS = new Set(['nonManifestResultBlock', 'resultBlock'])
const EFFECT_EDITOR_MODAL_ARRAY_CHILD_MAP_IDS = new Set(['nonManifestOutcome', 'outcome'])
const EFFECT_EDITOR_MAP_IDS = new Set(['effect'])
const SYSTEM_MANAGED_FIELD_KEYS = new Set(['id', 'order', 'systemId', 'userId'])
const PROSE_FIELD_KEYS = new Set(['description', 'detail', 'quote'])
const PATH_CODE_LABELS = new Map<string, string>([
  ['PASSIVE', 'Passive'],
  ['ON_USE', 'On Use'],
  ['ON_CAST', 'On Cast'],
  ['ON_ATTACK', 'On Attack'],
  ['ON_HIT', 'On Hit'],
  ['ON_MISS', 'On Miss'],
  ['ON_CRIT', 'On Critical Hit'],
  ['ON_SAVE_FAIL', 'On Save Failure'],
  ['ON_SAVE_SUCCESS', 'On Save Success'],
  ['START_OF_TURN', 'Start of Turn'],
  ['END_OF_TURN', 'End of Turn'],
  ['ON_MOVE', 'On Move'],
  ['ON_HP_ZERO', 'On HP Zero']
])
const FEATURE_GRANT_CONFIGS = [
  { pathKey: 'feats', childMapId: 'featGrant', label: 'Feat Grant' },
  { pathKey: 'modifiers', childMapId: 'modifierGrant', label: 'Modifier Grant' },
  { pathKey: 'proficiencies', childMapId: 'proficiencyGrant', label: 'Proficiency Grant' },
  { pathKey: 'senses', childMapId: 'senseGrant', label: 'Sense Grant' },
  { pathKey: 'spells', childMapId: 'spellGrant', label: 'Spell Grant' }
] as const

type ActiveGroupNode = {
  activeStepId?: string
  breadcrumbs: readonly string[]
  effectEditor?: boolean
  itemTitle?: string
  node: NodeRuntimeNodeDto
  onRemove?: () => void
  path: readonly (string | number)[]
  readOnly: boolean
}

type AuthoringEditorController = {
  closeAllEditors: () => void
  closeEditor: () => void
  openEditor: (editor: ActiveGroupNode) => void
}

type SharedRendererProps = {
  debounceMs?: number
  fieldPathPrefix?: string
  mapId?: string
  readOnly?: boolean
  registerSession?: boolean
  resolveModel?: boolean
  systemId?: string
}

type GroupRendererProps = {
  activeStepId?: string
  ancestors?: readonly Record<string, unknown>[]
  debounceMs?: number
  editorController?: AuthoringEditorController
  editorBreadcrumbs?: readonly string[]
  effectEditor?: boolean
  inlineObject?: boolean
  mapId: string
  parentValues?: Record<string, unknown>
  pathPrefix?: readonly (string | number)[]
  readOnly?: boolean
  onActiveStepChange?: (stepId: string | undefined) => void
  renderStepNavInHeader?: boolean
  resolveModel?: boolean
  systemId?: string
}

export type CreateAuthoringFormRendererOptions<
  TValues extends object
> = {
  defaultValues: TValues
}

export function createAuthoringFormRenderer<TValues extends object>({
  defaultValues
}: CreateAuthoringFormRendererOptions<TValues>) {
  const GroupRenderer = withFieldGroup({
    defaultValues: {} as AuthoringGroupValues,
    props: {} as GroupRendererProps,
    render: function AuthoringGroupRenderer({
      activeStepId,
      ancestors = EMPTY_ANCESTORS,
      debounceMs = 100,
      editorController,
      editorBreadcrumbs = [],
      effectEditor = false,
      group,
      inlineObject = false,
      mapId,
      onActiveStepChange,
      parentValues,
      pathPrefix = [],
      readOnly,
      renderStepNavInHeader = false,
      resolveModel = true,
      systemId
    }) {
      const values = useStore(group.store, (state) => toResolvedNodeValues(state.values))
      const childAncestors = useMemo(() => (
        parentValues ? [parentValues, ...ancestors] : ancestors
      ), [ancestors, parentValues])
      const { model: activeModel } = useAuthoringResolvedModel({
        ancestors,
        debounceMs,
        mapId,
        parentValues,
        resolveModel,
        systemId,
        values
      })
      const visibleSteps = getVisibleAuthoringSteps(activeModel)
      const isEffectEditor = effectEditor || EFFECT_EDITOR_MAP_IDS.has(mapId)
      const visibleStepIds = visibleSteps.map((step) => step.id)
      const visibleStepIdKey = visibleStepIds.join('|')
      const [internalStepId, setInternalStepIdState] = useState<string | undefined>(() => activeStepId)
      const [activeEditor, setActiveEditor] = useState<ActiveGroupNode | null>(null)
      const [expandedInlineRows, setExpandedInlineRows] = useState<ReadonlySet<string>>(() => new Set())
      const setInternalStepId = useCallback((stepId: string | undefined) => {
        setInternalStepIdState(stepId)
        onActiveStepChange?.(stepId)
      }, [onActiveStepChange])
      useEffect(() => {
        if (activeStepId === undefined) return

        const nextStepId = visibleStepIds.includes(activeStepId)
          ? activeStepId
          : visibleStepIds[0]
        setInternalStepIdState((current) => (current === nextStepId ? current : nextStepId))
        if (nextStepId !== activeStepId) onActiveStepChange?.(nextStepId)
      }, [
        activeStepId,
        onActiveStepChange,
        visibleStepIdKey
      ])
      const openEditor = useCallback((editor: ActiveGroupNode) => {
        if (editorController) {
          editorController.openEditor(editor)
          return
        }

        setActiveEditor(editor)
      }, [editorController])
      const updateActiveEditorStepId = useCallback((stepId: string | undefined) => {
        setActiveEditor((current) => {
          if (!current || current.activeStepId === stepId) return current
          return { ...current, activeStepId: stepId }
        })
      }, [])
      const closeEditor = useCallback(() => {
        if (editorController) {
          editorController.closeEditor()
          return
        }

        setActiveEditor(null)
      }, [editorController])
      const closeAllEditors = useCallback(() => {
        if (editorController) {
          editorController.closeAllEditors()
          return
        }

        setActiveEditor(null)
      }, [editorController])
      const toEditorPath = useCallback((path: readonly (string | number)[]) => (
        editorController ? [...pathPrefix, ...path] : path
      ), [editorController, pathPrefix])
      const currentStep = visibleSteps.find((step) => step.id === internalStepId) ?? visibleSteps[0]
      const currentStepLabel = currentStep?.label
      const currentIndex = currentStep ? visibleSteps.findIndex((step) => step.id === currentStep.id) : 0
      const isLastStep = currentIndex === visibleSteps.length - 1
      const goToNextStep = useCallback(() => {
        setInternalStepId(visibleSteps[Math.min(currentIndex + 1, visibleSteps.length - 1)]?.id)
      }, [currentIndex, visibleSteps])
      const goToPreviousStep = useCallback(() => {
        setInternalStepId(visibleSteps[Math.max(currentIndex - 1, 0)]?.id)
      }, [currentIndex, visibleSteps])
      const resetCurrentStep = useCallback(() => {
        resetVisibleStepFields(group, currentStep?.sections ?? [])
      }, [currentStep, group])
      const visibleSections = inlineObject
        ? visibleSteps.flatMap((step) => step.sections)
        : currentStep?.sections ?? []
      const clearPaths = activeModel?.clearPaths ?? EMPTY_CLEAR_PATHS
      const clearPathKey = clearPaths.map((path) => path.join('.')).join('|')
      const rootHasChanges = useStore(group.form.store, (state) => state.isDirty)
      const currentStepHasChanges = useStore(group.form.store, (state) => (
        hasVisibleStepChanges(group, currentStep?.sections ?? [], undefined, state.fieldMeta)
      ))
      const stepStatuses = useMemo(() => (
        currentStep?.id && currentStepHasChanges
          ? { [currentStep.id]: 'dirty' as const }
          : undefined
      ), [currentStep?.id, currentStepHasChanges])
      const stepNav = useMemo(() => (!inlineObject && visibleSteps.length > 1 && currentStep
        ? (
            <AuthoringFormStepNav
              activeStep={currentStep.id}
              onStepChange={setInternalStepId}
              stepStatuses={stepStatuses}
              steps={visibleSteps}
              variant={renderStepNavInHeader ? 'rail' : 'inline'}
            />
          )
        : null), [currentStep, inlineObject, renderStepNavInHeader, setInternalStepId, stepStatuses, visibleSteps])

      useEffect(() => {
        if (!rootHasChanges) return
        if (clearPaths.length === 0) return
        clearResolvedNodeFormPaths(group, clearPaths)
      }, [
        clearPathKey,
        clearPaths,
        group,
        rootHasChanges
      ])
      useAuthoringEditorStepNav(renderStepNavInHeader ? stepNav : null)
      const editorFooterState = useMemo(() => (renderStepNavInHeader && currentStep
        ? {
            canGoBack: currentIndex > 0,
            canGoNext: !isLastStep,
            hasStepChanges: currentStepHasChanges,
            onNext: goToNextStep,
            onPrevious: goToPreviousStep,
            onResetStep: resetCurrentStep,
            readOnly
          }
        : null), [
        currentIndex,
        currentStep,
        goToNextStep,
        goToPreviousStep,
        currentStepHasChanges,
        isLastStep,
        readOnly,
        renderStepNavInHeader,
        resetCurrentStep
      ])
      useAuthoringEditorFooterState(editorFooterState)

      if (!activeModel || (!inlineObject && !currentStep)) return null

      return (
        <div className={inlineObject ? inlineObjectStack : formShell}>
          {!renderStepNavInHeader ? stepNav : null}
          <div className={inlineObject ? inlineObjectStack : sectionStack}>
            {visibleSections
              .filter((section) => section.nodes.some((node) => node.visible && !isSystemManagedFieldNode(node)))
              .map((section) => {
                const showSectionHeader = !shouldHideSectionHeader(section, visibleSections)
                if (mapId === 'featureGrants') {
                  const sectionContent = (
                    <div className={inlineObjectStack}>
                      <Group justify='space-between' mb='xs'>
                        <Text className={styles.sectionTitle}>Grants</Text>
                        {!readOnly
                          ? (
                              <Menu position='bottom-start' withinPortal>
                                <Menu.Target>
                                  <Button type='button' variant='default'>Add Grant</Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  {section.nodes
                                    .filter((node) => node.visible && node.kind === 'GROUP' && node.groupKind === 'ARRAY')
                                    .map((node) => {
                                      const config = getFeatureGrantConfig(node)
                                      const arrayFieldName = toTypedAuthoringArrayFieldName<AuthoringGroupValues>(undefined, node.path)

                                      return (
                                        <group.AppField key={node.id} name={arrayFieldName} mode='array'>
                                          {(field) => (
                                            <Menu.Item
                                              onClick={() => {
                                                const items = toRuntimeArray(field.state.value)
                                                const nextItem = createDefaultAuthoringArrayItem(node, items.length)
                                                field.pushValue(nextItem as Parameters<typeof field.pushValue>[0])
                                                setExpandedInlineRows((current) => addSetValue(current, `grant-section-${node.id}`))
                                              }}
                                            >
                                              {`Add ${config?.label ?? singularizeLabel(node.label)}`}
                                            </Menu.Item>
                                          )}
                                        </group.AppField>
                                      )
                                    })}
                                </Menu.Dropdown>
                              </Menu>
                            )
                          : null}
                      </Group>
                      <div className={inlineArrayList}>
                        {section.nodes.map((node) => {
                          if (!node.visible || node.kind !== 'GROUP' || node.groupKind !== 'ARRAY') return null

                          const arrayFieldName = toTypedAuthoringArrayFieldName<AuthoringGroupValues>(undefined, node.path)

                          return (
                            <group.AppField key={node.id} name={arrayFieldName} mode='array'>
                              {(field) => {
                                const items = toRuntimeArray(field.state.value)
                                const sectionKey = `grant-section-${node.id}`
                                const opened = expandedInlineRows.has(sectionKey)

                                if (items.length === 0) return null

                                return (
                                  <div className={inlineArrayItem}>
                                    <div className={inlineArrayItemHeader}>
                                      <button
                                        aria-expanded={opened}
                                        className={inlineArrayItemTrigger}
                                        type='button'
                                        onClick={() => setExpandedInlineRows((current) => toggleSetValue(current, sectionKey))}
                                      >
                                        <ChevronDown
                                          aria-hidden='true'
                                          className={clsx(inlineArrayItemChevron, opened && inlineArrayItemChevronOpen)}
                                          size={16}
                                        />
                                        <Text className={inlineArrayItemTitle} component='span'>{node.label}</Text>
                                      </button>
                                    </div>
                                    <Collapse expanded={opened}>
                                      <div className={inlineArrayItemBody}>
                                        {items.map((item, index) => {
                                          const title = getArrayItemTitle(node, item, index)
                                          const rowKey = getInlineArrayItemKey(node, item, index)

                                          return (
                                            <div className={inlineArrayItem} key={rowKey}>
                                              <div className={inlineArrayItemHeader}>
                                                <Text className={inlineArrayItemTitle}>{title}</Text>
                                                {!readOnly
                                                  ? (
                                                      <Tooltip label={`Remove ${title}`} withArrow>
                                                        <ActionIcon
                                                          aria-label={`Remove ${title}`}
                                                          color='red'
                                                          type='button'
                                                          variant='subtle'
                                                          onClick={() => field.removeValue(index)}
                                                        >
                                                          <ITrash size={16} />
                                                        </ActionIcon>
                                                      </Tooltip>
                                                    )
                                                  : null}
                                              </div>
                                              <GroupRenderer
                                                form={group}
                                                fields={toTypedAuthoringGroupFieldName<AuthoringGroupValues, AuthoringGroupValues>(undefined, [...node.path, index])}
                                                ancestors={childAncestors}
                                                editorController={editorController}
                                                editorBreadcrumbs={buildEditorBreadcrumbs(editorBreadcrumbs, inlineObject ? undefined : currentStepLabel, node.label, title)}
                                                effectEditor={isEffectEditor}
                                                inlineObject
                                                mapId={node.childMapId!}
                                                parentValues={values}
                                                pathPrefix={editorController ? [...pathPrefix, ...node.path, index] : undefined}
                                                readOnly={readOnly}
                                                resolveModel={resolveModel}
                                                systemId={systemId}
                                              />
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </Collapse>
                                  </div>
                                )
                              }}
                            </group.AppField>
                          )
                        })}
                      </div>
                    </div>
                  )

                  return inlineObject
                    ? <div key={section.id} className={inlineObjectSection}>{sectionContent}</div>
                    : (
                        <section key={section.id} className={styles.section}>
                          {sectionContent}
                        </section>
                      )
                }
                const sectionContent = (
                  <div className={fieldGrid}>
                    {section.nodes.map((node) => {
                      if (!node.visible) return null
                      if (isSystemManagedFieldNode(node)) return null

                      const fieldName = toTypedAuthoringFieldName<AuthoringGroupValues>(undefined, node.path)
                      const nodeReadOnly = Boolean(readOnly || node.readOnly || node.disabled)

                      if (node.kind === 'GROUP') {
                        if (node.groupKind === 'ARRAY') {
                          const arrayFieldName = toTypedAuthoringArrayFieldName<AuthoringGroupValues>(undefined, node.path)

                          return (
                            <group.AppField key={node.id} name={arrayFieldName} mode='array'>
                              {(field) => {
                                const items = toRuntimeArray(field.state.value)
                                const collapseRows = shouldCollapseInlineArrayGroup(node, isEffectEditor)

                                if (shouldRenderInlineArrayGroup(node, isEffectEditor)) {
                                  return (
                                    <div className={wideField}>
                                      <Group justify='space-between' mb='xs'>
                                        <Text className={styles.sectionTitle}>{node.label}</Text>
                                        {!nodeReadOnly
                                          ? (
                                              <Button
                                                type='button'
                                                variant='default'
                                                onClick={() => {
                                                  const nextItem = createDefaultAuthoringArrayItem(node, items.length)
                                                  const rowKey = getInlineArrayItemKey(node, nextItem, items.length)
                                                  field.pushValue(nextItem as Parameters<typeof field.pushValue>[0])
                                                  if (collapseRows) {
                                                    setExpandedInlineRows((current) => addSetValue(current, rowKey))
                                                  }
                                                }}
                                              >
                                                {`Add ${singularizeLabel(node.label)}`}
                                              </Button>
                                            )
                                          : null}
                                      </Group>
                                      <div className={getInlineArrayListClassName(node)}>
                                        {items.map((item, index) => {
                                          const title = isSpeedArrayNode(node) ? singularizeLabel(node.label) : getArrayItemTitle(node, item, index)
                                          const description = getArrayItemDescription(node, item)
                                          const rowKey = getInlineArrayItemKey(node, item, index)
                                          const opened = expandedInlineRows.has(rowKey)
                                          const childIsEffectEditor = isEffectEditor || EFFECT_EDITOR_MAP_IDS.has(node.childMapId ?? '')
                                          const content = (
                                            <GroupRenderer
                                              form={group}
                                              fields={toTypedAuthoringGroupFieldName<AuthoringGroupValues, AuthoringGroupValues>(undefined, [...node.path, index])}
                                              ancestors={childAncestors}
                                              editorController={editorController}
                                              editorBreadcrumbs={buildEditorBreadcrumbs(editorBreadcrumbs, inlineObject ? undefined : currentStepLabel, node.label, title)}
                                              effectEditor={childIsEffectEditor}
                                              inlineObject
                                              mapId={node.childMapId!}
                                              parentValues={values}
                                              pathPrefix={editorController ? [...pathPrefix, ...node.path, index] : undefined}
                                              readOnly={nodeReadOnly}
                                              resolveModel={resolveModel}
                                              systemId={systemId}
                                            />
                                          )

                                          if (!collapseRows) {
                                            if (isCompactInlineArrayRowsNode(node)) {
                                              return (
                                                <div className={clsx(getInlineArrayItemClassName(node), compactInlineArrayItem)} key={rowKey}>
                                                  <div className={compactInlineArrayItemContent}>{content}</div>
                                                  {!nodeReadOnly
                                                    ? (
                                                        <Tooltip label='Remove' withArrow>
                                                          <ActionIcon
                                                            aria-label={`Remove ${title}`}
                                                            color='red'
                                                            type='button'
                                                            variant='subtle'
                                                            onClick={() => field.removeValue(index)}
                                                          >
                                                            <ITrash size={16} />
                                                          </ActionIcon>
                                                        </Tooltip>
                                                      )
                                                    : null}
                                                </div>
                                              )
                                            }

                                            return (
                                              <div className={getInlineArrayItemClassName(node)} key={rowKey}>
                                                <div className={inlineArrayItemHeader}>
                                                  <Text className={inlineArrayItemTitle}>{title}</Text>
                                                  {description
                                                    ? <Text className={inlineArrayItemDescription}>{description}</Text>
                                                    : null}
                                                  {!nodeReadOnly
                                                    ? (
                                                        <Tooltip label='Remove' withArrow>
                                                          <ActionIcon
                                                            aria-label={`Remove ${title}`}
                                                            color='red'
                                                            type='button'
                                                            variant='subtle'
                                                            onClick={() => field.removeValue(index)}
                                                          >
                                                            <ITrash size={16} />
                                                          </ActionIcon>
                                                        </Tooltip>
                                                      )
                                                    : null}
                                                </div>
                                                {content}
                                              </div>
                                            )
                                          }

                                          return (
                                            <div className={getInlineArrayItemClassName(node)} key={rowKey}>
                                              <div className={inlineArrayItemHeader}>
                                                <button
                                                  aria-expanded={opened}
                                                  className={inlineArrayItemTrigger}
                                                  type='button'
                                                  onClick={() => setExpandedInlineRows((current) => toggleSetValue(current, rowKey))}
                                                >
                                                  <ChevronDown
                                                    aria-hidden='true'
                                                    className={clsx(inlineArrayItemChevron, opened && inlineArrayItemChevronOpen)}
                                                    size={16}
                                                  />
                                                  <span>
                                                    <Text className={inlineArrayItemTitle} component='span'>{title}</Text>
                                                    {description
                                                      ? <Text className={inlineArrayItemDescription} component='span'>{description}</Text>
                                                      : null}
                                                  </span>
                                                </button>
                                                <div className={inlineArrayItemActions}>
                                                  {!nodeReadOnly
                                                    ? (
                                                        <Tooltip label='Remove' withArrow>
                                                          <ActionIcon
                                                            aria-label={`Remove ${title}`}
                                                            color='red'
                                                            type='button'
                                                            variant='subtle'
                                                            onClick={() => field.removeValue(index)}
                                                          >
                                                            <ITrash size={16} />
                                                          </ActionIcon>
                                                        </Tooltip>
                                                      )
                                                    : null}
                                                </div>
                                              </div>
                                              <Collapse expanded={opened}>
                                                <div className={getInlineArrayItemBodyClassName(node)}>{content}</div>
                                              </Collapse>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                }

                                return (
                                  <div className={wideField}>
                                    <Group justify='space-between' mb='xs'>
                                      <Text className={styles.sectionTitle}>{node.label}</Text>
                                      {!nodeReadOnly
                                        ? (
                                            <Button
                                              type='button'
                                              variant='default'
                                              onClick={() => {
                                                const nextIndex = items.length
                                                const nextItem = createDefaultAuthoringArrayItem(node, nextIndex)
                                                field.pushValue(nextItem as Parameters<typeof field.pushValue>[0])
                                                openEditor(createArrayEditorState({
                                                  currentStepLabel: inlineObject ? undefined : currentStepLabel,
                                                  effectEditor: isEffectEditor,
                                                  item: nextItem,
                                                  index: nextIndex,
                                                  node,
                                                  onRemove: () => {
                                                    field.removeValue(nextIndex)
                                                    closeEditor()
                                                  },
                                                  parentBreadcrumbs: editorBreadcrumbs,
                                                  path: toEditorPath([...node.path, nextIndex]),
                                                  readOnly: nodeReadOnly
                                                }))
                                              }}
                                            >
                                              {`Add ${singularizeLabel(node.label)}`}
                                            </Button>
                                          )
                                        : null}
                                    </Group>
                                    {items.length === 0 && !isDetailArrayNode(node)
                                      ? <Text className={styles.mutedText} size='sm'>{`No ${node.label.toLowerCase()} yet.`}</Text>
                                      : items.map((item, index) => (
                                        <AuthoringFormSectionRow
                                          key={`${node.id}-${index}`}
                                          description={getArrayItemDescription(node, item)}
                                          readOnly={nodeReadOnly}
                                          title={getArrayItemTitle(node, item, index)}
                                          onOpen={node.childMapId
                                            ? () => openEditor(createArrayEditorState({
                                                currentStepLabel: inlineObject ? undefined : currentStepLabel,
                                                effectEditor: isEffectEditor,
                                                item,
                                                index,
                                                node,
                                                onRemove: () => {
                                                  field.removeValue(index)
                                                  closeEditor()
                                                },
                                                parentBreadcrumbs: editorBreadcrumbs,
                                                path: toEditorPath([...node.path, index]),
                                                readOnly: nodeReadOnly
                                              }))
                                            : undefined}
                                          onRemove={() => field.removeValue(index)}
                                        />
                                      ))}
                                  </div>
                                )
                              }}
                            </group.AppField>
                          )
                        }

                        if (shouldRenderInlineObjectGroup(node, isEffectEditor)) {
                          return (
                            <group.AppField key={node.id} name={fieldName}>
                              {(field) => {
                                const hasValue = isRuntimeRecord(field.state.value)
                                const objectKey = getInlineObjectItemKey(pathPrefix, node)
                                const objectConfigured = hasConfiguredObjectGroupValue(node, field.state.value)
                                const objectOpened = expandedInlineRows.has(objectKey)
                                const shouldShowObject = hasValue && (
                                  node.required
                                  || objectConfigured
                                  || objectOpened
                                  || shouldRenderDirectInlineObjectNode(node, isEffectEditor)
                                )
                                const objectDescription = getObjectGroupDescription(node, field.state.value)

                                return (
                                  <div className={wideField}>
                                    {shouldShowObject
                                      ? (
                                          isFeatureGrantsObjectNode(node) || shouldRenderDirectInlineObjectNode(node, isEffectEditor)
                                            ? (
                                                <GroupRenderer
                                                  form={group}
                                                  fields={toTypedAuthoringGroupFieldName<AuthoringGroupValues, AuthoringGroupValues>(undefined, node.path)}
                                                  ancestors={childAncestors}
                                                  editorController={editorController}
                                                  editorBreadcrumbs={buildEditorBreadcrumbs(editorBreadcrumbs, inlineObject ? undefined : currentStepLabel, node.label)}
                                                  effectEditor={isEffectEditor}
                                                  inlineObject
                                                  mapId={node.childMapId!}
                                                  parentValues={values}
                                                  pathPrefix={editorController ? [...pathPrefix, ...node.path] : undefined}
                                                  readOnly={nodeReadOnly}
                                                  resolveModel={resolveModel}
                                                  systemId={systemId}
                                                />
                                              )
                                            : node.required
                                              ? (
                                                  <GroupRenderer
                                                    form={group}
                                                    fields={toTypedAuthoringGroupFieldName<AuthoringGroupValues, AuthoringGroupValues>(undefined, node.path)}
                                                    ancestors={childAncestors}
                                                    editorController={editorController}
                                                    editorBreadcrumbs={buildEditorBreadcrumbs(editorBreadcrumbs, inlineObject ? undefined : currentStepLabel, node.label)}
                                                    effectEditor={isEffectEditor}
                                                    inlineObject
                                                    mapId={node.childMapId!}
                                                    parentValues={values}
                                                    pathPrefix={editorController ? [...pathPrefix, ...node.path] : undefined}
                                                    readOnly={nodeReadOnly}
                                                    resolveModel={resolveModel}
                                                    systemId={systemId}
                                                  />
                                                )
                                              : (
                                                  <div className={inlineArrayItem}>
                                                    <div className={inlineArrayItemHeader}>
                                                      <button
                                                        aria-expanded={objectOpened}
                                                        className={inlineArrayItemTrigger}
                                                        type='button'
                                                        onClick={() => setExpandedInlineRows((current) => toggleSetValue(current, objectKey))}
                                                      >
                                                        <ChevronDown
                                                          aria-hidden='true'
                                                          className={clsx(inlineArrayItemChevron, objectOpened && inlineArrayItemChevronOpen)}
                                                          size={16}
                                                        />
                                                        <span>
                                                          <Text className={inlineArrayItemTitle} component='span'>{node.label}</Text>
                                                          {objectDescription
                                                            ? <Text className={inlineArrayItemDescription} component='span'>{objectDescription}</Text>
                                                            : null}
                                                        </span>
                                                      </button>
                                                      {!nodeReadOnly
                                                        ? (
                                                            <Tooltip label={`Remove ${node.label}`} withArrow>
                                                              <ActionIcon
                                                                aria-label={`Remove ${node.label}`}
                                                                color='red'
                                                                type='button'
                                                                variant='subtle'
                                                                onClick={() => field.handleChange((_current: unknown) => undefined as typeof _current)}
                                                              >
                                                                <ITrash size={16} />
                                                              </ActionIcon>
                                                            </Tooltip>
                                                          )
                                                        : null}
                                                    </div>
                                                    <Collapse expanded={objectOpened}>
                                                      <div className={inlineArrayItemBody}>
                                                        <GroupRenderer
                                                          form={group}
                                                          fields={toTypedAuthoringGroupFieldName<AuthoringGroupValues, AuthoringGroupValues>(undefined, node.path)}
                                                          ancestors={childAncestors}
                                                          editorController={editorController}
                                                          editorBreadcrumbs={buildEditorBreadcrumbs(editorBreadcrumbs, inlineObject ? undefined : currentStepLabel, node.label)}
                                                          effectEditor={isEffectEditor}
                                                          inlineObject
                                                          mapId={node.childMapId!}
                                                          parentValues={values}
                                                          pathPrefix={editorController ? [...pathPrefix, ...node.path] : undefined}
                                                          readOnly={nodeReadOnly}
                                                          resolveModel={resolveModel}
                                                          systemId={systemId}
                                                        />
                                                      </div>
                                                    </Collapse>
                                                  </div>
                                                )
                                        )
                                      : (
                                          <Group justify='end' align='center'>
                                            {!nodeReadOnly
                                              ? isFeatureGrantsObjectNode(node)
                                                ? (
                                                    <Menu position='bottom-start' withinPortal>
                                                      <Menu.Target>
                                                        <Button type='button' variant='default'>Add Grant</Button>
                                                      </Menu.Target>
                                                      <Menu.Dropdown>
                                                        {FEATURE_GRANT_CONFIGS.map((config) => (
                                                          <Menu.Item
                                                            key={config.pathKey}
                                                            onClick={() => field.handleChange(createFeatureGrantsWithGrant(config) as typeof field.state.value)}
                                                          >
                                                            {`Add ${config.label}`}
                                                          </Menu.Item>
                                                        ))}
                                                      </Menu.Dropdown>
                                                    </Menu>
                                                  )
                                                : (
                                                  <Button
                                                    type='button'
                                                    variant='default'
                                                    onClick={() => {
                                                      field.handleChange(createDefaultAuthoringObjectItem(node) as typeof field.state.value)
                                                      setExpandedInlineRows((current) => addSetValue(current, objectKey))
                                                    }}
                                                  >
                                                    {`Add ${node.label}`}
                                                  </Button>
                                                )
                                              : null}
                                          </Group>
                                        )}
                                  </div>
                                )
                              }}
                            </group.AppField>
                          )
                        }

                        return (
                          <group.AppField key={node.id} name={fieldName}>
                            {(field) => (
                              <div className={wideField}>
                                <AuthoringFormSectionRow
                                  readOnly={nodeReadOnly}
                                  title={node.label}
                                  onOpen={node.childMapId
                                    ? () => {
                                        if (field.state.value === undefined || field.state.value === null) {
                                          field.handleChange((current: unknown) => (
                                            current ?? createDefaultAuthoringObjectItem(node)
                                          ) as typeof current)
                                        }
                                        openEditor({
                                          breadcrumbs: buildEditorBreadcrumbs(editorBreadcrumbs, inlineObject ? undefined : currentStepLabel, node.label),
                                          effectEditor: isEffectEditor,
                                          node,
                                          path: toEditorPath(node.path),
                                          readOnly: nodeReadOnly
                                        })
                                      }
                                    : undefined}
                                  onRemove={!nodeReadOnly && !node.required
                                    ? () => field.handleChange((_current: unknown) => undefined as typeof _current)
                                    : undefined}
                                />
                              </div>
                            )}
                          </group.AppField>
                        )
                      }

                      const inputType = getEffectiveInputType(node)
                      const validators = node.required ? getRequiredValidators(inputType, node.label) : undefined

                      switch (inputType) {
                        case 'TEXT':
                          return (
                            <group.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.TextField
                                  label={node.label}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </group.AppField>
                          )
                        case 'NUMBER':
                          return (
                            <group.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.NumberField
                                  label={node.label}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </group.AppField>
                          )
                        case 'RICH_TEXT':
                          return (
                            <div className={wideField} key={node.id}>
                              <group.AppField name={fieldName} validators={validators}>
                                {(appField) => (
                                  <appField.RichTextField
                                    label={node.label}
                                    required={node.required}
                                    readOnly={nodeReadOnly}
                                  />
                                )}
                              </group.AppField>
                            </div>
                          )
                        case 'SELECT_SINGLE':
                          return (
                            <group.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.SelectField
                                  label={node.label}
                                  data={node.options ?? []}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </group.AppField>
                          )
                        case 'SELECT_MULTI':
                          return (
                            <group.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.MultiSelectField
                                  label={node.label}
                                  data={node.options ?? []}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </group.AppField>
                          )
                        default:
                          return (
                            <Alert key={node.id} color='yellow'>
                              <Text>{`Unsupported field: ${node.label}`}</Text>
                            </Alert>
                        )
                      }
                    })}
                  </div>
                )

                return inlineObject
                  ? (
                      <div key={section.id} className={inlineObjectSection}>
                        {sectionContent}
                      </div>
                    )
                  : (
                      <section
                        key={section.id}
                        className={styles.section}
                        aria-labelledby={showSectionHeader ? `authoring-section-${section.id}` : undefined}
                      >
                        {showSectionHeader
                          ? (
                              <div className={styles.sectionHeader}>
                                <h2 id={`authoring-section-${section.id}`} className={styles.sectionTitle}>{section.label}</h2>
                              </div>
                            )
                          : null}
                        {sectionContent}
                      </section>
                    )
              })}
          </div>
          {!editorController && activeEditor?.node.childMapId
            ? (
                <AuthoringFocusedWorkspace
                  breadcrumbs={activeEditor.breadcrumbs}
                  opened
                  readOnly={activeEditor.readOnly}
                  removeAction={activeEditor.onRemove
                    ? {
                        label: `Remove ${activeEditor.itemTitle ?? singularizeLabel(activeEditor.node.label)}`,
                        onClick: activeEditor.onRemove
                      }
                    : undefined}
                  onBack={closeEditor}
                  onClose={closeAllEditors}
                >
                  <GroupRenderer
                    key={activeEditor.path.join('.')}
                    activeStepId={activeEditor.activeStepId}
                    form={group}
                    fields={toTypedAuthoringGroupFieldName<AuthoringGroupValues, AuthoringGroupValues>(undefined, activeEditor.path)}
                    ancestors={childAncestors}
                    editorBreadcrumbs={activeEditor.breadcrumbs}
                    effectEditor={Boolean(activeEditor.effectEditor || isEffectEditor || EFFECT_EDITOR_MAP_IDS.has(activeEditor.node.childMapId))}
                    mapId={activeEditor.node.childMapId}
                    parentValues={values}
                    readOnly={activeEditor.readOnly}
                    onActiveStepChange={updateActiveEditorStepId}
                    renderStepNavInHeader
                    resolveModel={resolveModel}
                    systemId={systemId}
                  />
                </AuthoringFocusedWorkspace>
              )
            : null}
        </div>
      )
    }
  })

  return withForm({
    defaultValues,
    props: {} as SharedRendererProps,
    render: function AuthoringFormRenderer({
      debounceMs = 150,
      fieldPathPrefix,
      form,
      mapId,
      readOnly,
      registerSession = true,
      resolveModel,
      systemId
    }) {
      const authoring = useAuthoringForm()
      const resolvedFieldPathPrefix = fieldPathPrefix ?? authoring.fieldPathPrefix
      const resolvedMapId = mapId ?? authoring.mapId
      const resolvedReadOnly = readOnly ?? authoring.readOnly
      const resolvedResolveModel = resolveModel ?? authoring.resolveModel
      const resolvedSystemId = systemId ?? authoring.systemId
      const values = useStore(form.store, (state) => {
        if (!resolvedFieldPathPrefix) return toResolvedNodeValues(state.values)

        return toEditorValues(getAuthoringFieldValue(toResolvedNodeValues(state.values), resolvedFieldPathPrefix))
      })
      const submitState = useStore(form.store, (state) => ({
        canSubmit: state.canSubmit,
        hasChanges: state.isDirty,
        isSubmitting: state.isSubmitting
      }))
      const { model: activeModel } = useAuthoringResolvedModel({
        debounceMs,
        mapId: resolvedMapId ?? 'pending',
        model: mapId ? undefined : authoring.providedModel,
        resolveModel: Boolean(resolvedMapId) && resolvedResolveModel && !(mapId ? false : authoring.providedModel),
        systemId: resolvedSystemId,
        values
      })
      const visibleSteps = getVisibleAuthoringSteps(activeModel)
      const isEffectEditor = resolvedMapId != null && EFFECT_EDITOR_MAP_IDS.has(resolvedMapId)
      const [internalStepId, setInternalStepId] = useState<string | undefined>()
      const [editorStack, setEditorStack] = useState<ActiveGroupNode[]>([])
      const [expandedInlineRows, setExpandedInlineRows] = useState<ReadonlySet<string>>(() => new Set())
      const activeEditor = editorStack.at(-1) ?? null
      const openEditor = useCallback((editor: ActiveGroupNode) => {
        setEditorStack((current) => [...current, editor])
      }, [])
      const closeEditor = useCallback(() => {
        setEditorStack((current) => current.slice(0, -1))
      }, [])
      const closeAllEditors = useCallback(() => {
        setEditorStack([])
      }, [])
      const updateActiveEditorStepId = useCallback((stepId: string | undefined) => {
        setEditorStack((current) => {
          const activeIndex = current.length - 1
          if (activeIndex < 0 || current[activeIndex]?.activeStepId === stepId) return current

          return current.map((editor, index) => (
            index === activeIndex ? { ...editor, activeStepId: stepId } : editor
          ))
        })
      }, [])
      const editorController = useMemo<AuthoringEditorController>(() => ({
        closeAllEditors,
        closeEditor,
        openEditor
      }), [closeAllEditors, closeEditor, openEditor])
      const currentStep = visibleSteps.find((step) => step.id === internalStepId) ?? visibleSteps[0]
      const currentStepLabel = currentStep?.label
      const currentIndex = currentStep ? visibleSteps.findIndex((step) => step.id === currentStep.id) : 0
      const isLastStep = currentIndex === visibleSteps.length - 1
      const currentStepHasChanges = useStore(form.store, (state) => (
        hasVisibleStepChanges(form, currentStep?.sections ?? [], resolvedFieldPathPrefix, state.fieldMeta)
      ))
      const rootBreadcrumbs = useMemo(() => buildRootBreadcrumbs(
        authoring.subjectKindLabel,
        authoring.subjectLabel
      ), [authoring.subjectKindLabel, authoring.subjectLabel])
      const resetCurrentStep = useCallback(() => {
        resetVisibleStepFields(form, currentStep?.sections ?? [], resolvedFieldPathPrefix)
      }, [
        currentStep,
        form,
        resolvedFieldPathPrefix
      ])
      const registration = useMemo(() => ({
        activeStepId: currentStep?.id,
        activeStepLabel: currentStep?.label,
        canGoBack: currentIndex > 0,
        canGoNext: currentStep != null && !isLastStep,
        canResetStep: currentStep != null && !resolvedReadOnly,
        canSubmit: submitState.canSubmit,
        fieldPathPrefix: resolvedFieldPathPrefix,
        hasChanges: submitState.hasChanges,
        hasStepChanges: currentStepHasChanges,
        isLastStep,
        isSubmitting: submitState.isSubmitting,
        readOnly: resolvedReadOnly,
        resolvedModel: activeModel,
        resetStepLabel: 'Reset Step',
        systemId: resolvedSystemId
      }), [
        activeModel,
        currentIndex,
        currentStep,
        isLastStep,
        resolvedFieldPathPrefix,
        resolvedReadOnly,
        resolvedSystemId,
        currentStepHasChanges,
        submitState.canSubmit,
        submitState.hasChanges,
        submitState.isSubmitting
      ])
      const actions = useMemo(() => ({
        ...(resolvedFieldPathPrefix
          ? {
              onClearPaths: (paths: readonly NodeRuntimePathDto[]) => {
                authoring.clearPaths(prefixRuntimePaths(resolvedFieldPathPrefix, paths))
              }
            }
          : {}),
        onNextStep: () => setInternalStepId(visibleSteps[Math.min(currentIndex + 1, visibleSteps.length - 1)]?.id),
        onPreviousStep: () => setInternalStepId(visibleSteps[Math.max(currentIndex - 1, 0)]?.id),
        onResetStep: resetCurrentStep,
        onStepChange: setInternalStepId
      }), [
        authoring,
        currentIndex,
        resolvedFieldPathPrefix,
        resetCurrentStep,
        visibleSteps
      ])

      useAuthoringFormRegistration(registration, actions, registerSession)

      if (!resolvedMapId || !activeModel || !currentStep) return null

      return (
        <div className={formShell}>
          <div className={sectionStack}>
            {currentStep.sections
              .filter((section) => section.nodes.some((node) => node.visible && !isSystemManagedFieldNode(node)))
              .map((section) => {
                const showSectionHeader = !shouldHideSectionHeader(section, currentStep.sections)

                return (
                  <section
                    key={section.id}
                    className={styles.section}
                    aria-labelledby={showSectionHeader ? `authoring-section-${section.id}` : undefined}
                  >
                    {showSectionHeader
                      ? (
                          <div className={styles.sectionHeader}>
                            <h2 id={`authoring-section-${section.id}`} className={styles.sectionTitle}>{section.label}</h2>
                          </div>
                        )
                      : null}
                    <div className={fieldGrid}>
                    {section.nodes.map((node) => {
                      if (!node.visible) return null
                      if (isSystemManagedFieldNode(node)) return null

                      const fieldName = toTypedAuthoringFieldName<TValues>(resolvedFieldPathPrefix, node.path)
                      const nodeReadOnly = Boolean(resolvedReadOnly || node.readOnly || node.disabled)

                      if (node.kind === 'GROUP') {
                        if (node.groupKind === 'ARRAY') {
                          const arrayFieldName = toTypedAuthoringArrayFieldName<TValues>(resolvedFieldPathPrefix, node.path)

                          return (
                            <form.AppField key={node.id} name={arrayFieldName} mode='array'>
                              {(field) => {
                                const items = toRuntimeArray(field.state.value)
                                const collapseRows = shouldCollapseInlineArrayGroup(node, isEffectEditor)

                                if (shouldRenderInlineArrayGroup(node, isEffectEditor)) {
                                  return (
                                    <div className={wideField}>
                                      <Group justify='space-between' mb='xs'>
                                        <Text className={styles.sectionTitle}>{node.label}</Text>
                                        {!nodeReadOnly
                                          ? (
                                              <Button
                                                type='button'
                                                variant='default'
                                                onClick={() => {
                                                  const nextItem = createDefaultAuthoringArrayItem(node, items.length)
                                                  const rowKey = getInlineArrayItemKey(node, nextItem, items.length)
                                                  field.pushValue(nextItem as Parameters<typeof field.pushValue>[0])
                                                  if (collapseRows) {
                                                    setExpandedInlineRows((current) => addSetValue(current, rowKey))
                                                  }
                                                }}
                                              >
                                                {`Add ${singularizeLabel(node.label)}`}
                                              </Button>
                                            )
                                          : null}
                                      </Group>
                                      <div className={getInlineArrayListClassName(node)}>
                                        {items.map((item, index) => {
                                          const title = isSpeedArrayNode(node) ? singularizeLabel(node.label) : getArrayItemTitle(node, item, index)
                                          const description = getArrayItemDescription(node, item)
                                          const rowKey = getInlineArrayItemKey(node, item, index)
                                          const opened = expandedInlineRows.has(rowKey)
                                          const childIsEffectEditor = isEffectEditor || EFFECT_EDITOR_MAP_IDS.has(node.childMapId ?? '')
                                          const content = (
                                            <GroupRenderer
                                              form={form}
                                              fields={toTypedAuthoringGroupFieldName<TValues, AuthoringGroupValues>(resolvedFieldPathPrefix, [...node.path, index])}
                                              ancestors={EMPTY_ANCESTORS}
                                              editorController={editorController}
                                              editorBreadcrumbs={buildEditorBreadcrumbs(rootBreadcrumbs, currentStepLabel, node.label, title)}
                                              effectEditor={childIsEffectEditor}
                                              inlineObject
                                              mapId={node.childMapId!}
                                              parentValues={values}
                                              pathPrefix={[...node.path, index]}
                                              readOnly={nodeReadOnly}
                                              resolveModel={resolvedResolveModel}
                                              systemId={resolvedSystemId}
                                            />
                                          )

                                          if (!collapseRows) {
                                            if (isCompactInlineArrayRowsNode(node)) {
                                              return (
                                                <div className={clsx(getInlineArrayItemClassName(node), compactInlineArrayItem)} key={rowKey}>
                                                  <div className={compactInlineArrayItemContent}>{content}</div>
                                                  {!nodeReadOnly
                                                    ? (
                                                        <Tooltip label='Remove' withArrow>
                                                          <ActionIcon
                                                            aria-label={`Remove ${title}`}
                                                            color='red'
                                                            type='button'
                                                            variant='subtle'
                                                            onClick={() => field.removeValue(index)}
                                                          >
                                                            <ITrash size={16} />
                                                          </ActionIcon>
                                                        </Tooltip>
                                                      )
                                                    : null}
                                                </div>
                                              )
                                            }

                                            return (
                                              <div className={getInlineArrayItemClassName(node)} key={rowKey}>
                                                <div className={inlineArrayItemHeader}>
                                                  <Text className={inlineArrayItemTitle}>{title}</Text>
                                                  {description
                                                    ? <Text className={inlineArrayItemDescription}>{description}</Text>
                                                    : null}
                                                  {!nodeReadOnly
                                                    ? (
                                                        <Tooltip label='Remove' withArrow>
                                                          <ActionIcon
                                                            aria-label={`Remove ${title}`}
                                                            color='red'
                                                            type='button'
                                                            variant='subtle'
                                                            onClick={() => field.removeValue(index)}
                                                          >
                                                            <ITrash size={16} />
                                                          </ActionIcon>
                                                        </Tooltip>
                                                      )
                                                    : null}
                                                </div>
                                                {content}
                                              </div>
                                            )
                                          }

                                          return (
                                            <div className={getInlineArrayItemClassName(node)} key={rowKey}>
                                              <div className={inlineArrayItemHeader}>
                                                <button
                                                  aria-expanded={opened}
                                                  className={inlineArrayItemTrigger}
                                                  type='button'
                                                  onClick={() => setExpandedInlineRows((current) => toggleSetValue(current, rowKey))}
                                                >
                                                  <ChevronDown
                                                    aria-hidden='true'
                                                    className={clsx(inlineArrayItemChevron, opened && inlineArrayItemChevronOpen)}
                                                    size={16}
                                                  />
                                                  <span>
                                                    <Text className={inlineArrayItemTitle} component='span'>{title}</Text>
                                                    {description
                                                      ? <Text className={inlineArrayItemDescription} component='span'>{description}</Text>
                                                      : null}
                                                  </span>
                                                </button>
                                                <div className={inlineArrayItemActions}>
                                                  {!nodeReadOnly
                                                    ? (
                                                        <Tooltip label='Remove' withArrow>
                                                          <ActionIcon
                                                            aria-label={`Remove ${title}`}
                                                            color='red'
                                                            type='button'
                                                            variant='subtle'
                                                            onClick={() => field.removeValue(index)}
                                                          >
                                                            <ITrash size={16} />
                                                          </ActionIcon>
                                                        </Tooltip>
                                                      )
                                                    : null}
                                                </div>
                                              </div>
                                              <Collapse expanded={opened}>
                                                <div className={getInlineArrayItemBodyClassName(node)}>{content}</div>
                                              </Collapse>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                }

                                return (
                                  <div className={wideField}>
                                    <Group justify='space-between' mb='xs'>
                                      <Text className={styles.sectionTitle}>{node.label}</Text>
                                      {!nodeReadOnly
                                        ? (
                                            <Button
                                              type='button'
                                              variant='default'
                                              onClick={() => {
                                                const nextIndex = items.length
                                                const nextItem = createDefaultAuthoringArrayItem(node, nextIndex)
                                                field.pushValue(nextItem as Parameters<typeof field.pushValue>[0])
                                                openEditor(createArrayEditorState({
                                                  currentStepLabel,
                                                  effectEditor: isEffectEditor,
                                                  item: nextItem,
                                                  index: nextIndex,
                                                  node,
                                                  onRemove: () => {
                                                    field.removeValue(nextIndex)
                                                    closeEditor()
                                                  },
                                                  parentBreadcrumbs: rootBreadcrumbs,
                                                  path: [...node.path, nextIndex],
                                                  readOnly: nodeReadOnly
                                                }))
                                              }}
                                            >
                                              {`Add ${singularizeLabel(node.label)}`}
                                            </Button>
                                          )
                                        : null}
                                    </Group>
                                    {items.length === 0 && !isDetailArrayNode(node)
                                      ? <Text className={styles.mutedText} size='sm'>{`No ${node.label.toLowerCase()} yet.`}</Text>
                                      : items.map((item, index) => (
                                        <AuthoringFormSectionRow
                                          key={`${node.id}-${index}`}
                                          description={getArrayItemDescription(node, item)}
                                          readOnly={nodeReadOnly}
                                          title={getArrayItemTitle(node, item, index)}
                                          onOpen={node.childMapId
                                            ? () => openEditor(createArrayEditorState({
                                                currentStepLabel,
                                                effectEditor: isEffectEditor,
                                                item,
                                                index,
                                                node,
                                                onRemove: () => {
                                                  field.removeValue(index)
                                                  closeEditor()
                                                },
                                                parentBreadcrumbs: rootBreadcrumbs,
                                                path: [...node.path, index],
                                                readOnly: nodeReadOnly
                                              }))
                                            : undefined}
                                          onRemove={() => field.removeValue(index)}
                                        />
                                      ))}
                                  </div>
                                )
                              }}
                            </form.AppField>
                          )
                        }

                        if (shouldRenderInlineObjectGroup(node, isEffectEditor)) {
                          return (
                            <form.AppField key={node.id} name={fieldName}>
                              {(field) => {
                                const hasValue = isRuntimeRecord(field.state.value)
                                const objectKey = getInlineObjectItemKey([], node)
                                const objectConfigured = hasConfiguredObjectGroupValue(node, field.state.value)
                                const objectOpened = expandedInlineRows.has(objectKey)
                                const shouldShowObject = hasValue && (
                                  node.required
                                  || objectConfigured
                                  || objectOpened
                                  || shouldRenderDirectInlineObjectNode(node, isEffectEditor)
                                )
                                const objectDescription = getObjectGroupDescription(node, field.state.value)

                                return (
                                  <div className={wideField}>
                                    {shouldShowObject
                                      ? (
                                          isFeatureGrantsObjectNode(node) || shouldRenderDirectInlineObjectNode(node, isEffectEditor)
                                            ? (
                                                <GroupRenderer
                                                  form={form}
                                                  fields={toTypedAuthoringGroupFieldName<TValues, AuthoringGroupValues>(resolvedFieldPathPrefix, node.path)}
                                                  ancestors={EMPTY_ANCESTORS}
                                                  editorController={editorController}
                                                  editorBreadcrumbs={buildEditorBreadcrumbs(rootBreadcrumbs, currentStepLabel, node.label)}
                                                  effectEditor={isEffectEditor}
                                                  inlineObject
                                                  mapId={node.childMapId!}
                                                  parentValues={values}
                                                  pathPrefix={node.path}
                                                  readOnly={nodeReadOnly}
                                                  resolveModel={resolvedResolveModel}
                                                  systemId={resolvedSystemId}
                                                />
                                              )
                                            : node.required
                                              ? (
                                                  <GroupRenderer
                                                    form={form}
                                                    fields={toTypedAuthoringGroupFieldName<TValues, AuthoringGroupValues>(resolvedFieldPathPrefix, node.path)}
                                                    ancestors={EMPTY_ANCESTORS}
                                                    editorController={editorController}
                                                    editorBreadcrumbs={buildEditorBreadcrumbs(rootBreadcrumbs, currentStepLabel, node.label)}
                                                    effectEditor={isEffectEditor}
                                                    inlineObject
                                                    mapId={node.childMapId!}
                                                    parentValues={values}
                                                    pathPrefix={node.path}
                                                    readOnly={nodeReadOnly}
                                                    resolveModel={resolvedResolveModel}
                                                    systemId={resolvedSystemId}
                                                  />
                                                )
                                              : (
                                                  <div className={inlineArrayItem}>
                                                    <div className={inlineArrayItemHeader}>
                                                      <button
                                                        aria-expanded={objectOpened}
                                                        className={inlineArrayItemTrigger}
                                                        type='button'
                                                        onClick={() => setExpandedInlineRows((current) => toggleSetValue(current, objectKey))}
                                                      >
                                                        <ChevronDown
                                                          aria-hidden='true'
                                                          className={clsx(inlineArrayItemChevron, objectOpened && inlineArrayItemChevronOpen)}
                                                          size={16}
                                                        />
                                                        <span>
                                                          <Text className={inlineArrayItemTitle} component='span'>{node.label}</Text>
                                                          {objectDescription
                                                            ? <Text className={inlineArrayItemDescription} component='span'>{objectDescription}</Text>
                                                            : null}
                                                        </span>
                                                      </button>
                                                      {!nodeReadOnly
                                                        ? (
                                                            <Tooltip label={`Remove ${node.label}`} withArrow>
                                                              <ActionIcon
                                                                aria-label={`Remove ${node.label}`}
                                                                color='red'
                                                                type='button'
                                                                variant='subtle'
                                                                onClick={() => field.handleChange((_current) => undefined as typeof _current)}
                                                              >
                                                                <ITrash size={16} />
                                                              </ActionIcon>
                                                            </Tooltip>
                                                          )
                                                        : null}
                                                    </div>
                                                    <Collapse expanded={objectOpened}>
                                                      <div className={inlineArrayItemBody}>
                                                        <GroupRenderer
                                                          form={form}
                                                          fields={toTypedAuthoringGroupFieldName<TValues, AuthoringGroupValues>(resolvedFieldPathPrefix, node.path)}
                                                          ancestors={EMPTY_ANCESTORS}
                                                          editorController={editorController}
                                                          editorBreadcrumbs={buildEditorBreadcrumbs(rootBreadcrumbs, currentStepLabel, node.label)}
                                                          effectEditor={isEffectEditor}
                                                          inlineObject
                                                          mapId={node.childMapId!}
                                                          parentValues={values}
                                                          pathPrefix={node.path}
                                                          readOnly={nodeReadOnly}
                                                          resolveModel={resolvedResolveModel}
                                                          systemId={resolvedSystemId}
                                                        />
                                                      </div>
                                                    </Collapse>
                                                  </div>
                                                )
                                        )
                                      : (
                                          <Group justify='end' align='center'>
                                            {!nodeReadOnly
                                              ? isFeatureGrantsObjectNode(node)
                                                ? (
                                                    <Menu position='bottom-start' withinPortal>
                                                      <Menu.Target>
                                                        <Button type='button' variant='default'>Add Grant</Button>
                                                      </Menu.Target>
                                                      <Menu.Dropdown>
                                                        {FEATURE_GRANT_CONFIGS.map((config) => (
                                                          <Menu.Item
                                                            key={config.pathKey}
                                                            onClick={() => field.handleChange(createFeatureGrantsWithGrant(config) as typeof field.state.value)}
                                                          >
                                                            {`Add ${config.label}`}
                                                          </Menu.Item>
                                                        ))}
                                                      </Menu.Dropdown>
                                                    </Menu>
                                                  )
                                                : (
                                                  <Button
                                                    type='button'
                                                    variant='default'
                                                    onClick={() => {
                                                      field.handleChange(createDefaultAuthoringObjectItem(node) as typeof field.state.value)
                                                      setExpandedInlineRows((current) => addSetValue(current, objectKey))
                                                    }}
                                                  >
                                                    {`Add ${node.label}`}
                                                  </Button>
                                                )
                                              : null}
                                          </Group>
                                        )}
                                  </div>
                                )
                              }}
                            </form.AppField>
                          )
                        }

                        return (
                          <form.AppField key={node.id} name={fieldName}>
                            {(field) => (
                              <div className={wideField}>
                                <AuthoringFormSectionRow
                                  readOnly={nodeReadOnly}
                                  title={node.label}
                                  onOpen={node.childMapId
                                    ? () => {
                                        if (field.state.value === undefined || field.state.value === null) {
                                          field.handleChange((current) => (current ?? createDefaultAuthoringObjectItem(node)) as typeof current)
                                        }
                                        openEditor({
                                          breadcrumbs: buildEditorBreadcrumbs(rootBreadcrumbs, currentStepLabel, node.label),
                                          effectEditor: isEffectEditor,
                                          node,
                                          path: node.path,
                                          readOnly: nodeReadOnly
                                        })
                                      }
                                    : undefined}
                                  onRemove={!nodeReadOnly && !node.required
                                    ? () => field.handleChange((_current) => undefined as typeof _current)
                                    : undefined}
                                />
                              </div>
                            )}
                          </form.AppField>
                        )
                      }

                      const inputType = getEffectiveInputType(node)
                      const validators = node.required ? getRequiredValidators(inputType, node.label) : undefined

                      switch (inputType) {
                        case 'TEXT':
                          return (
                            <form.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.TextField
                                  label={node.label}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </form.AppField>
                          )
                        case 'NUMBER':
                          return (
                            <form.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.NumberField
                                  label={node.label}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </form.AppField>
                          )
                        case 'RICH_TEXT':
                          return (
                            <div className={wideField} key={node.id}>
                              <form.AppField name={fieldName} validators={validators}>
                                {(appField) => (
                                  <appField.RichTextField
                                    label={node.label}
                                    required={node.required}
                                    readOnly={nodeReadOnly}
                                  />
                                )}
                              </form.AppField>
                            </div>
                          )
                        case 'SELECT_SINGLE':
                          return (
                            <form.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.SelectField
                                  label={node.label}
                                  data={node.options ?? []}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </form.AppField>
                          )
                        case 'SELECT_MULTI':
                          return (
                            <form.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.MultiSelectField
                                  label={node.label}
                                  data={node.options ?? []}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </form.AppField>
                          )
                        default:
                          return (
                            <Alert key={node.id} color='yellow'>
                              <Text>{`Unsupported field: ${node.label}`}</Text>
                            </Alert>
                          )
                      }
                    })}
                    </div>
                  </section>
                )
              })}
          </div>
          {activeEditor?.node.childMapId
            ? (
                <AuthoringFocusedWorkspace
                  breadcrumbs={activeEditor.breadcrumbs}
                  opened
                  readOnly={activeEditor.readOnly}
                  removeAction={activeEditor.onRemove
                    ? {
                        label: `Remove ${activeEditor.itemTitle ?? singularizeLabel(activeEditor.node.label)}`,
                        onClick: activeEditor.onRemove
                      }
                    : undefined}
                  onBack={closeEditor}
                  onClose={closeAllEditors}
                >
                  <GroupRenderer
                    key={activeEditor.path.join('.')}
                    activeStepId={activeEditor.activeStepId}
                    form={form}
                    fields={toTypedAuthoringGroupFieldName<TValues, AuthoringGroupValues>(resolvedFieldPathPrefix, activeEditor.path)}
                    ancestors={EMPTY_ANCESTORS}
                    editorController={editorController}
                    editorBreadcrumbs={activeEditor.breadcrumbs}
                    effectEditor={Boolean(activeEditor.effectEditor || isEffectEditor || EFFECT_EDITOR_MAP_IDS.has(activeEditor.node.childMapId))}
                    mapId={activeEditor.node.childMapId}
                    parentValues={values}
                    pathPrefix={activeEditor.path}
                    readOnly={activeEditor.readOnly}
                    onActiveStepChange={updateActiveEditorStepId}
                    renderStepNavInHeader
                    resolveModel={resolvedResolveModel}
                    systemId={resolvedSystemId}
                  />
                </AuthoringFocusedWorkspace>
              )
            : null}
        </div>
      )
    }
  })
}

function getRequiredValidators(type: NodeRuntimeNodeDto['type'], label: string) {
  if (type === 'SELECT_MULTI') return validatorsFor(requiredArray(label))
  if (type === 'SELECT_SINGLE') return validatorsFor(requiredSelect(label))
  if (type === 'NUMBER') return validatorsFor(requiredNumber(label))
  return validatorsFor(requiredString(label))
}

type ResettableFieldApi<TValues extends object> = {
  form?: unknown
  getFormFieldName?: <TField extends DeepKeys<TValues>>(field: TField) => string
  state?: unknown
  resetField: <TField extends DeepKeys<TValues>>(field: TField) => void
}

type RootResettableFieldApi = {
  state: {
    fieldMeta?: Partial<Record<string, unknown>>
  }
  resetField: (field: string) => void
}

function resetVisibleStepFields<TValues extends object>(
  form: ResettableFieldApi<TValues>,
  sections: readonly NodeRuntimeSectionDto[],
  fieldPathPrefix?: string
) {
  const rootForm = getRootResettableFieldApi(form)
  const registeredFieldNames = Object.keys(rootForm?.state.fieldMeta ?? {})

  for (const section of sections) {
    for (const node of section.nodes) {
      if (!node.visible) continue
      if (isSystemManagedFieldNode(node)) continue
      if (node.readOnly || node.disabled) continue

      const fieldName = toTypedAuthoringFieldName<TValues>(fieldPathPrefix, node.path)
      const resolvedFieldName = getResolvedFormFieldName(form, fieldName)
      form.resetField(fieldName)

      for (const registeredFieldName of registeredFieldNames) {
        if (isDescendantFieldName(registeredFieldName, resolvedFieldName)) {
          rootForm?.resetField(registeredFieldName)
        }
      }
    }
  }
}

function hasVisibleStepChanges<TValues extends object>(
  form: ResettableFieldApi<TValues>,
  sections: readonly NodeRuntimeSectionDto[],
  fieldPathPrefix: string | undefined,
  fieldMeta: Partial<Record<string, unknown>> | undefined
) {
  for (const section of sections) {
    for (const node of section.nodes) {
      if (!node.visible) continue
      if (isSystemManagedFieldNode(node)) continue
      if (node.readOnly || node.disabled) continue

      const fieldName = toTypedAuthoringFieldName<TValues>(fieldPathPrefix, node.path)
      const resolvedFieldName = getResolvedFormFieldName(form, fieldName)

      if (hasDirtyFieldForPath(fieldMeta, resolvedFieldName)) {
        return true
      }
    }
  }

  return false
}

function hasDirtyFieldForPath(
  fieldMeta: Partial<Record<string, unknown>> | undefined,
  fieldName: string
) {
  return Object.entries(fieldMeta ?? {}).some(([registeredFieldName, meta]) => (
    (registeredFieldName === fieldName || isDescendantFieldName(registeredFieldName, fieldName))
    && isDirtyFieldMeta(meta)
  ))
}

function isDirtyFieldMeta(value: unknown): value is { isDirty: true } {
  return typeof value === 'object'
    && value !== null
    && 'isDirty' in value
    && value.isDirty === true
}

function getRootResettableFieldApi<TValues extends object>(
  form: ResettableFieldApi<TValues>
): RootResettableFieldApi | undefined {
  if (isRootResettableFieldApi(form.form)) return form.form
  if (isRootResettableFieldApi(form)) return form
  return undefined
}

function isRootResettableFieldApi(value: unknown): value is RootResettableFieldApi {
  return typeof value === 'object'
    && value !== null
    && 'state' in value
    && 'resetField' in value
    && typeof value.resetField === 'function'
}

function getResolvedFormFieldName<TValues extends object>(
  form: ResettableFieldApi<TValues>,
  fieldName: DeepKeys<TValues>
): string {
  return form.getFormFieldName ? form.getFormFieldName(fieldName) : String(fieldName)
}

function isDescendantFieldName(fieldName: string, parentFieldName: string) {
  return fieldName.startsWith(`${parentFieldName}.`)
    || fieldName.startsWith(`${parentFieldName}[`)
}

function getEffectiveInputType(node: NodeRuntimeNodeDto): NodeRuntimeNodeDto['type'] {
  if (isProseFieldNode(node)) return 'RICH_TEXT'
  return node.type
}

function isProseFieldNode(node: NodeRuntimeNodeDto): boolean {
  if (node.kind !== 'INPUT') return false

  const lastPathSegment = node.path[node.path.length - 1]
  const pathKey = typeof lastPathSegment === 'string' ? lastPathSegment.toLowerCase() : ''
  const labelKey = node.label.trim().toLowerCase()

  return PROSE_FIELD_KEYS.has(pathKey)
    || pathKey.endsWith('description')
    || pathKey.endsWith('detail')
    || pathKey.endsWith('quote')
    || PROSE_FIELD_KEYS.has(labelKey)
}

function toEditorValues(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function toRuntimeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function shouldRenderInlineObjectGroup(node: NodeRuntimeNodeDto, effectEditor: boolean) {
  return node.groupKind === 'OBJECT'
    && Boolean(node.childMapId)
    && (INLINE_OBJECT_GROUP_CHILD_MAP_IDS.has(node.childMapId ?? '')
      || effectEditor)
}

function shouldRenderInlineArrayGroup(node: NodeRuntimeNodeDto, effectEditor: boolean) {
  const childMapId = node.childMapId ?? ''

  return node.groupKind === 'ARRAY'
    && Boolean(childMapId)
    && (INLINE_ARRAY_GROUP_CHILD_MAP_IDS.has(childMapId)
      || (effectEditor && !EFFECT_EDITOR_MODAL_ARRAY_CHILD_MAP_IDS.has(childMapId)))
}

function shouldCollapseInlineArrayGroup(node: NodeRuntimeNodeDto, effectEditor: boolean) {
  const childMapId = node.childMapId ?? ''

  if (STARTING_EQUIPMENT_ARRAY_CHILD_MAP_IDS.has(childMapId)) {
    return childMapId === 'startingEquipmentSet'
  }

  if (isCompactInlineArrayRowsNode(node)) {
    return false
  }

  return node.groupKind === 'ARRAY'
    && Boolean(childMapId)
    && (effectEditor || COLLAPSIBLE_INLINE_ARRAY_CHILD_MAP_IDS.has(childMapId))
}

function isCompactInlineArrayRowsNode(node: NodeRuntimeNodeDto) {
  return node.childMapId === 'damageLevelScalingEntry'
}

function getInlineArrayListClassName(node: NodeRuntimeNodeDto) {
  return clsx(
    inlineArrayList,
    node.childMapId === 'damageLevelScalingEntry' && damageScalingArrayList,
    isStartingEquipmentArrayNode(node) && startingEquipmentArrayList
  )
}

function getInlineArrayItemClassName(node: NodeRuntimeNodeDto) {
  const childMapId = node.childMapId ?? ''

  return clsx(
    inlineArrayItem,
    childMapId === 'damageLevelScalingEntry' && damageScalingItem,
    childMapId === 'startingEquipmentSet' && startingEquipmentSetItem,
    childMapId === 'startingEquipmentGroup' && startingEquipmentGroupItem,
    childMapId === 'startingEquipmentOption' && startingEquipmentOptionItem,
    (childMapId === 'startingEquipmentItem' || childMapId === 'startingEquipmentCurrency') && startingEquipmentItemRow
  )
}

function getInlineArrayItemBodyClassName(node: NodeRuntimeNodeDto) {
  return clsx(
    inlineArrayItemBody,
    node.childMapId === 'startingEquipmentSet' && startingEquipmentSetBody
  )
}

function isStartingEquipmentArrayNode(node: NodeRuntimeNodeDto) {
  return STARTING_EQUIPMENT_ARRAY_CHILD_MAP_IDS.has(node.childMapId ?? '')
}

function getArrayItemTitle(node: NodeRuntimeNodeDto, item: unknown, index: number) {
  return readArrayItemLabel(node, item) ?? `${singularizeLabel(node.label)} ${index + 1}`
}

function getArrayItemDescription(node: NodeRuntimeNodeDto, item: unknown): string | undefined {
  if (!isRuntimeRecord(item)) return undefined
  if (node.childMapId === 'effect' && isEffectLike(item)) return formatEffectDescription(item)
  return undefined
}

function getInlineArrayItemKey(node: NodeRuntimeNodeDto, item: unknown, index: number) {
  if (isRuntimeRecord(item) && typeof item.id === 'string' && item.id.trim()) {
    return `${node.id}-${item.id}`
  }

  return `${node.id}-${index}`
}

function getInlineObjectItemKey(pathPrefix: readonly (string | number)[], node: NodeRuntimeNodeDto) {
  return `object-${[...pathPrefix, ...node.path].join('.')}`
}

function addSetValue(values: ReadonlySet<string>, value: string): ReadonlySet<string> {
  if (values.has(value)) return values
  const next = new Set(values)
  next.add(value)
  return next
}

function toggleSetValue(values: ReadonlySet<string>, value: string): ReadonlySet<string> {
  const next = new Set(values)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  return next
}

function createArrayEditorState({
  currentStepLabel,
  effectEditor,
  item,
  index,
  node,
  onRemove,
  parentBreadcrumbs,
  path,
  readOnly
}: {
  currentStepLabel: string | undefined
  effectEditor: boolean
  item: unknown
  index: number
  node: NodeRuntimeNodeDto
  onRemove: () => void
  parentBreadcrumbs: readonly string[]
  path: readonly (string | number)[]
  readOnly: boolean
}): ActiveGroupNode {
  const itemTitle = getArrayItemTitle(node, item, index)

  return {
    breadcrumbs: buildEditorBreadcrumbs(parentBreadcrumbs, currentStepLabel, node.label, itemTitle),
    effectEditor,
    itemTitle,
    node,
    onRemove: isDetailArrayNode(node) ? onRemove : undefined,
    path,
    readOnly
  }
}

function buildEditorBreadcrumbs(
  base: readonly string[],
  ...entries: Array<string | undefined>
): string[] {
  return [...base, ...entries]
    .map((entry) => entry?.trim())
    .filter((entry): entry is string => Boolean(entry))
    .reduce<string[]>((crumbs, entry) => {
      if (crumbs[crumbs.length - 1] === entry) return crumbs
      return [...crumbs, entry]
    }, [])
}

function buildRootBreadcrumbs(subjectKindLabel: string, subjectLabel: ReactNode): string[] {
  return [
    pluralizeLabel(subjectKindLabel),
    readReactNodeText(subjectLabel)
  ].filter((entry): entry is string => Boolean(entry))
}

function readReactNodeText(value: ReactNode): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

function singularizeLabel(label: string) {
  const trimmed = label.trim()
  if (trimmed.endsWith('ies')) return `${trimmed.slice(0, -3)}y`
  if (trimmed.endsWith('ses')) return trimmed.slice(0, -2)
  if (trimmed.endsWith('s') && !trimmed.endsWith('ss')) return trimmed.slice(0, -1)
  return trimmed
}

function pluralizeLabel(label: string) {
  const trimmed = label.trim()
  if (!trimmed) return ''
  if (trimmed === 'Equipment') return trimmed
  if (trimmed.endsWith('s')) return trimmed
  if (trimmed.endsWith('y')) return `${trimmed.slice(0, -1)}ies`
  return `${trimmed}s`
}

function isDetailArrayNode(node: NodeRuntimeNodeDto) {
  return Boolean(node.childMapId && DETAIL_CHILD_MAP_IDS.has(node.childMapId))
}

function isSpeedArrayNode(node: NodeRuntimeNodeDto) {
  return node.childMapId === 'speed'
}

function isFeatureGrantsObjectNode(node: NodeRuntimeNodeDto) {
  return node.childMapId === 'featureGrants'
}

function shouldRenderDirectInlineObjectNode(node: NodeRuntimeNodeDto, effectEditor: boolean) {
  const childMapId = node.childMapId ?? ''

  return DIRECT_INLINE_OBJECT_CHILD_MAP_IDS.has(childMapId)
    || (effectEditor && EFFECT_EDITOR_DIRECT_INLINE_OBJECT_CHILD_MAP_IDS.has(childMapId))
}

function hasConfiguredObjectGroupValue(node: NodeRuntimeNodeDto, value: unknown): boolean {
  if (!isRuntimeRecord(value)) return false

  if (node.childMapId === 'featureGrants') {
    return FEATURE_GRANT_CONFIGS.some((config) => toRuntimeArray(value[config.pathKey]).length > 0)
  }

  if (node.childMapId === 'facet') {
    return hasConfiguredFacetValue(value)
  }

  return hasMeaningfulRecordValue(value)
}

function getObjectGroupDescription(node: NodeRuntimeNodeDto, value: unknown): string | undefined {
  if (!isRuntimeRecord(value)) return undefined

  if (node.childMapId === 'charges') return formatChargeSummary(value)
  if (node.childMapId === 'facet') return formatFacetSummary(value)
  if (node.childMapId === 'featureGrants') return formatFeatureGrantsSummary(value)
  if (node.childMapId === 'resultBlock' || node.childMapId === 'nonManifestResultBlock') {
    return formatResultBlockSummary(value)
  }

  return undefined
}

function hasConfiguredFacetValue(value: Record<string, unknown>): boolean {
  return toRuntimeArray(value.groups).some((groupValue) => {
    if (!isRuntimeRecord(groupValue)) return false

    return toRuntimeArray(groupValue.contexts).some((contextValue) => {
      if (!isRuntimeRecord(contextValue)) return false
      return toRuntimeArray(contextValue.conditions).length > 0
    })
  })
}

function formatFacetSummary(value: Record<string, unknown>): string | undefined {
  const conditionCount = toRuntimeArray(value.groups).reduce<number>((total, groupValue) => {
    if (!isRuntimeRecord(groupValue)) return total

    return total + toRuntimeArray(groupValue.contexts).reduce<number>((contextTotal, contextValue) => {
      if (!isRuntimeRecord(contextValue)) return contextTotal
      return contextTotal + toRuntimeArray(contextValue.conditions).length
    }, 0)
  }, 0)

  if (conditionCount === 0) return undefined
  return `${conditionCount} condition${conditionCount === 1 ? '' : 's'}`
}

function formatFeatureGrantsSummary(value: Record<string, unknown>): string | undefined {
  const grantLabels = FEATURE_GRANT_CONFIGS
    .map((config) => {
      const count = toRuntimeArray(value[config.pathKey]).length
      if (count === 0) return undefined
      return `${count} ${config.label.toLowerCase()}${count === 1 ? '' : 's'}`
    })
    .filter((entry): entry is string => Boolean(entry))

  return grantLabels.length > 0 ? grantLabels.join(', ') : undefined
}

function formatChargeSummary(value: Record<string, unknown>): string | undefined {
  const amount = typeof value.amount === 'number' ? value.amount : undefined
  const limitKind = typeof value.limitKind === 'string' ? value.limitKind : undefined
  const resetKind = typeof value.resetKind === 'string' ? value.resetKind : undefined
  const amountText = amount === undefined
    ? limitKind ? formatEnumLabel(limitKind).toLowerCase() : undefined
    : `${amount} use${amount === 1 ? '' : 's'}`
  const resetText = resetKind ? formatEnumLabel(resetKind).toLowerCase() : undefined

  if (amountText && resetText) return `${amountText}, ${resetText}`
  return amountText ?? resetText
}

function hasMeaningfulRecordValue(value: Record<string, unknown>): boolean {
  for (const [key, entry] of Object.entries(value)) {
    if (SYSTEM_MANAGED_FIELD_KEYS.has(key)) continue
    if (entry === undefined || entry === null) continue
    if (typeof entry === 'string' && entry.trim().length === 0) continue
    if (Array.isArray(entry)) {
      if (entry.length > 0) return true
      continue
    }
    if (typeof entry === 'object') {
      if (isRuntimeRecord(entry) && hasMeaningfulRecordValue(entry)) return true
      continue
    }
    return true
  }

  return false
}

function getFeatureGrantConfig(node: NodeRuntimeNodeDto) {
  const pathKey = node.path[node.path.length - 1]
  return FEATURE_GRANT_CONFIGS.find((config) => config.pathKey === pathKey)
}

function createFeatureGrantsWithGrant(config: (typeof FEATURE_GRANT_CONFIGS)[number]) {
  return {
    feats: [],
    modifiers: [],
    proficiencies: [],
    senses: [],
    spells: [],
    [config.pathKey]: [createDefaultAuthoringNodeValue(config.childMapId, 1)]
  }
}

function shouldHideSectionHeader(
  section: NodeRuntimeSectionDto,
  visibleSections: readonly NodeRuntimeSectionDto[]
) {
  if (visibleSections.length === 1) return true

  const visibleNodes = section.nodes.filter((node) => node.visible && !isSystemManagedFieldNode(node))
  return visibleNodes.length === 1 && visibleNodes[0]?.kind === 'GROUP'
}

function readArrayItemLabel(node: NodeRuntimeNodeDto, item: unknown) {
  if (!isRuntimeRecord(item)) return undefined

  if (node.childMapId === 'effect' && isEffectLike(item)) {
    return formatEffectSummary(item)
  }

  const label = item.label
  if (typeof label === 'string' && label.trim().length > 0) return label

  const pathCode = item.pathCode
  if (typeof pathCode === 'string' && pathCode.trim().length > 0) {
    return PATH_CODE_LABELS.get(pathCode) ?? formatEnumLabel(pathCode)
  }

  const effectKind = item.effectKind
  if (typeof effectKind === 'string' && effectKind.trim().length > 0) {
    return formatEnumLabel(effectKind)
  }

  const rollRange = item.rollRange
  if (Array.isArray(rollRange) && rollRange.length >= 2) {
    const [min, max] = rollRange
    if (typeof min === 'number' && typeof max === 'number') return `${min}-${max}`
  }

  const rollValue = item.rollValue
  if (typeof rollValue === 'number') return `Roll ${rollValue}`

  return undefined
}

function isEffectLike(value: Record<string, unknown>): value is EffectDto {
  return isRuntimeRecord(value.invocation)
    && typeof value.invocation.triggerCode === 'string'
    && Array.isArray(value.paths)
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function isSystemManagedFieldNode(node: NodeRuntimeNodeDto) {
  if (node.kind !== 'INPUT') return false

  const fieldKey = node.path[node.path.length - 1]
  return typeof fieldKey === 'string' && SYSTEM_MANAGED_FIELD_KEYS.has(fieldKey)
}

function isRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
