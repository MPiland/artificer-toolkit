import { Alert, Stack, Text, Title } from '@mantine/core'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import type { AnyFieldApi } from '@tanstack/react-form'
import type { NodeEntry, NodeMap, NodeSelectSource, SectionedNodeGroup } from '@artificer-toolkit/shared'
import { resolveNodeMapSections } from '@artificer-toolkit/shared'
import type { NodeRuntimeNodeDto, NodeRuntimePathDto, NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema'
import { clsx } from 'clsx'
import { fieldGrid, sectionPanel, sectionStack, wideField } from './runtimeStyles.css.ts'
import { NestedCollectionShell, NestedObjectShell } from './NestedEditors'
import { isConditionVisible } from './nodeVisibility'
import type { RuntimeFieldProps, RuntimeSelectFieldProps } from './AppForm'
import type { SelectOption } from './formUtils'

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

export type RuntimeNodeForm<TValues extends object> = {
  Subscribe: ComponentType<{
    selector: (state: RuntimeFormState<TValues>) => TValues
    children: (values: TValues) => ReactNode
  }>
  AppField: ComponentType<{
    name: string
    mode?: 'array'
    children: (field: RuntimeFieldApi) => ReactNode
  }>
}

export type NodeOptionResolver<TValues extends object = object> = (args: {
  nodeId: string
  node: NodeEntry<TValues>
  source: NodeSelectSource
  values?: TValues
}) => SelectOption[]

export function NodeMapRenderer<TValues extends object>({
  form,
  nodeMap,
  activeSectionId,
  readOnly,
  optionResolver = defaultOptionResolver,
  runtimeModel,
  onClearPaths
}: {
  form: RuntimeNodeForm<TValues>
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
  form: RuntimeNodeForm<TValues>
  section: SectionedNodeGroup<TValues>
  readOnly?: boolean
  optionResolver: NodeOptionResolver<TValues>
  runtimeNodeById: ReadonlyMap<string, NodeRuntimeNodeDto>
}) {
  return (
    <section className={sectionPanel} aria-labelledby={`section-${section.id}`}>
      <Title order={2} id={`section-${section.id}`}>{section.label}</Title>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <div className={fieldGrid}>
            {section.nodes.map(({ id, node }) => isNodeVisible(node, values, runtimeNodeById.get(id))
              ? renderNode({ form, nodeId: id, node, values, readOnly, optionResolver, runtimeNode: runtimeNodeById.get(id) })
              : null)}
          </div>
        )}
      </form.Subscribe>
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
  form: RuntimeNodeForm<TValues>
  nodeId: string
  node: NodeEntry<TValues>
  values: TValues
  readOnly?: boolean
  optionResolver: NodeOptionResolver<TValues>
  runtimeNode?: NodeRuntimeNodeDto
}) {
  const name = node.path.join('.')
  const isWide = node.kind === 'GROUP' || node.type === 'RICH_TEXT'
  const resolvedReadOnly = readOnly || runtimeNode?.readOnly || runtimeNode?.disabled
  const resolvedRequired = runtimeNode?.required

  if (node.kind === 'GROUP') {
    if (node.groupKind === 'ARRAY') {
      return (
        <div key={nodeId} className={wideField}>
          <form.AppField name={name} mode='array'>
            {(field) => (
              <NestedCollectionShell field={field} label={node.label} readOnly={resolvedReadOnly} />
            )}
          </form.AppField>
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
          <form.AppField name={name}>
            {(field) => <field.TextField label={node.label} required={resolvedRequired} readOnly={resolvedReadOnly} />}
          </form.AppField>
        </div>
      )
    case 'NUMBER':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field) => <field.NumberField label={node.label} required={resolvedRequired} readOnly={resolvedReadOnly} />}
          </form.AppField>
        </div>
      )
    case 'RICH_TEXT':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field) => <field.RichTextField label={node.label} required={resolvedRequired} readOnly={resolvedReadOnly} />}
          </form.AppField>
        </div>
      )
    case 'SELECT_SINGLE':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field) => (
              <field.SelectField
                label={node.label}
                required={resolvedRequired}
                readOnly={resolvedReadOnly}
                data={resolveRuntimeOptions(runtimeNode, () => optionResolver({ nodeId, node, source: node.source, values }))}
              />
            )}
          </form.AppField>
        </div>
      )
    case 'SELECT_MULTI':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field) => (
              <field.MultiSelectField
                label={node.label}
                required={resolvedRequired}
                readOnly={resolvedReadOnly}
                data={resolveRuntimeOptions(runtimeNode, () => optionResolver({ nodeId, node, source: node.source, values }))}
              />
            )}
          </form.AppField>
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

function isNodeVisible<TValues extends object>(
  node: NodeEntry<TValues>,
  values: TValues,
  runtimeNode?: NodeRuntimeNodeDto
): boolean {
  return runtimeNode?.visible ?? isConditionVisible(node.showIf, values)
}

function resolveRuntimeOptions(
  runtimeNode: NodeRuntimeNodeDto | undefined,
  fallback: () => SelectOption[]
): SelectOption[] {
  if (runtimeNode?.options) return runtimeNode.options
  return fallback()
}

function useRuntimeNodeById(runtimeModel: NodeRuntimeResolveResponseDto | undefined) {
  return useMemo(() => {
    const nodes = runtimeModel?.sections.flatMap((section) => section.nodes) ?? []
    return new Map(nodes.map((node) => [node.id, node]))
  }, [runtimeModel])
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

export function defaultOptionResolver<TValues extends object>({
  source,
  values
}: Parameters<NodeOptionResolver<TValues>>[0]): SelectOption[] {
  if (source.kind === 'INLINE' && 'options' in source) {
    return source.options.map((option) => ({
      value: String(option.code),
      label: option.label
    }))
  }

  if (source.kind === 'INLINE' && 'optionGroups' in source) {
    return source.optionGroups
      .filter((group) => values === undefined || isConditionVisible(group.showIf, values))
      .flatMap((group) => group.options.map((option) => ({
        value: String(option.code),
        label: option.label
      })))
  }

  if (source.kind === 'DATA') {
    return [{
      value: '__runtime_options_unresolved__',
      label: 'Runtime options unavailable',
      disabled: true
    }]
  }

  return []
}
