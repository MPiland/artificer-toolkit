import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Group, Text } from '@mantine/core'
import { useStore } from '@tanstack/react-form'
import type { NodeRuntimeNodeDto, NodeRuntimePathDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { AuthoringEditorModal } from '../editors/AuthoringEditorModal'
import { AuthoringFormSectionRow } from '../components/AuthoringFormSectionRow'
import { useAuthoringForm, useAuthoringFormRegistration } from '../components/AuthoringFormContext'
import { AuthoringFormStepNav } from '../navigation/AuthoringFormStepNav'
import { clearResolvedNodeFormPaths, toResolvedNodeValues } from '../node-map/nodeFormUtils'
import { getVisibleAuthoringSteps, useAuthoringResolvedModel } from '../hooks/useAuthoringResolvedModel'
import { requiredArray, requiredNumber, requiredSelect, requiredString, validatorsFor } from '../validation/formValidation'
import { withFieldGroup, withForm } from '../app-form/AppForm'
import {
  getAuthoringFieldValue,
  prefixRuntimePaths,
  toTypedAuthoringArrayFieldName,
  toTypedAuthoringFieldName,
  toTypedAuthoringGroupFieldName
} from '../utils/pathUtils'
import { fieldGrid, formShell, sectionStack, wideField } from '../components/formStyles.css'
import * as styles from '../layout/AuthoringFormLayout.css'

const EMPTY_CLEAR_PATHS: readonly NodeRuntimePathDto[] = []

type ActiveGroupNode = {
  node: NodeRuntimeNodeDto
  path: readonly (string | number)[]
  readOnly: boolean
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
  debounceMs?: number
  mapId: string
  readOnly?: boolean
  resolveModel?: boolean
  systemId?: string
}

type AuthoringGroupValues = Record<string, unknown>

export type CreateAuthoringFormRendererOptions<
  TValues extends object
> = {
  createArrayItem: (node: NodeRuntimeNodeDto, currentLength: number) => AuthoringGroupValues
  createObjectItem: (node: NodeRuntimeNodeDto) => AuthoringGroupValues
  defaultValues: TValues
  groupDefaultValues: AuthoringGroupValues
}

export function createAuthoringFormRenderer<TValues extends object>({
  createArrayItem,
  createObjectItem,
  defaultValues,
  groupDefaultValues
}: CreateAuthoringFormRendererOptions<TValues>) {
  const GroupRenderer = withFieldGroup({
    defaultValues: groupDefaultValues,
    props: {} as GroupRendererProps,
    render: function AuthoringGroupRenderer({
      debounceMs = 100,
      group,
      mapId,
      readOnly,
      resolveModel = true,
      systemId
    }) {
      const values = useStore(group.store, (state) => toResolvedNodeValues(state.values))
      const { model: activeModel } = useAuthoringResolvedModel({
        debounceMs,
        mapId,
        resolveModel,
        systemId,
        values
      })
      const visibleSteps = getVisibleAuthoringSteps(activeModel)
      const [internalStepId, setInternalStepId] = useState<string | undefined>()
      const [activeEditor, setActiveEditor] = useState<ActiveGroupNode | null>(null)
      const currentStep = visibleSteps.find((step) => step.id === internalStepId) ?? visibleSteps[0]
      const clearPaths = activeModel?.clearPaths ?? EMPTY_CLEAR_PATHS
      const clearPathKey = clearPaths.map((path) => path.join('.')).join('|')

      useEffect(() => {
        if (clearPaths.length === 0) return
        clearResolvedNodeFormPaths(group, clearPaths)
      }, [
        clearPathKey,
        clearPaths,
        group
      ])

      if (!activeModel || !currentStep) return null

      return (
        <div className={formShell}>
          <AuthoringFormStepNav
            activeStep={currentStep.id}
            onStepChange={setInternalStepId}
            steps={visibleSteps}
          />
          <div className={sectionStack}>
            {currentStep.sections
              .filter((section) => section.nodes.some((node) => node.visible))
              .map((section) => (
                <section key={section.id} className={styles.section} aria-labelledby={`authoring-section-${section.id}`}>
                  <div className={styles.sectionHeader}>
                    <h2 id={`authoring-section-${section.id}`} className={styles.sectionTitle}>{section.label}</h2>
                  </div>
                  <div className={fieldGrid}>
                    {section.nodes.map((node) => {
                      if (!node.visible) return null

                      const fieldName = toTypedAuthoringFieldName<AuthoringGroupValues>(undefined, node.path)
                      const nodeReadOnly = Boolean(readOnly || node.readOnly || node.disabled)

                      if (node.kind === 'GROUP') {
                        if (node.groupKind === 'ARRAY') {
                          const arrayFieldName = toTypedAuthoringArrayFieldName<AuthoringGroupValues>(undefined, node.path)

                          return (
                            <group.AppField key={node.id} name={arrayFieldName} mode='array'>
                              {(field) => {
                                const items = toRuntimeArray(field.state.value)

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
                                                field.pushValue(
                                                  createArrayItem(node, nextIndex) as Parameters<typeof field.pushValue>[0]
                                                )
                                                setActiveEditor({ node, path: [...node.path, nextIndex], readOnly: nodeReadOnly })
                                              }}
                                            >
                                              {`Add ${node.label}`}
                                            </Button>
                                          )
                                        : null}
                                    </Group>
                                    {items.length === 0
                                      ? <Text c='dimmed' size='sm'>{`No ${node.label.toLowerCase()} yet.`}</Text>
                                      : items.map((_, index) => (
                                          <AuthoringFormSectionRow
                                            key={`${node.id}-${index}`}
                                            index={index}
                                            readOnly={nodeReadOnly}
                                            title={node.label}
                                            onOpen={node.childMapId
                                              ? () => setActiveEditor({ node, path: [...node.path, index], readOnly: nodeReadOnly })
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
                                            current ?? createObjectItem(node)
                                          ) as typeof current)
                                        }
                                        setActiveEditor({ node, path: node.path, readOnly: nodeReadOnly })
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

                      const validators = node.required ? getRequiredValidators(node.type, node.label) : undefined

                      switch (node.type) {
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
                            <group.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.RichTextField
                                  label={node.label}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </group.AppField>
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
                </section>
              ))}
          </div>
          {activeEditor?.node.childMapId
            ? (
                <AuthoringEditorModal
                  opened
                  readOnly={activeEditor.readOnly}
                  title={activeEditor.node.label}
                  onClose={() => setActiveEditor(null)}
                >
                  <GroupRenderer
                    form={group}
                    fields={toTypedAuthoringGroupFieldName<AuthoringGroupValues, AuthoringGroupValues>(undefined, activeEditor.path)}
                    mapId={activeEditor.node.childMapId}
                    readOnly={activeEditor.readOnly}
                    resolveModel={resolveModel}
                    systemId={systemId}
                  />
                </AuthoringEditorModal>
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
      const [internalStepId, setInternalStepId] = useState<string | undefined>()
      const [activeEditor, setActiveEditor] = useState<ActiveGroupNode | null>(null)
      const currentStep = visibleSteps.find((step) => step.id === internalStepId) ?? visibleSteps[0]
      const currentIndex = currentStep ? visibleSteps.findIndex((step) => step.id === currentStep.id) : 0
      const isLastStep = currentIndex === visibleSteps.length - 1
      const registration = useMemo(() => ({
        activeStepId: currentStep?.id,
        activeStepLabel: currentStep?.label,
        canGoBack: currentIndex > 0,
        canGoNext: currentStep != null && !isLastStep,
        canSubmit: submitState.canSubmit,
        fieldPathPrefix: resolvedFieldPathPrefix,
        isLastStep,
        isSubmitting: submitState.isSubmitting,
        readOnly: resolvedReadOnly,
        resolvedModel: activeModel,
        systemId: resolvedSystemId
      }), [
        activeModel,
        currentIndex,
        currentStep,
        isLastStep,
        resolvedFieldPathPrefix,
        resolvedReadOnly,
        resolvedSystemId,
        submitState.canSubmit,
        submitState.isSubmitting
      ])
      const actions = useMemo(() => ({
        onClearPaths: resolvedFieldPathPrefix
          ? (paths: readonly NodeRuntimePathDto[]) => authoring.clearPaths(prefixRuntimePaths(resolvedFieldPathPrefix, paths))
          : authoring.clearPaths,
        onNextStep: () => setInternalStepId(visibleSteps[Math.min(currentIndex + 1, visibleSteps.length - 1)]?.id),
        onPreviousStep: () => setInternalStepId(visibleSteps[Math.max(currentIndex - 1, 0)]?.id)
      }), [
        authoring,
        currentIndex,
        resolvedFieldPathPrefix,
        visibleSteps
      ])

      useAuthoringFormRegistration(registration, actions, registerSession)

      if (!resolvedMapId || !activeModel || !currentStep) return null

      return (
        <div className={formShell}>
          <AuthoringFormStepNav
            activeStep={currentStep.id}
            onStepChange={setInternalStepId}
            steps={visibleSteps}
          />
          <div className={sectionStack}>
            {currentStep.sections
              .filter((section) => section.nodes.some((node) => node.visible))
              .map((section) => (
                <section key={section.id} className={styles.section} aria-labelledby={`authoring-section-${section.id}`}>
                  <div className={styles.sectionHeader}>
                    <h2 id={`authoring-section-${section.id}`} className={styles.sectionTitle}>{section.label}</h2>
                  </div>
                  <div className={fieldGrid}>
                    {section.nodes.map((node) => {
                      if (!node.visible) return null

                      const fieldName = toTypedAuthoringFieldName<TValues>(resolvedFieldPathPrefix, node.path)
                      const nodeReadOnly = Boolean(resolvedReadOnly || node.readOnly || node.disabled)

                      if (node.kind === 'GROUP') {
                        if (node.groupKind === 'ARRAY') {
                          const arrayFieldName = toTypedAuthoringArrayFieldName<TValues>(resolvedFieldPathPrefix, node.path)

                          return (
                            <form.AppField key={node.id} name={arrayFieldName} mode='array'>
                              {(field) => {
                                const items = toRuntimeArray(field.state.value)

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
                                                field.pushValue(
                                                  createArrayItem(node, nextIndex) as Parameters<typeof field.pushValue>[0]
                                                )
                                                setActiveEditor({ node, path: [...node.path, nextIndex], readOnly: nodeReadOnly })
                                              }}
                                            >
                                              {`Add ${node.label}`}
                                            </Button>
                                          )
                                        : null}
                                    </Group>
                                    {items.length === 0
                                      ? <Text c='dimmed' size='sm'>{`No ${node.label.toLowerCase()} yet.`}</Text>
                                      : items.map((_, index) => (
                                          <AuthoringFormSectionRow
                                            key={`${node.id}-${index}`}
                                            index={index}
                                            readOnly={nodeReadOnly}
                                            title={node.label}
                                            onOpen={node.childMapId
                                              ? () => setActiveEditor({ node, path: [...node.path, index], readOnly: nodeReadOnly })
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
                                          field.handleChange((current) => (current ?? createObjectItem(node)) as typeof current)
                                        }
                                        setActiveEditor({ node, path: node.path, readOnly: nodeReadOnly })
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

                      const validators = node.required ? getRequiredValidators(node.type, node.label) : undefined

                      switch (node.type) {
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
                            <form.AppField key={node.id} name={fieldName} validators={validators}>
                              {(appField) => (
                                <appField.RichTextField
                                  label={node.label}
                                  required={node.required}
                                  readOnly={nodeReadOnly}
                                />
                              )}
                            </form.AppField>
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
              ))}
          </div>
          {activeEditor?.node.childMapId
            ? (
                <AuthoringEditorModal
                  opened
                  readOnly={activeEditor.readOnly}
                  title={activeEditor.node.label}
                  onClose={() => setActiveEditor(null)}
                >
                  <GroupRenderer
                    form={form}
                    fields={toTypedAuthoringGroupFieldName<TValues, AuthoringGroupValues>(resolvedFieldPathPrefix, activeEditor.path)}
                    mapId={activeEditor.node.childMapId}
                    readOnly={activeEditor.readOnly}
                    resolveModel={resolvedResolveModel}
                    systemId={resolvedSystemId}
                  />
                </AuthoringEditorModal>
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

function toEditorValues(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function toRuntimeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
