import { Alert, Stack, Text, Title } from '@mantine/core'
import type { ComponentType, ReactNode } from 'react'
import { useEffect } from 'react'
import type { AnyFieldApi } from '@tanstack/react-form'
import { resolveNodeMapSections, type NodeEntry, type NodeMap, type SectionedNodeGroup } from '@artificer-toolkit/shared/utils'
import type { NodeRuntimeNodeDto, NodeRuntimePathDto, NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema'
import { clsx } from 'clsx'
import { fieldGrid, sectionPanel, sectionStack, wideField } from '../components/runtimeStyles.css.ts'
import { NestedCollectionShell, NestedObjectShell } from '../components/NestedEditors'
import { isConditionVisible } from './nodeVisibility'
import type { RuntimeFieldProps, RuntimeSelectFieldProps } from '../app-form/AppForm'
import { requiredArray, requiredNumber, requiredSelect, requiredString, validatorsFor } from '../validation/formValidation'
import { defaultOptionResolver, type NodeOptionResolver } from './NodeMapOptions'
import { resolveRuntimeOptions, useRuntimeNodeById } from './runtimeModelUtils'

const EMPTY_RUNTIME_PATHS: readonly NodeRuntimePathDto[] = []

type RuntimeFieldApi = AnyFieldApi & {
  TextField: ComponentType<RuntimeFieldProps>
  NumberField: ComponentType<RuntimeFieldProps>
  RichTextField: ComponentType<RuntimeFieldProps>
  SelectField: ComponentType<RuntimeSelectFieldProps>
  MultiSelectField: ComponentType<RuntimeSelectFieldProps>
}

type RuntimeFormState<TValues extends object> = {
  values: TValues
}

export type RuntimeNodeForm = {
  Subscribe: unknown
  AppField: unknown
}

type RuntimeSubscribeProps<TValues extends object> = {
  selector: (state: RuntimeFormState<TValues>) => TValues
  children: (values: TValues) => ReactNode
}

type RuntimeAppFieldProps = {
  name: string
  mode?: 'array'
  validators?: ReturnType<typeof validatorsFor>
  children: (field: RuntimeFieldApi) => ReactNode
}

export function NodeMapRenderer<TValues extends object>({
  form,
  nodeMap,
  activeSectionId,
  readOnly,
  optionResolver = defaultOptionResolver,
  runtimeModel,
  onClearPaths
}: {
  form: RuntimeNodeForm
  nodeMap: NodeMap<TValues>
  activeSectionId?: string
  readOnly?: boolean
  optionResolver?: NodeOptionResolver<TValues>
  runtimeModel?: NodeRuntimeResolveResponseDto
  onClearPaths?: (paths: readonly NodeRuntimePathDto[]) => void
}) {
  const sections = resolveNodeMapSections(nodeMap)
  const runtimeNodeById = useRuntimeNodeById(runtimeModel)
  const visibleSections = activeSectionId
    ? sections.filter((section) => section.id === activeSectionId)
    : sections

  useRuntimeClearPaths(runtimeModel, onClearPaths)

  return (
    <Stack className={sectionStack}>
      {visibleSections.map((section) => (
        <SectionPanel
          key={section.id}
          form={form}
          section={section}
          readOnly={readOnly}
          optionResolver={optionResolver}
          runtimeNodeById={runtimeNodeById}
        />
      ))}
    </Stack>
  )
}

function SectionPanel<TValues extends object>({
  form,
  section,
  readOnly,
  optionResolver,
  runtimeNodeById
}: {
  form: RuntimeNodeForm
  section: SectionedNodeGroup<TValues>
  readOnly?: boolean
  optionResolver: NodeOptionResolver<TValues>
  runtimeNodeById: ReadonlyMap<string, NodeRuntimeNodeDto>
}) {
  const Subscribe = form.Subscribe as ComponentType<RuntimeSubscribeProps<TValues>>

  return (
    <section className={sectionPanel} aria-labelledby={`section-${section.id}`}>
      <Title order={2} id={`section-${section.id}`}>{section.label}</Title>
      <Subscribe selector={(state) => state.values}>
        {(values) => (
          <div className={fieldGrid}>
            {section.nodes.map(({ id, node }) => isNodeVisible(node, values, runtimeNodeById.get(id))
              ? renderNode({ form, nodeId: id, node, values, readOnly, optionResolver, runtimeNode: runtimeNodeById.get(id) })
              : null)}
          </div>
        )}
      </Subscribe>
    </section>
  )
}

function renderNode<TValues extends object>({
  form,
  nodeId,
  node,
  values,
  readOnly,
  optionResolver,
  runtimeNode
}: {
  form: RuntimeNodeForm
  nodeId: string
  node: NodeEntry<TValues>
  values: TValues
  readOnly?: boolean
  optionResolver: NodeOptionResolver<TValues>
  runtimeNode?: NodeRuntimeNodeDto
}) {
  const AppField = form.AppField as ComponentType<RuntimeAppFieldProps>
  const name = node.path.join('.')
  const isWide = node.kind === 'GROUP' || isRichTextNode(node)
  const resolvedReadOnly = readOnly || runtimeNode?.readOnly || runtimeNode?.disabled
  const resolvedRequired = runtimeNode?.required
  const validators = resolvedRequired && node.kind === 'INPUT'
    ? getRequiredValidators(node.type, node.label)
    : undefined

  if (node.kind === 'GROUP') {
    if (node.groupKind === 'ARRAY') {
      return (
        <div key={nodeId} className={wideField}>
          <AppField name={name} mode='array'>
            {(field) => (
              <NestedCollectionShell field={field} label={node.label} readOnly={resolvedReadOnly} />
            )}
          </AppField>
        </div>
      )
    }

    return (
      <div key={nodeId} className={wideField}>
        <NestedObjectShell label={node.label} readOnly={resolvedReadOnly} />
      </div>
    )
  }

  const fieldClass = clsx(isWide && wideField)
  const nodeLabel = node.label

  switch (node.type) {
    case 'TEXT':
      return (
        <div key={nodeId} className={fieldClass}>
          <AppField name={name} validators={validators}>
            {(field) => <field.TextField label={node.label} required={resolvedRequired} readOnly={resolvedReadOnly} />}
          </AppField>
        </div>
      )
    case 'NUMBER':
      return (
        <div key={nodeId} className={fieldClass}>
          <AppField name={name} validators={validators}>
            {(field) => <field.NumberField label={node.label} required={resolvedRequired} readOnly={resolvedReadOnly} />}
          </AppField>
        </div>
      )
    case 'RICH_TEXT':
      return (
        <div key={nodeId} className={fieldClass}>
          <AppField name={name} validators={validators}>
            {(field) => <field.RichTextField label={node.label} required={resolvedRequired} readOnly={resolvedReadOnly} />}
          </AppField>
        </div>
      )
    case 'SELECT_SINGLE':
      return (
        <div key={nodeId} className={fieldClass}>
          <AppField name={name} validators={validators}>
            {(field) => (
              <field.SelectField
                label={node.label}
                required={resolvedRequired}
                readOnly={resolvedReadOnly}
                data={resolveRuntimeOptions(runtimeNode, () => optionResolver({ nodeId, node, source: node.source, values }))}
              />
            )}
          </AppField>
        </div>
      )
    case 'SELECT_MULTI':
      return (
        <div key={nodeId} className={fieldClass}>
          <AppField name={name} validators={validators}>
            {(field) => (
              <field.MultiSelectField
                label={node.label}
                required={resolvedRequired}
                readOnly={resolvedReadOnly}
                data={resolveRuntimeOptions(runtimeNode, () => optionResolver({ nodeId, node, source: node.source, values }))}
              />
            )}
          </AppField>
        </div>
      )
    default:
      return (
        <Alert key={nodeId} className={wideField} color='yellow'>
          <Text>{`Unsupported field: ${nodeLabel}`}</Text>
        </Alert>
      )
  }
}

function isRichTextNode<TValues extends object>(node: NodeEntry<TValues>): boolean {
  return node.kind === 'INPUT' && node.type === 'RICH_TEXT'
}

function getRequiredValidators(type: string | undefined, label: string) {
  if (type === 'SELECT_MULTI') return validatorsFor(requiredArray(label))
  if (type === 'SELECT_SINGLE') return validatorsFor(requiredSelect(label))
  if (type === 'NUMBER') return validatorsFor(requiredNumber(label))
  return validatorsFor(requiredString(label))
}

function isNodeVisible<TValues extends object>(
  node: NodeEntry<TValues>,
  values: TValues,
  runtimeNode?: NodeRuntimeNodeDto
): boolean {
  return runtimeNode?.visible ?? isConditionVisible(node.showIf, values)
}

function useRuntimeClearPaths(
  runtimeModel: NodeRuntimeResolveResponseDto | undefined,
  onClearPaths: ((paths: readonly NodeRuntimePathDto[]) => void) | undefined
) {
  const clearPaths = runtimeModel?.clearPaths ?? EMPTY_RUNTIME_PATHS
  const clearPathKey = clearPaths.map((path) => path.join('.')).join('|')

  useEffect(() => {
    if (!onClearPaths || clearPaths.length === 0) return
    onClearPaths(clearPaths)
  }, [clearPathKey, clearPaths, onClearPaths])
}
