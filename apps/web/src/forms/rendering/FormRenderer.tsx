import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  useAuthoringNavigation,
  useAuthoringResolution,
  useAuthoringSession,
  useAuthoringStagedEditor
} from '../layout/AuthoringFormContext'
import { toResolvedNodeValues } from '../node-map/nodeFormUtils'
import { useAuthoringResolvedModel } from '../hooks/useAuthoringResolvedModel'
import { RESOLUTION_DEBOUNCE_MS, useDebouncedFormState } from '../hooks/useDebouncedFormState'
import { withForm } from '../app-form/AppForm'
import {
  getAuthoringFieldValue,
  toAuthoringFieldName,
  toTypedAuthoringFieldName
} from '../utils/pathUtils'
import {
  isNavigableAuthoringGroupNode,
  type AuthoringNavigationTarget
} from '../layout/authoringNavigation'
import { toEditorValues, isRenderableNode } from './FormRenderer.utils'
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
import { Alert, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { CircleHelp } from 'lucide-react'
import { AuthoringArtworkControl } from '../AuthoringArtworkControl'

type FormRendererOptions<TValues extends object> = {
  defaultValues: TValues
}

type SharedRendererProps = {
  ancestors?: readonly Record<string, unknown>[]
  canvasContent?: ReactNode
  currentStepId?: string
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
      const session = useAuthoringSession()
      const navigation = useAuthoringNavigation()
      const providerResolution = useAuthoringResolution()
      const stagedEditor = useAuthoringStagedEditor()
      const [expandedInlineRowIds, setExpandedInlineRowIds] = useState<ReadonlySet<string>>(
        () => new Set()
      )
      const [localGroupEditor, setLocalGroupEditor] = useState<GroupEditorTransaction>()
      const [groupRemoval, setGroupRemoval] = useState<GroupRemoval>()
      const resolvedFieldPathPrefix = fieldPathPrefix
      const resolvedMapId = mapId ?? session.mapId
      const resolvedReadOnly = readOnly ?? session.readOnly
      const resolvedResolveModel = resolveModel ?? session.resolveModel
      const resolvedSystemId = systemId ?? session.systemId
      const rendersNavigationTarget = updateAuthoringState || renderNavigationTarget
      const formValues = useDebouncedFormState(form, RESOLUTION_DEBOUNCE_MS).values
      const rootValues = useMemo(() => toResolvedNodeValues(formValues), [formValues])
      const localStructuralChangeGuard = useStructuralChangeGuard({
        form,
        rootMapId: session.mapId,
        rootSystemId: session.systemId
      })
      const structuralChangeGuard = inheritedStructuralChangeGuard ?? localStructuralChangeGuard
      const ownsStructuralChangeGuard = inheritedStructuralChangeGuard === undefined
      const values = useMemo(() => {
        if (!resolvedFieldPathPrefix) return rootValues

        return toEditorValues(getAuthoringFieldValue(rootValues, resolvedFieldPathPrefix))
      }, [resolvedFieldPathPrefix, rootValues])
      const childAncestors = useMemo(
        () => (parentValues ? [parentValues, ...(ancestors ?? [])] : ancestors),
        [ancestors, parentValues]
      )
      // The layout's root renderer shares the provider's resolution; nested and standalone
      // renderers resolve their own scope.
      const ownResolution = useAuthoringResolvedModel({
        ancestors,
        mapId: resolvedMapId ?? 'pending',
        model,
        resolveModel: !updateAuthoringState && Boolean(resolvedMapId) && resolvedResolveModel,
        parentValues,
        systemId: resolvedSystemId,
        values
      })
      const {
        model: activeModel,
        error: resolutionError,
        isRetrying,
        refetch: retryResolution
      } = updateAuthoringState ? providerResolution : ownResolution
      const validationTargets = navigation.navigationTargets
      const activeTarget =
        navigationTarget ?? (updateAuthoringState ? navigation.activeNavigationTarget : undefined)
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
      // The canvas renderer shares its staged editor with the provider, so cancel waits for it.
      const groupEditor = registersStagedEditorState ? stagedEditor.groupEditor : localGroupEditor
      const setGroupEditor = registersStagedEditorState
        ? stagedEditor.setGroupEditor
        : setLocalGroupEditor
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
      }, [activeTarget, form, rendersNavigationTarget, setGroupEditor])
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
      const visibleSteps = updateAuthoringState ? navigation.visibleSteps : ownResolution.steps
      const currentStep = targetStepId
        ? visibleSteps.find((step) => step.id === targetStepId)
        : updateAuthoringState
          ? navigation.activeStep
          : visibleSteps[0]
      const renderChild = useCallback<RenderChildAuthoringSchema>(
        (options) => {
          const childModel =
            options.model ??
            getResolvedAuthoringScope(activeModel, options.mapId, options.fieldPathPrefix)

          return (
            <Renderer
              {...options}
              form={form}
              model={childModel}
              resolveModel={resolvedResolveModel && childModel === undefined}
              systemId={resolvedSystemId}
              structuralChangeGuard={structuralChangeGuard}
              updateAuthoringState={false}
            />
          )
        },
        [activeModel, form, resolvedResolveModel, resolvedSystemId, structuralChangeGuard]
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
        [expandedInlineRowIds, groupEditor, groupRemoval, setGroupEditor]
      )

      useEffect(() => {
        if (!registersStagedEditorState) return
        return () => stagedEditor.setGroupEditor(undefined)
      }, [registersStagedEditorState, stagedEditor.setGroupEditor])

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

      const resolutionAlert = resolutionError ? (
        <Alert color='red' title='Could not load authoring tools'>
          <Text size='sm'>Your current form values are still here. Retry to continue.</Text>
          <Button
            mt='sm'
            type='button'
            variant='default'
            loading={isRetrying}
            onClick={() => void retryResolution()}
          >
            Retry
          </Button>
        </Alert>
      ) : null

      if (canvasContent) {
        return (
          <>
            {resolutionAlert}
            <AuthoringValidationAlert
              target={updateAuthoringState ? activeTarget : undefined}
              validationTargets={validationTargets}
            />
            {canvasContent}
            {structuralChangeConfirmationModal}
          </>
        )
      }

      if (!resolvedMapId) return null

      if (resolutionAlert) return resolutionAlert

      if (!activeModel && resolvedResolveModel) {
        return (
          <Stack
            align='center'
            className={styles.loadingState}
            gap='xs'
            justify='center'
            role='status'
          >
            <Loader size='sm' />
            <Text c='dimmed' size='sm'>
              Loading authoring tools…
            </Text>
          </Stack>
        )
      }

      if (!activeModel) return null

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
              resolveModel={resolvedResolveModel && delegatedModel === undefined}
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
      const renderedValidationTarget = updateAuthoringState
        ? activeTarget
        : navigation.activeNavigationTarget?.kind === 'step' &&
            navigation.activeNavigationTarget.mapId === resolvedMapId &&
            navigation.activeNavigationTarget.fieldPathPrefix === resolvedFieldPathPrefix
          ? navigation.activeNavigationTarget
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
                const isAdvancedBasics =
                  resolvedMapId === session.mapId &&
                  resolvedFieldPathPrefix === undefined &&
                  session.authoredSession !== undefined &&
                  isSameAuthoringLabel(section.label, 'Basics') &&
                  section === renderedSections[0]
                const sectionNodes =
                  isAdvancedBasics && session.authoredSession?.domain === 'spell'
                    ? [...section.nodes].sort(
                        (left, right) =>
                          ['label', 'level', 'description'].indexOf(String(left.path[0] ?? '')) -
                          ['label', 'level', 'description'].indexOf(String(right.path[0] ?? ''))
                      )
                    : section.nodes

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
                    <div className={isAdvancedBasics ? styles.basicsFieldGrid : styles.fieldGrid}>
                      {sectionNodes.map((node) => {
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
                              const overviewTarget = validationTargets.find(
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
                      {isAdvancedBasics ? (
                        <div className={styles.basicsArtwork}>
                          <AuthoringArtworkControl />
                        </div>
                      ) : null}
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
