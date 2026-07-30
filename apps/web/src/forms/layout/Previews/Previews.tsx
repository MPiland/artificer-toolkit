import { Rail, useBreakpoints } from '#ui'
import * as styles from './Previews.css'
import { useAuthoringLayout } from '../AuthoringLayoutContext'
import { CloseButton, Drawer } from '@mantine/core'
import { Info } from 'lucide-react'

function PreviewContent({ showCloseButton = false }: { showCloseButton?: boolean }) {
  const { previewContent, status, togglePreview } = useAuthoringLayout()

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
        <div className={styles.previewNotice}>
          <Info aria-hidden='true' className={styles.previewNoticeIcon} size={18} />
          <span className={styles.previewNoticeCopy}>
            <span>{`This preview reflects your current ${status.label.toLowerCase()}.`}</span>
            <span>Values and formatting may change.</span>
          </span>
        </div>
      </Rail.Content>
    </Rail>
  )
}

export function Previews() {
  const { isWideDesktop, previewContent, previewOpen, togglePreview } = useAuthoringLayout()
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
