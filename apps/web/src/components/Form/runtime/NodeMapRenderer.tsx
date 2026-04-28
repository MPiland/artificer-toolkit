import { Alert, Stack, Text, Title } from '@mantine/core'
import type { NodeEntry, NodeMap, NodeSelectSource, SectionedNodeGroup } from '@artificer-toolkit/shared'
import { resolveNodeMapSections } from '@artificer-toolkit/shared'
import { clsx } from 'clsx'
import { fieldGrid, sectionPanel, sectionStack, wideField } from './runtimeStyles.css.ts'
import { NestedCollectionShell, NestedObjectShell } from './NestedEditors'
import { isConditionVisible } from './nodeVisibility'
import type { SelectOption } from './formUtils'

export type NodeOptionResolver = (args: {
  nodeId: string
  node: NodeEntry<object>
  source: NodeSelectSource
}) => SelectOption[]

export function NodeMapRenderer<TValues extends object>({
  form,
  nodeMap,
  activeSectionId,
  readOnly,
  optionResolver = defaultOptionResolver
}: {
  form: any
  nodeMap: NodeMap<TValues>
  activeSectionId?: string
  readOnly?: boolean
  optionResolver?: NodeOptionResolver
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

function SectionPanel({
  form,
  section,
  readOnly,
  optionResolver
}: {
  form: any
  section: SectionedNodeGroup
  readOnly?: boolean
  optionResolver: NodeOptionResolver
}) {
  return (
    <section className={sectionPanel} aria-labelledby={`section-${section.id}`}>
      <Title order={2} id={`section-${section.id}`}>{section.label}</Title>
      <form.Subscribe selector={(state: any) => state.values}>
        {(values: unknown) => (
          <div className={fieldGrid}>
            {section.nodes.map(({ id, node }) => isConditionVisible(node.showIf, values)
              ? renderNode({ form, nodeId: id, node, readOnly, optionResolver })
              : null)}
          </div>
        )}
      </form.Subscribe>
    </section>
  )
}

function renderNode({
  form,
  nodeId,
  node,
  readOnly,
  optionResolver
}: {
  form: any
  nodeId: string
  node: NodeEntry<object>
  readOnly?: boolean
  optionResolver: NodeOptionResolver
}) {
  const name = node.path.join('.')
  const isWide = node.kind === 'GROUP' || node.type === 'RICH_TEXT'

  if (node.kind === 'GROUP') {
    if (node.groupKind === 'ARRAY') {
      return (
        <div key={nodeId} className={wideField}>
          <form.AppField name={name} mode='array'>
            {(field: any) => (
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

  switch (node.type) {
    case 'TEXT':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field: any) => <field.TextField label={node.label} readOnly={readOnly} />}
          </form.AppField>
        </div>
      )
    case 'NUMBER':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field: any) => <field.NumberField label={node.label} readOnly={readOnly} />}
          </form.AppField>
        </div>
      )
    case 'RICH_TEXT':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field: any) => <field.RichTextField label={node.label} readOnly={readOnly} />}
          </form.AppField>
        </div>
      )
    case 'SELECT_SINGLE':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field: any) => (
              <field.SelectField
                label={node.label}
                readOnly={readOnly}
                data={optionResolver({ nodeId, node, source: node.source })}
              />
            )}
          </form.AppField>
        </div>
      )
    case 'SELECT_MULTI':
      return (
        <div key={nodeId} className={fieldClass}>
          <form.AppField name={name}>
            {(field: any) => (
              <field.MultiSelectField
                label={node.label}
                readOnly={readOnly}
                data={optionResolver({ nodeId, node, source: node.source })}
              />
            )}
          </form.AppField>
        </div>
      )
    default:
      return (
        <Alert key={nodeId} className={wideField} color='yellow'>
          <Text>{`Unsupported field: ${node.label}`}</Text>
        </Alert>
      )
  }
}

function defaultOptionResolver({ source }: Parameters<NodeOptionResolver>[0]): SelectOption[] {
  if (source.kind === 'INLINE' && 'options' in source) {
    return source.options.map((option) => ({
      value: String(option.code),
      label: option.label
    }))
  }

  return []
}
