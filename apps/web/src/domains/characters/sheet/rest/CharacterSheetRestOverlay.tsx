import { CloseButton, Drawer, Popover, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect } from 'react'
import type { ReactElement, ReactNode } from 'react'
import type { CharacterRestPreviewRequestDto } from '#app/lib/api'
import * as coreStyles from '../core/sheetShell.css'
import * as sheetOverlayStyles from '../shared/sheetOverlay.css'
import * as restStyles from './rest.css'

export function CharacterSheetRestOverlay({
  children,
  onClose,
  opened,
  restKind,
  title,
  trigger
}: {
  children: ReactNode
  onClose: () => void
  opened: boolean
  restKind: CharacterRestPreviewRequestDto['restKind']
  title: string
  trigger: ReactElement
}) {
  const isMobile = useMediaQuery('(max-width: 48rem)', false)
  const titleId = `character-sheet-${restKind.toLowerCase()}-rest-title`

  useEffect(() => {
    if (!opened) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, opened])

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          classNames={{
            body: `${sheetOverlayStyles.drawerBody} ${restStyles.drawerViewport}`,
            content: sheetOverlayStyles.drawerContent,
            header: sheetOverlayStyles.drawerHeader,
            title: sheetOverlayStyles.drawerTitle
          }}
          closeButtonProps={{
            'aria-label': `Close ${title.toLowerCase()} preview`,
            className: coreStyles.sheetOverlayCloseButton
          }}
          opened={opened}
          overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
          position='bottom'
          size='min(48rem, calc(100dvh - 3.5rem))'
          title={title}
          onClose={onClose}
        >
          <div className={restStyles.drawerBody}>{children}</div>
        </Drawer>
      </>
    )
  }

  return (
    <Popover
      hideDetached={false}
      middlewares={{ size: { padding: 16 } }}
      opened={opened}
      position='bottom-end'
      trapFocus
      transitionProps={{ duration: 0 }}
      width={420}
      withinPortal
      onChange={(nextOpened) => {
        if (!nextOpened) onClose()
      }}
    >
      <Popover.Target>{trigger}</Popover.Target>
      <Popover.Dropdown aria-labelledby={titleId} className={restStyles.popover} role='dialog'>
        <div className={restStyles.header}>
          <Text className={restStyles.title} id={titleId}>
            {title}
          </Text>
          <CloseButton
            aria-label={`Close ${title.toLowerCase()} preview`}
            className={coreStyles.sheetOverlayCloseButton}
            onClick={onClose}
          />
        </div>
        {children}
      </Popover.Dropdown>
    </Popover>
  )
}
