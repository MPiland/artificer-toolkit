import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore, type DeepKeys } from '@tanstack/react-form'
import type {
  NodeRuntimeNodeDto,
  NodeRuntimePathDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { useAuthoringForm } from '../layout/AuthoringFormContext'
import { clearResolvedNodeFormPaths, toResolvedNodeValues } from '../node-map/nodeFormUtils'
import {
  getVisibleAuthoringSteps,
  useAuthoringResolvedModel,
  type VisibleAuthoringSteps
} from '../hooks/useAuthoringResolvedModel'
import { getAuthoringProgress, type FieldMetaSnapshot } from '../validation/authoringProgress'
import { withForm } from '../app-form/AppForm'
import {
  getAuthoringFieldValue,
  toAuthoringFieldName,
  toTypedAuthoringArrayFieldName,
  prefixRuntimePaths,
  toTypedAuthoringFieldName
} from '../utils/pathUtils'
import {
  buildAuthoringNavigationTree,
  getFirstArrayItemNavigationTargetId,
  type AuthoringNavigationTarget
} from '../layout/authoringNavigation'
import {
  createDefaultAuthoringArrayItem,
  createDefaultAuthoringObjectItem,
  type AuthoringGroupValues
} from './authoringNodeDefaults'
import {
  toEditorValues,
  hasVisibleStepChanges,
  resetVisibleStepFields,
  isRenderableNode,
  getEffectiveInputType,
  getRequiredValidators
} from './FormRenderer.utils'
import * as styles from './FormRenderer.css'
import { ActionIcon, Alert, Button, Collapse, Group, Text } from '@mantine/core'
import { ChevronDown, Trash2 } from 'lucide-react'
import { speedOptions } from '@artificer-toolkit/shared/authored'
import { EFFECT_KIND_OPTIONS, PATH_CODE_OPTIONS, TRIGGER_OPTIONS } from '@artificer-toolkit/shared/core'

export type FormRendererOptions<TValues extends object> = {
  defaultValues: TValues
}

type SharedRendererProps = {
  ancestors?: readonly Record<string, unknown>[]
  currentStepId?: string
  debounceMs?: number
  fieldPathPrefix?: string
  mapId?: string
  model?: NodeRuntimeResolveResponseDto
  parentValues?: Record<string, unknown>
  readOnly?: boolean
  renderAllSteps?: boolean
  resolveModel?: boolean
  systemId?: string
  updateAuthoringState?: boolean
}

type RenderNodeProps<TValues extends object> = {
  fieldName: DeepKeys<TValues>
  node: NodeRuntimeNodeDto
  readOnly: boolean
}

const EMPTY_VISIBLE_STEPS: VisibleAuthoringSteps = []

export function FormRenderer<TValues extends object>({
  defaultValues
}: FormRendererOptions<TValues>) {
  const Renderer = withForm({
    defaultValues,
    props: {} as SharedRendererProps,
    render: function Render({
      ancestors,
      currentStepId,
      debounceMs = 150,
      fieldPathPrefix,
      form,
      mapId,
      model,
      parentValues,
      readOnly,
      renderAllSteps = false,
      resolveModel,
      systemId,
      updateAuthoringState = true
    }) {
      const authoring = useAuthoringForm()
      const {
        updateAuthoringFormActions,
        updateAuthoringFormState
      } = authoring
      const [collapsedInlineRowIds, setCollapsedInlineRowIds] = useState<ReadonlySet<string>>(
        () => new Set()
      )
      const resolvedFieldPathPrefix = fieldPathPrefix
      const resolvedMapId = mapId ?? authoring.mapId
      const resolvedReadOnly = readOnly ?? authoring.readOnly
      const resolvedResolveModel = resolveModel ?? authoring.resolveModel
      const resolvedSystemId = systemId ?? authoring.systemId
      const formValues = useStore(form.store, (state) => state.values)
      const rootValues = useMemo(() => toResolvedNodeValues(formValues), [formValues])
      const canSubmit = useStore(form.store, (state) => state.canSubmit)
      const fieldMeta = useStore(
        form.store,
        (state) => state.fieldMeta as Partial<Record<string, FieldMetaSnapshot>>
      )
      const hasChanges = useStore(form.store, (state) => state.isDirty)
      const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
      const values = useMemo(() => {
        if (!resolvedFieldPathPrefix) return rootValues

        return toEditorValues(
          getAuthoringFieldValue(rootValues, resolvedFieldPathPrefix)
        )
      }, [resolvedFieldPathPrefix, rootValues])
      const childAncestors = useMemo(
        () => (parentValues ? [parentValues, ...(ancestors ?? [])] : ancestors),
        [ancestors, parentValues]
      )
      const { model: activeModel } = useAuthoringResolvedModel({
        ancestors,
        debounceMs,
        mapId: resolvedMapId ?? 'pending',
        model: model ?? (mapId ? undefined : authoring.providedModel),
        resolveModel:
          Boolean(resolvedMapId) &&
          resolvedResolveModel &&
          !model &&
          !(mapId ? false : authoring.providedModel),
        parentValues,
        systemId: resolvedSystemId,
        values
      })
      const fallbackVisibleSteps = useMemo(
        () => (updateAuthoringState ? EMPTY_VISIBLE_STEPS : getVisibleAuthoringSteps(activeModel)),
        [activeModel, updateAuthoringState]
      )
      const navigationState = useMemo(
        () =>
          updateAuthoringState && resolvedMapId && activeModel
            ? buildAuthoringNavigationTree({
                ancestors,
                fieldMeta,
                mapId: resolvedMapId,
                model: activeModel,
                parentValues,
                values: rootValues,
                warnings: authoring.stepWarnings
              })
            : undefined,
        [
          activeModel,
          ancestors,
          authoring.stepWarnings,
          fieldMeta,
          parentValues,
          resolvedMapId,
          rootValues,
          updateAuthoringState
        ]
      )
      const activeTarget = updateAuthoringState
        ? authoring.activeNavigationTarget ?? navigationState?.navigationTargets[0]
        : undefined
      const targetStepId =
        currentStepId ??
        (activeTarget?.kind === 'step' &&
        activeTarget.mapId === resolvedMapId &&
        activeTarget.fieldPathPrefix === resolvedFieldPathPrefix
          ? activeTarget.stepId
          : undefined)
      const visibleSteps = updateAuthoringState ? authoring.visibleSteps : fallbackVisibleSteps
      const currentStep = targetStepId
        ? visibleSteps.find((step) => step.id === targetStepId)
        : updateAuthoringState
          ? authoring.activeStep
          : visibleSteps[0]
      const currentStepHasChanges = useStore(form.store, (state) =>
        hasVisibleStepChanges(
          form,
          currentStep?.sections ?? [],
          resolvedFieldPathPrefix,
          state.fieldMeta
        )
      )
      const progress = useMemo(
        () =>
          getAuthoringProgress({
            fieldMeta,
            fieldPathPrefix: resolvedFieldPathPrefix,
            model: activeModel,
            values,
            warnings: authoring.stepWarnings
          }),
        [
          activeModel,
          authoring.stepWarnings,
          resolvedFieldPathPrefix,
          fieldMeta,
          values
        ]
      )

      const resetCurrentStep = useCallback(() => {
        resetVisibleStepFields(form, currentStep?.sections ?? [], resolvedFieldPathPrefix)
      }, [currentStep, form, resolvedFieldPathPrefix])

      const resetCurrentForm = useCallback(() => {
        form.reset?.()
      }, [form])

      const clearPaths = useCallback(
        (paths: readonly NodeRuntimePathDto[]) => {
          if (resolvedFieldPathPrefix) {
            clearResolvedNodeFormPaths(form, prefixRuntimePaths(resolvedFieldPathPrefix, paths))
            return
          }

          clearResolvedNodeFormPaths(form, paths)
        },
        [form, resolvedFieldPathPrefix]
      )
      const runtimeClearPaths = activeModel?.clearPaths ?? []
      const runtimeClearPathKey = runtimeClearPaths.map((path) => path.join('.')).join('|')

      useEffect(() => {
        if (updateAuthoringState || !hasChanges || runtimeClearPaths.length === 0) return
        clearPaths(runtimeClearPaths)
      }, [clearPaths, hasChanges, runtimeClearPathKey, runtimeClearPaths, updateAuthoringState])
      const statePatch = useMemo(
        () => ({
          canFinalize:
            canSubmit &&
            (navigationState
              ? Object.values(navigationState.stepStatuses).every((status) => status === 'complete')
              : progress.canFinalize),
          canResetForm: hasChanges && !resolvedReadOnly,
          canResetStep: currentStep != null && !resolvedReadOnly,
          canSubmit,
          fieldPathPrefix: resolvedFieldPathPrefix,
          firstBlockingStepId: progress.firstBlockingStepId,
          firstBlockingStatus: progress.firstBlockingStatus,
          hasChanges,
          hasStepChanges: currentStepHasChanges,
          isSubmitting,
          navigationTargets: navigationState?.navigationTargets,
          navigationTree: navigationState?.navigationTree,
          progressSummary: navigationState?.progressSummary ?? progress.summary,
          readOnly: resolvedReadOnly,
          resolvedModel: activeModel,
          resetFormLabel: 'Reset Form',
          resetStepLabel: 'Reset Step',
          stepDirty: progress.stepDirty,
          stepStatuses: navigationState?.stepStatuses ?? progress.stepStatuses,
          systemId: resolvedSystemId
        }),
        [
          activeModel,
          currentStep,
          currentStepHasChanges,
          navigationState,
          progress,
          resolvedFieldPathPrefix,
          resolvedReadOnly,
          resolvedSystemId,
          canSubmit,
          hasChanges,
          isSubmitting
        ]
      )
      const actions = useMemo(
        () => ({
          onClearPaths: clearPaths,
          onResetForm: resetCurrentForm,
          onResetStep: resetCurrentStep
        }),
        [clearPaths, resetCurrentForm, resetCurrentStep]
      )

      const shouldUpdateAuthoringState =
        updateAuthoringState && Boolean(resolvedMapId && activeModel)

      useEffect(() => {
        if (!shouldUpdateAuthoringState) return
        updateAuthoringFormState(statePatch)
      }, [shouldUpdateAuthoringState, statePatch, updateAuthoringFormState])

      useEffect(() => {
        if (!shouldUpdateAuthoringState) return
        updateAuthoringFormActions(actions)
      }, [actions, shouldUpdateAuthoringState, updateAuthoringFormActions])

      if (!resolvedMapId || !activeModel) return null

      if (
        updateAuthoringState &&
        activeTarget?.kind === 'step' &&
        (activeTarget.mapId !== resolvedMapId ||
          activeTarget.fieldPathPrefix !== resolvedFieldPathPrefix)
      ) {
        return (
          <Renderer
            form={form}
            ancestors={activeTarget.ancestors}
            currentStepId={activeTarget.stepId}
            debounceMs={debounceMs}
            fieldPathPrefix={activeTarget.fieldPathPrefix}
            mapId={activeTarget.mapId}
            parentValues={activeTarget.parentValues}
            readOnly={resolvedReadOnly}
            resolveModel={resolvedResolveModel}
            systemId={resolvedSystemId}
            updateAuthoringState={false}
          />
        )
      }

      if (updateAuthoringState && activeTarget?.kind === 'overview') {
        return renderArrayOverview(activeTarget)
      }

      if (!currentStep) return null
      const renderedSteps = renderAllSteps ? visibleSteps : [currentStep]

      function renderNode<TValues extends object>({
        fieldName,
        node,
        readOnly
      }: RenderNodeProps<TValues>) {
        const inputType = getEffectiveInputType(node)
        const validators = node.required ? getRequiredValidators(inputType, node.label) : undefined

        return (
          <form.AppField key={node.id} name={fieldName} validators={validators}>
            {(appField) => {
              switch (inputType) {
                case 'TEXT':
                  return (
                    <appField.TextField
                      label={node.label}
                      required={node.required}
                      readOnly={readOnly}
                    />
                  )
                case 'NUMBER':
                  return (
                    <appField.NumberField
                      label={node.label}
                      required={node.required}
                      readOnly={readOnly}
                    />
                  )
                case 'RICH_TEXT':
                  return (
                    <div className={styles.wideField}>
                      <appField.RichTextField
                        label={node.label}
                        required={node.required}
                        readOnly={readOnly}
                      />
                    </div>
                  )
                case 'SELECT_SINGLE':
                  return (
                    <appField.SelectField
                      label={node.label}
                      data={node.options ?? []}
                      required={node.required}
                      readOnly={readOnly}
                    />
                  )
                case 'SELECT_MULTI':
                  return (
                    <appField.MultiSelectField
                      label={node.label}
                      data={node.options ?? []}
                      required={node.required}
                      readOnly={readOnly}
                    />
                  )
                default:
                  return (
                    <Alert color='yellow' className={styles.wideField}>
                      <Text>{`Unsupported field: ${node.label}`}</Text>
                    </Alert>
                  )
              }
            }}
          </form.AppField>
        )
      }

      function renderGroupNode(node: NodeRuntimeNodeDto) {
        if (node.kind !== 'GROUP' || !node.childMapId) return null

        const nodeReadOnly = Boolean(resolvedReadOnly || node.readOnly || node.disabled)
        const fieldPrefix = toAuthoringFieldName(resolvedFieldPathPrefix, node.path)

        if (node.groupKind === 'ARRAY') {
          const fieldName = toTypedAuthoringArrayFieldName<TValues>(
            resolvedFieldPathPrefix,
            node.path
          )

          return (
            <form.AppField key={node.id} name={fieldName} mode='array'>
              {(field) => {
                const rows = Array.isArray(field.state.value) ? field.state.value : []

                return (
                  <div className={styles.wideField}>
                    <Group justify='space-between' align='center' mb='xs'>
                      <Text fw={700}>{node.label}</Text>
                      {!nodeReadOnly ? (
                        <Button
                          aria-label={`Add ${toSingularLabel(node.label)}`}
                          type='button'
                          variant='default'
                          size='xs'
                          onClick={() => {
                            field.pushValue(
                              createDefaultAuthoringArrayItem(
                                node,
                                rows.length
                              ) as Parameters<typeof field.pushValue>[0]
                            )
                          }}
                        >
                          Add
                        </Button>
                      ) : null}
                    </Group>
                    {rows.length === 0 ? (
                      <Text size='sm' c='dimmed'>{`No ${node.label.toLowerCase()} added yet.`}</Text>
                    ) : (
                      <div className={styles.inlineArrayList}>
                        {rows.map((row, index) => {
                          const rowPrefix = toAuthoringFieldName(
                            resolvedFieldPathPrefix,
                            [...node.path, index]
                          )
                          const rowId = `${rowPrefix}:${getGroupRowKey(row, index)}`
                          const isRowExpanded = !collapsedInlineRowIds.has(rowId)
                          const rowLabel = getGroupRowLabel(node, row, index)

                          const toggleRow = () => {
                            setCollapsedInlineRowIds((current) => {
                              const next = new Set(current)
                              if (next.has(rowId)) {
                                next.delete(rowId)
                              } else {
                                next.add(rowId)
                              }
                              return next
                            })
                          }

                          return (
                            <div key={getGroupRowKey(row, index)} className={styles.inlineArrayItem}>
                              <div className={styles.inlineArrayItemHeader}>
                                <button
                                  type='button'
                                  className={styles.inlineArrayItemTrigger}
                                  aria-expanded={isRowExpanded}
                                  onClick={toggleRow}
                                >
                                  <ChevronDown
                                    size={16}
                                    aria-hidden='true'
                                    className={
                                      isRowExpanded
                                        ? `${styles.inlineArrayItemChevron} ${styles.inlineArrayItemChevronOpen}`
                                        : styles.inlineArrayItemChevron
                                    }
                                  />
                                  <Text className={styles.inlineArrayItemTitle}>{rowLabel}</Text>
                                </button>
                                {!nodeReadOnly ? (
                                  <ActionIcon
                                    aria-label={`Remove ${rowLabel}`}
                                    color='red'
                                    variant='subtle'
                                    onClick={() => field.removeValue(index)}
                                  >
                                    <Trash2 size={16} aria-hidden='true' />
                                  </ActionIcon>
                                ) : null}
                              </div>
                              <Collapse
                                expanded={isRowExpanded}
                                keepMounted
                                transitionDuration={140}
                                transitionTimingFunction='cubic-bezier(0.2, 0, 0, 1)'
                              >
                                <div className={styles.inlineArrayItemBody}>
                                  <Renderer
                                    form={form}
                                    ancestors={[values, ...(childAncestors ?? [])]}
                                    debounceMs={debounceMs}
                                    fieldPathPrefix={rowPrefix}
                                    mapId={node.childMapId}
                                    parentValues={values}
                                    readOnly={nodeReadOnly}
                                    renderAllSteps
                                    resolveModel={resolvedResolveModel}
                                    systemId={resolvedSystemId}
                                    updateAuthoringState={false}
                                  />
                                </div>
                              </Collapse>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }}
            </form.AppField>
          )
        }

        return (
          <form.AppField key={node.id} name={toTypedAuthoringFieldName<TValues>(
            resolvedFieldPathPrefix,
            node.path
          )}>
            {(field) => {
              const hasValue = isGroupObjectValue(field.state.value)
              const canRemoveValue =
                hasValue &&
                !node.required &&
                !(isTopLevelGroupNode(node) && !resolvedFieldPathPrefix)

              return (
                <div className={styles.wideField}>
                  <Group justify='space-between' align='center' mb='xs'>
                    <Text fw={700}>{node.label}</Text>
                    {!nodeReadOnly ? (
                      canRemoveValue ? (
                        <ActionIcon
                          aria-label={`Remove ${node.label}`}
                          color='red'
                          variant='subtle'
                          onClick={() =>
                            field.handleChange(
                              undefined as Parameters<typeof field.handleChange>[0]
                            )
                          }
                        >
                          <Trash2 size={16} aria-hidden='true' />
                        </ActionIcon>
                      ) : !hasValue ? (
                        <Button
                          aria-label={`Add ${toSingularLabel(node.label)}`}
                          type='button'
                          variant='default'
                          size='xs'
                          onClick={() => {
                            field.handleChange(
                              createDefaultAuthoringObjectItem(
                                node
                              ) as Parameters<typeof field.handleChange>[0]
                            )
                          }}
                        >
                          Add
                        </Button>
                      ) : null
                    ) : null}
                  </Group>
                  {hasValue ? (
                    <div className={styles.nestedShell}>
                      <Renderer
                        form={form}
                        ancestors={[values, ...(childAncestors ?? [])]}
                        debounceMs={debounceMs}
                        fieldPathPrefix={fieldPrefix}
                        mapId={node.childMapId}
                        parentValues={values}
                        readOnly={nodeReadOnly}
                        renderAllSteps
                        resolveModel={resolvedResolveModel}
                        systemId={resolvedSystemId}
                        updateAuthoringState={false}
                      />
                    </div>
                  ) : (
                    <Text size='sm' c='dimmed'>{`${node.label} has not been configured yet.`}</Text>
                  )}
                </div>
              )
            }}
          </form.AppField>
        )
      }

      function renderArrayOverview(target: AuthoringNavigationTarget) {
        const node = target.collectionNode
        const collectionFieldName = target.collectionFieldName
        if (!node || !collectionFieldName) return null

        const nodeReadOnly = Boolean(resolvedReadOnly || node.readOnly || node.disabled)
        const fieldName =
          collectionFieldName as ReturnType<typeof toTypedAuthoringArrayFieldName<TValues>>

        return (
          <form.AppField key={target.id} name={fieldName} mode='array'>
            {(field) => {
              const rows = Array.isArray(field.state.value) ? field.state.value : []

              return (
                <div className={styles.sectionStack}>
                  <section>
                    <div className={styles.fieldGrid}>
                      <div className={styles.wideField}>
                        <Group justify='space-between' align='center' mb='xs'>
                          <Text fw={700}>{node.label}</Text>
                          {!nodeReadOnly ? (
                            <Button
                              aria-label={`Add ${toSingularLabel(node.label)}`}
                              type='button'
                              variant='default'
                              size='xs'
                              onClick={() => {
                                const rowIndex = rows.length
                                field.pushValue(
                                  createDefaultAuthoringArrayItem(
                                    node,
                                    rowIndex
                                  ) as Parameters<typeof field.pushValue>[0]
                                )
                                const targetId = getFirstArrayItemNavigationTargetId({
                                  collectionFieldName,
                                  collectionNode: node,
                                  rowIndex
                                })
                                if (targetId) authoring.goToNavigationTarget(targetId)
                              }}
                            >
                              Add
                            </Button>
                          ) : null}
                        </Group>
                        {rows.length === 0 ? (
                          <Text size='sm' c='dimmed'>{`No ${node.label.toLowerCase()} added yet.`}</Text>
                        ) : (
                          <div className={styles.inlineArrayList}>
                            {rows.map((row, index) => {
                              const label = getGroupRowLabel(node, row, index)
                              const targetId = getFirstArrayItemNavigationTargetId({
                                collectionFieldName,
                                collectionNode: node,
                                rowIndex: index
                              })

                              return (
                                <div key={getGroupRowKey(row, index)} className={styles.inlineArrayItem}>
                                  <div className={styles.inlineArrayItemHeader}>
                                    <button
                                      type='button'
                                      className={styles.inlineArrayItemTrigger}
                                      onClick={() => {
                                        if (targetId) authoring.goToNavigationTarget(targetId)
                                      }}
                                    >
                                      <Text className={styles.inlineArrayItemTitle}>
                                        {label}
                                      </Text>
                                    </button>
                                    {!nodeReadOnly ? (
                                      <ActionIcon
                                        aria-label={`Remove ${label}`}
                                        color='red'
                                        variant='subtle'
                                        onClick={() => field.removeValue(index)}
                                      >
                                        <Trash2 size={16} aria-hidden='true' />
                                      </ActionIcon>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              )
            }}
          </form.AppField>
        )
      }

      return (
        <div className={styles.sectionStack}>
          {renderedSteps.flatMap((step) => step.sections)
            .filter((section) => section.nodes.some(isRenderableNode))
            .map((section) => {
              const sectionCount = renderedSteps.reduce(
                (count, step) => count + step.sections.length,
                0
              )
              const showSectionHeader = sectionCount > 1

              return (
                <section
                  key={section.id}
                  aria-labelledby={
                    showSectionHeader ? `authoring-section-${section.id}` : undefined
                  }
                >
                  {showSectionHeader ? (
                    <div>
                      <h2 id={`authoring-section-${section.id}`}>{section.label}</h2>
                    </div>
                  ) : null}
                  <div className={styles.fieldGrid}>
                    {section.nodes.map((node) => {
                      if (!isRenderableNode(node)) return null
                      if (node.kind === 'GROUP') return renderGroupNode(node)

                      const fieldName = toTypedAuthoringFieldName<TValues>(
                        resolvedFieldPathPrefix,
                        node.path
                      )
                      const nodeReadOnly = Boolean(
                        resolvedReadOnly || node.readOnly || node.disabled
                      )

                      return (
                        renderNode({
                          fieldName,
                          node,
                          readOnly: nodeReadOnly
                        })
                      )
                    })}
                  </div>
                </section>
              )
            })}
        </div>
      )
    }
  })

  return Renderer
}

function getGroupRowKey(row: unknown, index: number) {
  if (isRecord(row) && typeof row.id === 'string') return row.id
  return String(index)
}

function getRecordObjectValue(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function getGroupRowLabel(node: NodeRuntimeNodeDto, row: unknown, index: number) {
  if (isRecord(row) && typeof row.label === 'string' && row.label.trim()) {
    return row.label
  }

  const authoredLabel = getAuthoredRowLabel(node, row)
  if (authoredLabel) return authoredLabel

  const speedLabel = getSpeedRowLabel(node, row)
  if (speedLabel) return speedLabel

  return `${toSingularLabel(node.label)} ${index + 1}`
}

function getAuthoredRowLabel(node: NodeRuntimeNodeDto, row: unknown): string | undefined {
  if (!isRecord(row)) return undefined

  if (node.childMapId === 'effect') {
    return getOptionLabel(TRIGGER_OPTIONS, readString(getRecordValue(row, 'invocation.triggerCode')))
  }

  if (node.childMapId === 'effectPath' || node.childMapId === 'manifestBehaviorPath') {
    return getOptionLabel(PATH_CODE_OPTIONS, readString(row.pathCode))
  }

  if (node.childMapId === 'outcome' || node.childMapId === 'nonManifestOutcome') {
    return getOptionLabel(EFFECT_KIND_OPTIONS, readString(row.effectKind))
  }

  return undefined
}

function getSpeedRowLabel(node: NodeRuntimeNodeDto, row: unknown): string | undefined {
  if (!isRecord(row) || !isSpeedGroupNode(node)) return undefined

  const speedLabel = getSpeedOptionLabel(readString(row.speedId))
  const amount = readNumber(row.amount)
  const unit = formatEnumLabel(readString(row.unit))
  const amountLabel = amount === undefined ? undefined : `${formatNumber(amount)} ${unit ?? 'Feet'}`

  if (speedLabel && amountLabel) return `${speedLabel} - ${amountLabel}`
  return speedLabel ?? amountLabel
}

function isSpeedGroupNode(node: NodeRuntimeNodeDto) {
  return node.childMapId === 'speed' || toSingularLabel(node.label).toLowerCase() === 'speed'
}

function isTopLevelGroupNode(node: NodeRuntimeNodeDto) {
  return node.path.length === 1
}

function getSpeedOptionLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.toLowerCase()
  return speedOptions.find((option) =>
    [option.id, option.code, option.label].some((candidate) =>
      candidate.toLowerCase() === normalized
    )
  )?.label
}

function getOptionLabel(
  options: readonly { code: string; label: string }[],
  value: string | undefined
): string | undefined {
  if (!value) return undefined

  return options.find((option) => option.code === value)?.label
}

function getRecordValue(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!isRecord(value)) return undefined
    return value[segment]
  }, record)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatEnumLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isGroupObjectValue(value: unknown): value is AuthoringGroupValues {
  return isRecord(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toSingularLabel(label: string) {
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`
  if (label.endsWith('ses')) return label.slice(0, -2)
  return label.endsWith('s') ? label.slice(0, -1) : label
}
