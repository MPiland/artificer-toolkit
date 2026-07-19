import { Rail, useBreakpoints } from '#ui'
import * as styles from './Previews.css'
import { useAuthoringLayout } from '../AuthoringLayoutContext'
import { CloseButton, Collapse, Drawer } from '@mantine/core'

function PreviewContent({ showCloseButton = false }: { showCloseButton?: boolean }) {
  const { previewContent, previewOpen, togglePreview } = useAuthoringLayout()

  return (
    <Rail
      aria-hidden={!previewOpen}
      id='authoring-preview'
      aria-label='Authoring preview'
      className={styles.shell}
    >
      <Rail.Header className={styles.header}>
        {showCloseButton ? (
          <CloseButton
            aria-label='Close preview'
            onClick={() => togglePreview()}
            className={styles.closeButton}
          />
        ) : null}
        Preview
      </Rail.Header>
      <Rail.Content className={styles.content}>{previewContent}</Rail.Content>
    </Rail>
  )
}

export function Previews() {
  const { previewContent, previewOpen, togglePreview } = useAuthoringLayout()
  const { isMobile, isTabletPortrait } = useBreakpoints()
  const usesOverlayPreview = isMobile || isTabletPortrait

  if (!previewContent) return null

  return usesOverlayPreview ? (
    <Drawer
      opened={previewOpen}
      onClose={togglePreview}
      position={isMobile ? 'bottom' : 'right'}
      size={isMobile ? 'min(80dvh, 42rem)' : '18rem'}
      withCloseButton={false}
      classNames={{
        body: styles.drawerBody
      }}
    >
      <PreviewContent showCloseButton />
    </Drawer>
  ) : (
    <Collapse
      expanded={previewOpen}
      orientation='horizontal'
      transitionDuration={180}
      transitionTimingFunction='ease'
    >
      <PreviewContent />
    </Collapse>
  )
}
