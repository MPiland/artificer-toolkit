import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '@tanstack/react-form'
import type {
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
  prefixRuntimePaths,
  toTypedAuthoringFieldName
} from '../utils/pathUtils'
import {
  buildAuthoringNavigationTree,
  isNavigableAuthoringGroupNode,
  type AuthoringNavigationTarget
} from '../layout/authoringNavigation'
import {
  toEditorValues,
  hasVisibleStepChanges,
  resetVisibleStepFields,
  isRenderableNode
} from './FormRenderer.utils'
import { useStructuralChangeGuard, type StructuralChangeGuard } from './useStructuralChangeGuard'
import {
  AuthoringRendererInteractionsProvider,
  AuthoringRendererScopeProvider,
  type AuthoringRendererInteractions,
  type AuthoringRendererScope,
  type GroupEditorTransaction,
  type GroupRemoval,
  type RenderChildAuthoringSchema
} from './FormRenderer.context'
import { createResolvedInputField } from './ResolvedInputField.factory'
import { createResolvedArrayGroup } from './ResolvedArrayGroup.factory'
import { createResolvedObjectGroup } from './ResolvedObjectGroup.factory'
import { createResolvedCollectionOverview } from './ResolvedCollectionOverview.factory'
import { captureGroupEditorSnapshot } from './groupEditorTransaction'
import { AuthoringValidationAlert } from './AuthoringValidationAlert'
import { getResolvedAuthoringScope } from '../authoring-schema/resolvedAuthoringScope'
import * as styles from './FormRenderer.css'
import { Button, Group, Modal, Text } from '@mantine/core'
import { CircleHelp } from 'lucide-react'

export type FormRendererOptions<TValues extends object> = {
  defaultValues: TValues
}

type SharedRendererProps = {
  ancestors?: readonly Record<string, unknown>[]
  canvasContent?: ReactNode
  currentStepId?: string
  debounceMs?: number
  fieldPathPrefix?: string
  mapId?: string
  model?: NodeRuntimeResolveResponseDto
  navigationTarget?: AuthoringNavigationTarget
  parentValues?: Record<string, unknown>
  readOnly?: boolean
  renderAllSteps?: boolean
  renderNavigationTarget?: boolean
  resolveModel?: boolean
  systemId?: string
  structuralChangeGuard?: StructuralChangeGuard
  updateAuthoringState?: boolean
}

const EMPTY_VISIBLE_STEPS: VisibleAuthoringSteps = []

function isSameAuthoringLabel(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}

