import { ActionIcon, Button, Drawer, Text } from '@mantine/core'
import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import {
  BookOpen,
  BadgeCheck,
  Grid3X3,
  Package,
  Shield,
  ListChecks,
  Sparkles,
  StickyNote,
  Swords
} from 'lucide-react'
import * as styles from './characterSheet.css'
import { CHARACTER_SHEET_MOBILE_PAGES, getCharacterSheetPageIndex } from './characterSheetTabs'
import type { CharacterSheetMobilePageId } from './CharacterSheet.types'

const swipeThreshold = 52

const mobilePageIcons = {
  overview: Shield,
  actions: Swords,
  spells: Sparkles,
  equipment: Package,
  features: BookOpen,
  notes: StickyNote,
  skills: ListChecks,
  proficiencies: BadgeCheck
} satisfies Record<CharacterSheetMobilePageId, typeof Shield>

export function CharacterSheetMobilePager({
  activePage,
  children,
  onPageChange
}: {
  activePage: CharacterSheetMobilePageId
  children: ReactNode
  onPageChange: (page: CharacterSheetMobilePageId) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const activeIndex = getCharacterSheetPageIndex(activePage)
  const activePageLabel = CHARACTER_SHEET_MOBILE_PAGES[activeIndex]?.label ?? 'Overview'
  const previousPage =
    activeIndex > 0 ? CHARACTER_SHEET_MOBILE_PAGES[activeIndex - 1]?.id : undefined
  const nextPage =
    activeIndex < CHARACTER_SHEET_MOBILE_PAGES.length - 1
      ? CHARACTER_SHEET_MOBILE_PAGES[activeIndex + 1]?.id
      : undefined

  function goToPage(page: CharacterSheetMobilePageId) {
    setMenuOpen(false)
    onPageChange(page)
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const touchStart = touchStartRef.current
    const touch = event.changedTouches[0]
    touchStartRef.current = null
    if (!touchStart || !touch) return

    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y
    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return

    if (deltaX < 0 && nextPage) goToPage(nextPage)
    if (deltaX > 0 && previousPage) goToPage(previousPage)
  }

  return (
    <section className={styles.mobilePager} aria-label='Character sheet mobile pages'>
      <Text component='h2' className={styles.mobilePageLabel} aria-live='polite'>
        {activePageLabel}
      </Text>
      <div
        className={styles.mobilePageViewport}
        key={activePage}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      <Drawer
        opened={menuOpen}
        position='bottom'
        size='auto'
        title='Sheet sections'
        onClose={() => setMenuOpen(false)}
      >
        <nav className={styles.mobilePageMenu} aria-label='Sheet sections'>
          {CHARACTER_SHEET_MOBILE_PAGES.map((page) => {
            const Icon = mobilePageIcons[page.id]
            return (
              <Button
                className={styles.mobilePageMenuItem}
                data-active={page.id === activePage ? 'true' : undefined}
                key={page.id}
                leftSection={<Icon aria-hidden='true' size={16} />}
                size='sm'
                variant={page.id === activePage ? 'filled' : 'default'}
                onClick={() => goToPage(page.id)}
              >
                {page.label}
              </Button>
            )
          })}
        </nav>
      </Drawer>

      <div className={styles.mobileFloatingDock}>
        <ActionIcon
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close sheet section menu' : 'Open sheet section menu'}
          className={styles.mobileFloatingButton}
          size='xl'
          variant='filled'
          onClick={() => setMenuOpen((current) => !current)}
        >
          <Grid3X3 aria-hidden='true' size={21} />
        </ActionIcon>
      </div>
    </section>
  )
}
