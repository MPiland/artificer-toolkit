import { Alert, Stack, Text, Title } from '@mantine/core'
import type { ComponentType, ReactNode } from 'react'
import type { AnyFieldApi } from '@tanstack/react-form'
import type { NodeEntry, NodeMap, NodeSelectSource, SectionedNodeGroup } from '@artificer-toolkit/shared'
import { resolveNodeMapSections } from '@artificer-toolkit/shared'
import { clsx } from 'clsx'
import { fieldGrid, sectionPanel, sectionStack, wideField } from './runtimeStyles.css.ts'
import { NestedCollectionShell, NestedObjectShell } from './NestedEditors'
import { isConditionVisible } from './nodeVisibility'
import type { RuntimeFieldProps, RuntimeSelectFieldProps } from './AppForm'
import type { SelectOption } from './formUtils'

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
  optionResolver = defaultOptionResolver
}: {
  form: RuntimeNodeForm<TValues>
  nodeMap: NodeMap<TValues>
  activeSectionId?: string
  readOnly?: boolean
  optionResolver?: NodeOptionResolver<TValues>
}) {
  const sections = resolveNodeMapSections(nodeMap)
  const visibleSections = activeSectionId
    ? sections.filter((section) => section.id === activeSectionId)
    : sections

  return (
    <Stack className={sectionStack}>
      {visibleSections.map((section) => (
        <SectionPanel
          key={section.id}
          form={form}
          section={section}
          readOnly={readOnly}
          optionResolver={optionResolver}
        />
      ))}
    </Stack>
  )
}

function SectionPanel<TValues extends object>({
  form,
  section,
  readOnly,
  optionResolver
}: {
  form: RuntimeNodeForm<TValues>
  section: SectionedNodeGroup<TValues>
  readOnly?: boolean
  optionResolver: NodeOptionResolver<TValues>
}) {
  return (
    <section className={sectionPanel} aria-labelledby={`section-${section.id}`}>
      <Title order={2} id={`section-${section.id}`}>{section.label}</Title>
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <div className={fieldGrid}>
            {section.nodes.map(({ id, node }) => isConditionVisible(node.showIf, values)
              ? renderNode({ form, nodeId: id, node, values, readOnly, optionResolver })
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
  optionResolver
}: {
  form: RuntimeNodeForm<TValues>
  nodeId: string
  node: NodeEntry<TValues>
  values: TValues
  readOnly?: boolean
  optionResolver: NodeOptionResolver<TValues>
}) {
  const name = node.path.join('.')
  const isWide = node.kind === 'GROUP' || node.type === 'RICH_TEXT'

  if (node.kind === 'GROUP') {
    if (node.groupKind === 'ARRAY') {
      return (
        <div key={nodeId} className={wideField}>
          <form.AppField name={name} mode='array'>
            {(field) => (
              <NestedCollectionShell field={field} label={node.label} readOnly={readOnly} />
            )}
          </form.AppField>
        </div>
      )
    }

    return (
      <div key={nodeId} className={wideField}>
        <NestedObjectShell label={node.label} readOnly={readOnly} />
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
            {(field) => <field.TextField label={node.label} readOnly={readOnly} />}
          </form.AppField>
        </div>
      )
    case 'NUMBER':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field) => <field.NumberField label={node.label} readOnly={readOnly} />}
          </form.AppField>
        </div>
      )
    case 'RICH_TEXT':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field) => <field.RichTextField label={node.label} readOnly={readOnly} />}
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
                readOnly={readOnly}
                data={optionResolver({ nodeId, node, source: node.source, values })}
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
                readOnly={readOnly}
                data={optionResolver({ nodeId, node, source: node.source, values })}
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

  return []
}