export function FormRenderer<TValues extends object>({
  defaultValues
}: FormRendererOptions<TValues>) {
  const ResolvedInputField = createResolvedInputField(defaultValues)
  const ResolvedArrayGroup = createResolvedArrayGroup(defaultValues)
  const ResolvedObjectGroup = createResolvedObjectGroup(defaultValues)
  const ResolvedCollectionOverview = createResolvedCollectionOverview(defaultValues)
  const Renderer = withForm({
    defaultValues,
    props: {} as SharedRendererProps,
    render: function Render({
      ancestors,
      canvasContent,
      currentStepId,
      debounceMs = 150,
      fieldPathPrefix,
      form,
      mapId,
      model,
      navigationTarget,
      parentValues,
      readOnly,
      renderAllSteps = false,
      renderNavigationTarget = false,
      resolveModel,
      systemId,
      structuralChangeGuard: inheritedStructuralChangeGuard,
      updateAuthoringState = true
    }) {
      const authoring = useAuthoringForm()
      const { updateAuthoringFormActions, updateAuthoringFormState } = authoring
      const [expandedInlineRowIds, setExpandedInlineRowIds] = useState<ReadonlySet<string>>(
        () => new Set()
      )
      const [groupEditor, setGroupEditor] = useState<GroupEditorTransaction>()
      const [groupRemoval, setGroupRemoval] = useState<GroupRemoval>()
      const resolvedFieldPathPrefix = fieldPathPrefix
      const resolvedMapId = mapId ?? authoring.mapId
      const resolvedReadOnly = readOnly ?? authoring.readOnly
      const resolvedResolveModel = resolveModel ?? authoring.resolveModel
      const resolvedSystemId = systemId ?? authoring.systemId
      const rendersNavigationTarget = updateAuthoringState || renderNavigationTarget
      const formValues = useStore(form.store, (state) => state.values)
      const rootValues = useMemo(() => toResolvedNodeValues(formValues), [formValues])
      const localStructuralChangeGuard = useStructuralChangeGuard({
        form,
        rootMapId: authoring.mapId,
        rootSystemId: authoring.systemId,
        rootValues
      })
      const structuralChangeGuard = inheritedStructuralChangeGuard ?? localStructuralChangeGuard
      const ownsStructuralChangeGuard = inheritedStructuralChangeGuard === undefined

      const canSubmit = useStore(form.store, (state) => state.canSubmit)
      const fieldMeta = useStore(
        form.store,
        (state) => state.fieldMeta as Partial<Record<string, FieldMetaSnapshot>>
      )
      const hasChanges = useStore(form.store, (state) => state.isDirty)
      const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
      const values = useMemo(() => {
        if (!resolvedFieldPathPrefix) return rootValues

        return toEditorValues(getAuthoringFieldValue(rootValues, resolvedFieldPathPrefix))
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
          rendersNavigationTarget && resolvedMapId && activeModel
            ? buildAuthoringNavigationTree({
                ancestors,
                fieldMeta,
                fieldPathPrefix: resolvedFieldPathPrefix,
                mapId: resolvedMapId,
                model: activeModel,
                parentValues,
                values: rootValues,
                validationIssues: authoring.validationIssues,
                warnings: authoring.stepWarnings
              })
            : undefined,
        [
          activeModel,
          ancestors,
          authoring.stepWarnings,
          authoring.validationIssues,
          fieldMeta,
          parentValues,
          resolvedMapId,
          rootValues,
          rendersNavigationTarget,
          resolvedFieldPathPrefix
        ]
      )
      const activeTarget =
        navigationTarget ??
        (updateAuthoringState
          ? (navigationState?.navigationTargets.find(
              (target) => target.id === authoring.activeNavigationTargetId
            ) ??
            (navigationState ? undefined : authoring.activeNavigationTarget) ??
            navigationState?.navigationTargets[0])
          : undefined)
      useEffect(() => {
        if (
          !rendersNavigationTarget ||
          activeTarget?.kind !== 'drawer-item' ||
          !activeTarget.collectionFieldName ||
          activeTarget.drawerRowIndex === undefined ||
          !activeTarget.fieldPathPrefix
        ) {
          return
        }

        const collectionFieldName = activeTarget.collectionFieldName
        const drawerRowIndex = activeTarget.drawerRowIndex
        const drawerLabel = activeTarget.label

        setGroupEditor((current) => {
          if (current?.fieldName === collectionFieldName && current.rowIndex === drawerRowIndex) {
            return current
          }

          const collection = getAuthoringFieldValue(
            toResolvedNodeValues(form.state.values),
            collectionFieldName
          )
          const snapshot = captureGroupEditorSnapshot({
            collection: Array.isArray(collection) ? collection : [],
            collectionFieldName,
            fieldMeta: form.state.fieldMeta,
            rowIndex: drawerRowIndex
          })

          return {
            fieldName: collectionFieldName,
            label: `Edit ${drawerLabel}`,
            mode: 'edit',
            opener: document.activeElement instanceof HTMLElement ? document.activeElement : null,
            rowIndex: drawerRowIndex,
            ...snapshot
          }
        })
      }, [activeTarget, form, rendersNavigationTarget])
      const activeCanvasMapId =
        activeTarget?.kind === 'step' ? activeTarget.mapId : activeTarget?.canvasMapId
      const activeCanvasFieldPathPrefix =
        activeTarget?.kind === 'step'
          ? activeTarget.fieldPathPrefix
          : activeTarget?.canvasFieldPathPrefix
      const delegatesNavigationTarget = Boolean(
        rendersNavigationTarget &&
        activeTarget &&
        activeCanvasMapId &&
        (activeCanvasMapId !== resolvedMapId ||
          activeCanvasFieldPathPrefix !== resolvedFieldPathPrefix)
      )
      const registersStagedEditorState = rendersNavigationTarget && !delegatesNavigationTarget
      const targetStepId =
        currentStepId ??
        (activeTarget?.kind === 'step'
          ? activeTarget.mapId === resolvedMapId &&
            activeTarget.fieldPathPrefix === resolvedFieldPathPrefix
            ? activeTarget.stepId
            : undefined
          : activeTarget &&
              activeTarget.canvasMapId === resolvedMapId &&
              activeTarget.canvasFieldPathPrefix === resolvedFieldPathPrefix
            ? activeTarget.canvasStepId
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
        [activeModel, authoring.stepWarnings, resolvedFieldPathPrefix, fieldMeta, values]
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
      const renderChild = useCallback<RenderChildAuthoringSchema>(
        (options) => {
          const childModel =
            options.model ??
            getResolvedAuthoringScope(activeModel, options.mapId, options.fieldPathPrefix)

          return (
            <Renderer
              {...options}
              form={form}
              debounceMs={debounceMs}
              model={childModel}
              resolveModel={resolvedResolveModel && activeModel?.scopes === undefined}
              systemId={resolvedSystemId}
              structuralChangeGuard={structuralChangeGuard}
              updateAuthoringState={false}
            />
          )
        },
        [
          activeModel,
          debounceMs,
          form,
          resolvedResolveModel,
          resolvedSystemId,
          structuralChangeGuard
        ]
      )
      const rendererScope = useMemo<AuthoringRendererScope>(
        () => ({
          childAncestors,
          fieldPathPrefix: resolvedFieldPathPrefix,
          model: activeModel,
          readOnly: Boolean(resolvedReadOnly),
          renderAllSteps,
          renderChild,
          structuralChangeGuard,
          values
        }),
        [
          activeModel,
          childAncestors,
          renderAllSteps,
          renderChild,
          resolvedFieldPathPrefix,
          resolvedReadOnly,
          structuralChangeGuard,
          values
        ]
      )
      const rendererInteractions = useMemo<AuthoringRendererInteractions>(
        () => ({
          expandedInlineRowIds,
          groupEditor,
          groupRemoval,
          setExpandedInlineRowIds,
          setGroupEditor,
          setGroupRemoval
        }),
        [expandedInlineRowIds, groupEditor, groupRemoval]
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

      useEffect(() => {
        if (!registersStagedEditorState) return
        updateAuthoringFormState({ stagedEditorOpen: Boolean(groupEditor) })
      }, [groupEditor, registersStagedEditorState, updateAuthoringFormState])

      useEffect(() => {
        if (!registersStagedEditorState) return
        return () => updateAuthoringFormState({ stagedEditorOpen: false })
      }, [registersStagedEditorState, updateAuthoringFormState])

      if (!resolvedMapId || !activeModel) return null

      const structuralChangeConfirmationModal = ownsStructuralChangeGuard ? (
        <Modal
          centered
          closeOnClickOutside={false}
          opened={Boolean(structuralChangeGuard.confirmation)}
          onClose={structuralChangeGuard.cancel}
          title='Clear hidden values?'
        >
          <Text size='sm'>
            {`Changing ${structuralChangeGuard.confirmation?.label ?? 'this field'} will remove configured values from fields that become hidden.`}
          </Text>
          <Group justify='flex-end' mt='md'>
            <Button type='button' variant='default' onClick={structuralChangeGuard.cancel}>
              Cancel
            </Button>
            <Button type='button' color='red' onClick={structuralChangeGuard.confirm}>
              Clear and continue
            </Button>
          </Group>
        </Modal>
      ) : null

      if (canvasContent) {
        return (
          <>
            <AuthoringValidationAlert
              target={updateAuthoringState ? activeTarget : undefined}
              validationTargets={
                navigationState?.navigationTargets ?? authoring.navigationTargets ?? []
              }
            />
            {canvasContent}
            {structuralChangeConfirmationModal}
          </>
        )
      }

      if (delegatesNavigationTarget && activeTarget && activeCanvasMapId) {
        const delegatedModel = getResolvedAuthoringScope(
          activeModel,
          activeCanvasMapId,
          activeCanvasFieldPathPrefix
        )

        return (
          <>
            <Renderer
              form={form}
              ancestors={
                activeTarget.kind === 'step' ? activeTarget.ancestors : activeTarget.canvasAncestors
              }
              currentStepId={
                activeTarget.kind === 'step' ? activeTarget.stepId : activeTarget.canvasStepId
              }
              debounceMs={debounceMs}
              fieldPathPrefix={activeCanvasFieldPathPrefix}
              mapId={activeCanvasMapId}
              model={delegatedModel}
              navigationTarget={activeTarget}
              parentValues={
                activeTarget.kind === 'step'
                  ? activeTarget.parentValues
                  : activeTarget.canvasParentValues
              }
              readOnly={resolvedReadOnly}
              renderNavigationTarget
              resolveModel={resolvedResolveModel && activeModel.scopes === undefined}
              systemId={resolvedSystemId}
              structuralChangeGuard={structuralChangeGuard}
              updateAuthoringState={false}
            />
            {structuralChangeConfirmationModal}
          </>
        )
      }

      if (!currentStep) return structuralChangeConfirmationModal
      const rendersCollectionCanvas =
        (activeTarget?.kind === 'overview' || activeTarget?.kind === 'drawer-item') &&
        activeTarget.canvasMapId === resolvedMapId &&
        activeTarget.canvasFieldPathPrefix === resolvedFieldPathPrefix
      const renderedSteps = renderAllSteps ? visibleSteps : [currentStep]
      const renderedSections = renderedSteps
        .flatMap((step) => step.sections)
        .filter((section) => section.nodes.some(isRenderableNode))
      const validationTargets =
        navigationState?.navigationTargets ?? authoring.navigationTargets ?? []
      const renderedValidationTarget = updateAuthoringState
        ? activeTarget
        : authoring.activeNavigationTarget?.kind === 'step' &&
            authoring.activeNavigationTarget.mapId === resolvedMapId &&
            authoring.activeNavigationTarget.fieldPathPrefix === resolvedFieldPathPrefix
          ? authoring.activeNavigationTarget
          : undefined
      const soleRenderedSection = renderedSections.length === 1 ? renderedSections[0] : undefined
      const soleRenderableNodes = soleRenderedSection?.nodes.filter(isRenderableNode) ?? []
      const soleRenderableNode =
        soleRenderableNodes.length === 1 ? soleRenderableNodes[0] : undefined
      const soleNavigableCollectionNode =
        soleRenderableNode?.kind === 'GROUP' &&
        soleRenderableNode.groupKind === 'ARRAY' &&
        isNavigableAuthoringGroupNode(soleRenderableNode, rootValues, resolvedFieldPathPrefix)
          ? soleRenderableNode
          : undefined
      const stepOwnsSoleSectionLabel =
        soleRenderedSection !== undefined &&
        isSameAuthoringLabel(soleRenderedSection.label, currentStep.label)
      const usesRowsOnlySectionStack =
        rendersNavigationTarget &&
        soleRenderedSection !== undefined &&
        soleNavigableCollectionNode !== undefined &&
        ((!stepOwnsSoleSectionLabel &&
          isSameAuthoringLabel(soleRenderedSection.label, soleNavigableCollectionNode.label)) ||
          isSameAuthoringLabel(currentStep.label, soleNavigableCollectionNode.label))
      const stepDescription = currentStep.description?.trim()
      return (
        <AuthoringRendererScopeProvider value={rendererScope}>
          <AuthoringRendererInteractionsProvider value={rendererInteractions}>
            <AuthoringValidationAlert
              target={renderedValidationTarget}
              validationTargets={validationTargets}
            />
            {rendersNavigationTarget ? (
              <div className={styles.canvasStepHeader}>
                <h2 className={styles.canvasStepTitle}>{currentStep.label}</h2>
                {stepDescription ? (
                  <>
                    <span className={styles.canvasStepDivider} aria-hidden='true' />
                    <span className={styles.canvasStepDescription}>{stepDescription}</span>
                  </>
                ) : null}
              </div>
            ) : null}
            <div
              className={`${styles.canvasSectionStack} ${
                usesRowsOnlySectionStack ? styles.canvasSectionStackRowsOnly : ''
              }`}
              data-section-surface={usesRowsOnlySectionStack ? 'rows-only' : 'panel'}
            >
              {renderedSections.map((section) => {
                const stepOwnsSectionLabel =
                  rendersNavigationTarget && isSameAuthoringLabel(section.label, currentStep.label)
                const showSectionHeader = !stepOwnsSectionLabel

                return (
                  <section
                    key={section.id}
                    aria-labelledby={
                      showSectionHeader ? `authoring-section-${section.id}` : undefined
                    }
                  >
                    {showSectionHeader ? (
                      <div className={styles.sectionHeading}>
                        <h3
                          className={styles.sectionHeadingTitle}
                          id={`authoring-section-${section.id}`}
                        >
                          {section.label}
                        </h3>
                        <CircleHelp size={15} aria-label={`About ${section.label}`} />
                      </div>
                    ) : null}
                    <div className={styles.fieldGrid}>
                      {section.nodes.map((node) => {
                        if (!isRenderableNode(node)) return null
                        if (
                          rendersCollectionCanvas &&
                          !(
                            node.kind === 'GROUP' &&
                            isNavigableAuthoringGroupNode(node, rootValues, resolvedFieldPathPrefix)
                          )
                        ) {
                          return null
                        }
                        if (node.kind === 'GROUP') {
                          if (
                            rendersNavigationTarget &&
                            isNavigableAuthoringGroupNode(node, rootValues, resolvedFieldPathPrefix)
                          ) {
                            if (node.groupKind === 'ARRAY') {
                              const collectionFieldName = toAuthoringFieldName(
                                resolvedFieldPathPrefix,
                                node.path
                              )
                              const overviewTarget = navigationState?.navigationTargets.find(
                                (target) =>
                                  target.kind === 'overview' &&
                                  target.collectionFieldName === collectionFieldName
                              )
                              if (overviewTarget) {
                                const rows = getAuthoringFieldValue(rootValues, collectionFieldName)
                                const isActiveCollection =
                                  activeTarget?.collectionFieldName === collectionFieldName
                                if (
                                  rendersCollectionCanvas &&
                                  !isActiveCollection &&
                                  (!Array.isArray(rows) || rows.length === 0)
                                ) {
                                  return null
                                }
                                const drawerTarget =
                                  activeTarget?.kind === 'drawer-item' &&
                                  activeTarget.collectionFieldName === collectionFieldName
                                    ? activeTarget
                                    : undefined
                                return (
                                  <ResolvedCollectionOverview
                                    key={node.id}
                                    drawerTarget={drawerTarget}
                                    form={form}
                                    hideHeading={
                                      (showSectionHeader &&
                                        isSameAuthoringLabel(section.label, node.label)) ||
                                      (rendersNavigationTarget &&
                                        isSameAuthoringLabel(currentStep.label, node.label))
                                    }
                                    target={overviewTarget}
                                    validationTargets={validationTargets}
                                  />
                                )
                              }
                            }
                            return null
                          }

                          const hideHeading =
                            (showSectionHeader &&
                              isSameAuthoringLabel(section.label, node.label)) ||
                            (rendersNavigationTarget &&
                              isSameAuthoringLabel(currentStep.label, node.label))
                          return node.groupKind === 'ARRAY' ? (
                            <ResolvedArrayGroup
                              key={node.id}
                              form={form}
                              hideHeading={hideHeading}
                              node={node}
                              validationTargets={validationTargets}
                            />
                          ) : (
                            <ResolvedObjectGroup
                              key={node.id}
                              form={form}
                              hideHeading={hideHeading}
                              node={node}
                            />
                          )
                        }

                        return (
                          <ResolvedInputField
                            key={node.id}
                            fieldName={toTypedAuthoringFieldName<TValues>(
                              resolvedFieldPathPrefix,
                              node.path
                            )}
                            form={form}
                            node={node}
                            readOnly={Boolean(resolvedReadOnly)}
                          />
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
            {structuralChangeConfirmationModal}
          </AuthoringRendererInteractionsProvider>
        </AuthoringRendererScopeProvider>
      )
    }
  })

  return Renderer
}
