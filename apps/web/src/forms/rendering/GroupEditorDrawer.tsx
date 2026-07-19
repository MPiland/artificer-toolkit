import { Button, Drawer, VisuallyHidden } from '@mantine/core'
import type { NodeRuntimeArrayGroupNodeDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import type { AuthoringNavigationTarget } from '../layout/authoringNavigation'
import { useBreakpoints } from '#ui'
import { AuthoringValidationAlert } from './AuthoringValidationAlert'
import { useAuthoringRendererScope, type GroupEditorTransaction } from './FormRenderer.context'
import * as styles from './FormRenderer.css'

type GroupEditorDrawerProps = {
  editor: GroupEditorTransaction
  fieldPath: string
  node: NodeRuntimeArrayGroupNodeDto
  onClose: (restore: boolean) => void
  validationTarget?: AuthoringNavigationTarget
  validationTargets: readonly AuthoringNavigationTarget[]
}

export function GroupEditorDrawer({
  editor,
  fieldPath,
  node,
  onClose,
  validationTarget,
  validationTargets
}: GroupEditorDrawerProps) {
  const { isMobile } = useBreakpoints()
  const { childAncestors, readOnly, renderChild, values } = useAuthoringRendererScope()

  const itemLabel = editor.label.replace(/^(Add|Edit)\s+/i, '')
  const editorTitle = `${editor.mode === 'add' ? 'Add' : 'Edit'} ${toSingularLabel(node.label).toLowerCase()}`

  return (
    <Drawer
      classNames={{
        body: styles.groupEditorBody,
        close: styles.groupEditorClose,
        content: styles.groupEditorSurface,
        header: styles.groupEditorHeader,
        inner: styles.groupEditorInner,
        overlay: styles.groupEditorOverlay,
        root: styles.groupEditorRoot,
        title: styles.groupEditorTitle
      }}
      opened
      overlayProps={{ backgroundOpacity: 0.25 }}
      portalProps={{ target: '#authoring-workspace' }}
      onClose={() => onClose(true)}
      position={isMobile ? 'bottom' : 'right'}
      size={isMobile ? 'min(88dvh, 46rem)' : 'min(29.25rem, 92vw)'}
      title={
        <span className={styles.groupEditorTitleStack}>
          <span aria-hidden='true'>{editorTitle}</span>
          <span aria-hidden='true' className={styles.groupEditorSubtitle}>
            {itemLabel}
          </span>
          <VisuallyHidden>{editor.label}</VisuallyHidden>
        </span>
      }
    >
      <div className={styles.groupEditorContent}>
        <AuthoringValidationAlert target={validationTarget} validationTargets={validationTargets} />
        {renderChild({
          ancestors: [values, ...(childAncestors ?? [])],
          fieldPathPrefix: fieldPath,
          mapId: node.childMapId,
          parentValues: values,
          readOnly,
          renderAllSteps: true
        })}
        <div className={styles.groupEditorActions}>
          <Button variant='default' type='button' onClick={() => onClose(true)}>
            Cancel
          </Button>
          <Button type='button' onClick={() => onClose(false)}>
            {editor.mode === 'add' ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}

function toSingularLabel(label: string) {
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`
  if (label.endsWith('ses')) return label.slice(0, -2)
  return label.endsWith('s') ? label.slice(0, -1) : label
}
