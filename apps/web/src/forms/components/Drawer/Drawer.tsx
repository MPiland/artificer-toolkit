import { Drawer as MantineDrawer } from '@mantine/core'
import { useDrag } from '@mantine/hooks'
import { useEffect, useRef, useState } from 'react'
import type { DrawerProps } from './Drawer.types'
import * as styles from './Drawer.css'

const dismissDistance = 96
const dismissVelocity = 0.5
const dismissAnimationMs = 300

export function Drawer({ children, onClose, opened, responsiveMode, title }: DrawerProps) {
  const isMobilePortrait = responsiveMode === 'mobilePortrait'
  const [offset, setOffset] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const [drawerHeight, setDrawerHeight] = useState(0)

  useEffect(() => {
    if (opened && isMobilePortrait && drawerRef.current) {
      const boundingRect = drawerRef.current.getBoundingClientRect()
      const height = boundingRect.height
      setDrawerHeight(height)
    }
  }, [opened, isMobilePortrait, drawerRef])

  const { ref, active } = useDrag<HTMLDivElement>(
    (state) => {
      if (state.last) {
        const shouldDismiss =
          Math.max(0, state.movement[1]) > dismissDistance || state.velocity[1] > dismissVelocity
        if (shouldDismiss) {
          setDismissed(true)
          onClose()
          setDrawerHeight(0)
          setOffset(0)
          setTimeout(() => {
            setDismissed(false)
          }, dismissAnimationMs)
        } else {
          setOffset(0)
        }
      } else if (state.movement[1] > 0) {
        setOffset(state.movement[1])
      }
    },
    {
      axis: 'y',
      enabled: isMobilePortrait && opened,
      filterTaps: true,
      threshold: 6
    }
  )
  const drawerPosition = isMobilePortrait ? 'bottom' : 'right'
  const drawerSize = isMobilePortrait ? 'fit-content' : 'min(28rem, 92vw)'
  const dragStyles = isMobilePortrait
    ? {
        transform: dismissed
          ? `translateY(${offset > 0 ? drawerHeight : -1 * offset}px)`
          : `translateY(${offset}px)`,
        transition: active
          ? 'none'
          : `transform ${dismissAnimationMs}ms ease, opacity ${dismissAnimationMs}ms ease`,
        cursor: active ? 'grabbing' : 'grab',
        touchAction: 'pan-x'
      }
    : undefined

  return (
    <MantineDrawer.Root
      onClose={onClose}
      opened={opened}
      position={drawerPosition}
      ref={isMobilePortrait ? ref : undefined}
      size={drawerSize}
      withinPortal
    >
      <MantineDrawer.Overlay />
      <MantineDrawer.Content
        classNames={{ content: styles.content }}
        ref={drawerRef}
        style={dragStyles}
      >
        <MantineDrawer.Header className={styles.header}>
          <MantineDrawer.Title className={styles.title}>{title}</MantineDrawer.Title>
          <MantineDrawer.CloseButton className={styles.icon} aria-label='Close row editor' />
        </MantineDrawer.Header>
        <MantineDrawer.Body className={styles.body}>{children}</MantineDrawer.Body>
      </MantineDrawer.Content>
    </MantineDrawer.Root>
  )
}
