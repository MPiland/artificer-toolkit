import { Button, Group, Stack, Text } from '@mantine/core'
import type { NodeMap } from '@artificer-toolkit/shared'
import { resolveNodeMapSections } from '@artificer-toolkit/shared'
import type { NodeRuntimePathDto, NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema'
import { NodeMapRenderer, type NodeOptionResolver, type RuntimeNodeForm } from './NodeMapRenderer'
import { SectionNavigator } from './SectionNavigator'
import { runtimeShell } from './runtimeStyles.css.ts'
import { useAuthoredFormUiState } from './useAuthoredFormUiState'

export function AuthoredFormRuntime<TValues extends object>({
  form,
  nodeMap,
  readOnly,
  lockedCopyLabel = 'Copy to edit',
  onCopy,
  optionResolver,
  runtimeModel,
  onClearPaths
}: {
  form: RuntimeNodeForm<TValues>
  nodeMap: NodeMap<TValues>
  readOnly?: boolean
  lockedCopyLabel?: string
  onCopy?: () => void
  optionResolver?: NodeOptionResolver<TValues>
  runtimeModel?: NodeRuntimeResolveResponseDto
  onClearPaths?: (paths: readonly NodeRuntimePathDto[]) => void
}) {
  const sections = resolveNodeMapSections(nodeMap)
  const firstSectionId = sections[0]?.id ?? ''
  const uiState = useAuthoredFormUiState({ initialSectionId: firstSectionId, readOnly })
  const activeSectionId = uiState.activeSectionId || firstSectionId

  return (
    <Stack gap='lg'>
      {readOnly ? (
        <Group justify='space-between'>
          <Text c='dimmed'>This master record is locked. Copy it to make your own editable version.</Text>
          <Button onClick={onCopy}>{lockedCopyLabel}</Button>
        </Group>
      ) : null}
      <div className={runtimeShell}>
        <SectionNavigator
          sections={sections}
          activeSectionId={activeSectionId}
          onSectionChange={uiState.setActiveSectionId}
        />
        <NodeMapRenderer
          form={form}
          nodeMap={nodeMap}
          activeSectionId={activeSectionId}
          readOnly={readOnly}
          optionResolver={optionResolver}
          runtimeModel={runtimeModel}
          onClearPaths={onClearPaths}
        />
      </div>
    </Stack>
  )
}
