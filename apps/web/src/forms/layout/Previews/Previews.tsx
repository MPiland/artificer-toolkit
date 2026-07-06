import { Rail, useBreakpoints } from '#ui'
import * as styles from './Previews.css'
import { useAuthoringLayout } from '../AuthoringLayoutContext'
import { Collapse, Drawer, CloseButton } from '@mantine/core'

function PreviewContent() {
  const { previewContent, previewOpen, togglePreview } = useAuthoringLayout()

  return (
    <Rail
      aria-hidden={!previewOpen}
      id='authoring-preview'
      aria-label='Authoring preview'
      className={styles.shell}
    >
      <Rail.Header className={styles.header}>
        <CloseButton onClick={() => togglePreview()} className={styles.closeButton} />
        Preview
      </Rail.Header>
      <Rail.Content className={styles.content}>{previewContent}</Rail.Content>
    </Rail>
  )
}

export function Previews() {
  const { previewContent, previewOpen, togglePreview } = useAuthoringLayout()
  const { isMobile, isTablet } = useBreakpoints()

  if (!previewContent) return null

  return isTablet || isMobile ? (
    <Drawer
      opened={previewOpen}
      onClose={togglePreview}
      position={isMobile ? 'bottom' : 'right'}
      size={isMobile ? '80%' : '20rem'}
      withCloseButton={false}
      classNames={{
        body: styles.drawerBody
      }}
    >
      <PreviewContent />
    </Drawer>
  ) : (
    <Collapse
      expanded={previewOpen}
      orientation='horizontal'
      transitionDuration={180}
      transitionTimingFunction='ease'
      aria-label='Preview details'
    >
      <PreviewContent />
    </Collapse>
  )
}
