import { Rail, useBreakpoints } from '#ui'
import * as styles from './Previews.css'
import { useAuthoringPanels, useAuthoringPreview } from '../AuthoringLayoutContext'
import { CloseButton, Drawer } from '@mantine/core'

function PreviewContent({ showCloseButton = false }: { showCloseButton?: boolean }) {
  const { togglePreview } = useAuthoringPanels()
  const { previewContent } = useAuthoringPreview()

  return (
    <Rail id='authoring-preview' aria-label='Authoring preview' className={styles.shell}>
      <Rail.Header className={styles.header}>
        {showCloseButton ? (
          <CloseButton
            aria-label='Close preview'
            onClick={() => togglePreview()}
            className={styles.closeButton}
          />
        ) : null}
        Live output
      </Rail.Header>
      <Rail.Content className={styles.content}>
        <div className={styles.previewFrame}>{previewContent}</div>
      </Rail.Content>
    </Rail>
  )
}

export function Previews() {
  const { isWideDesktop, previewOpen, togglePreview } = useAuthoringPanels()
  const { previewContent } = useAuthoringPreview()
  const { isMobile } = useBreakpoints()

  if (!previewContent) return null

  return !isWideDesktop ? (
    <Drawer
      opened={previewOpen}
      onClose={togglePreview}
      position={isMobile ? 'bottom' : 'right'}
      size={isMobile ? 'min(80dvh, 42rem)' : '18rem'}
      withCloseButton={false}
      classNames={{
        body: styles.drawerBody,
        header: styles.drawerAccessibleHeader
      }}
      title='Authoring preview'
    >
      <PreviewContent showCloseButton />
    </Drawer>
  ) : (
    <PreviewContent />
  )
}
