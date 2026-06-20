import { useCallback, useEffect, useMemo } from 'react'
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
  prefixRuntimePaths,
  toTypedAuthoringFieldName
} from '../utils/pathUtils'
import {
  toEditorValues,
  hasVisibleStepChanges,
  resetVisibleStepFields,
  isRenderableNode,
  getEffectiveInputType,
  getRequiredValidators
} from './FormRenderer.utils'
import * as styles from './FormRenderer.css'
import { Alert, Text } from '@mantine/core'

export type FormRendererOptions<TValues extends object> = {
  defaultValues: TValues
}

type SharedRendererProps = {
  currentStepId?: string
  debounceMs?: number
  fieldPathPrefix?: string
  mapId?: string
  model?: NodeRuntimeResolveResponseDto
  readOnly?: boolean
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
  return withForm({
    defaultValues,
    props: {} as SharedRendererProps,
    render: function Render({
      currentStepId,
      debounceMs = 150,
      fieldPathPrefix,
      form,
      mapId,
      model,
      readOnly,
      resolveModel,
      systemId,
      updateAuthoringState = true
    }) {
      const authoring = useAuthoringForm()
      const {
        updateAuthoringFormActions,
        updateAuthoringFormState
      } = authoring
      const resolvedFieldPathPrefix = fieldPathPrefix ?? authoring.fieldPathPrefix
      const resolvedMapId = mapId ?? authoring.mapId
      const resolvedReadOnly = readOnly ?? authoring.readOnly
      const resolvedResolveModel = resolveModel ?? authoring.resolveModel
      const resolvedSystemId = systemId ?? authoring.systemId
      const formValues = useStore(form.store, (state) => state.values)
      const canSubmit = useStore(form.store, (state) => state.canSubmit)
      const fieldMeta = useStore(
        form.store,
        (state) => state.fieldMeta as Partial<Record<string, FieldMetaSnapshot>>
      )
      const hasChanges = useStore(form.store, (state) => state.isDirty)
      const isSubmitting = useStore(form.store, (state) => state.isSubmitting)
      const values = useMemo(() => {
        if (!resolvedFieldPathPrefix) return toResolvedNodeValues(formValues)

        return toEditorValues(
          getAuthoringFieldValue(toResolvedNodeValues(formValues), resolvedFieldPathPrefix)
        )
      }, [formValues, resolvedFieldPathPrefix])
      const { model: activeModel } = useAuthoringResolvedModel({
        debounceMs,
        mapId: resolvedMapId ?? 'pending',
        model: model ?? (mapId ? undefined : authoring.providedModel),
        resolveModel:
          Boolean(resolvedMapId) &&
          resolvedResolveModel &&
          !model &&
          !(mapId ? false : authoring.providedModel),
        systemId: resolvedSystemId,
        values
      })
      const fallbackVisibleSteps = useMemo(
        () => (updateAuthoringState ? EMPTY_VISIBLE_STEPS : getVisibleAuthoringSteps(activeModel)),
        [activeModel, updateAuthoringState]
      )
      const visibleSteps = updateAuthoringState ? authoring.visibleSteps : fallbackVisibleSteps
      const currentStep = currentStepId
        ? visibleSteps.find((step) => step.id === currentStepId)
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
            authoring.clearPaths(prefixRuntimePaths(resolvedFieldPathPrefix, paths))
            return
          }

          clearResolvedNodeFormPaths(form, paths)
        },
        [authoring, form, resolvedFieldPathPrefix]
      )
      const statePatch = useMemo(
        () => ({
          canFinalize: canSubmit && progress.canFinalize,
          canResetForm: hasChanges && !resolvedReadOnly,
          canResetStep: currentStep != null && !resolvedReadOnly,
          canSubmit,
          fieldPathPrefix: resolvedFieldPathPrefix,
          firstBlockingStepId: progress.firstBlockingStepId,
          firstBlockingStatus: progress.firstBlockingStatus,
          hasChanges,
          hasStepChanges: currentStepHasChanges,
          isSubmitting,
          progressSummary: progress.summary,
          readOnly: resolvedReadOnly,
          resolvedModel: activeModel,
          resetFormLabel: 'Reset Form',
          resetStepLabel: 'Reset Step',
          stepDirty: progress.stepDirty,
          stepStatuses: progress.stepStatuses,
          systemId: resolvedSystemId
        }),
        [
          activeModel,
          currentStep,
          currentStepHasChanges,
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

      if (!resolvedMapId || !activeModel || !currentStep) return null

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
                    <appField.RichTextField
                      label={node.label}
                      required={node.required}
                      readOnly={readOnly}
                      className={styles.wideField}
                    />
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

      return (
        <div className={styles.sectionStack}>
          {currentStep.sections
            .filter((section) => section.nodes.some(isRenderableNode))
            .map((section) => {
              const showSectionHeader = currentStep.sections.length > 1

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
                      if (node.kind === 'GROUP') return null

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
}
