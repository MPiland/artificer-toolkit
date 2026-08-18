import { ActionIcon, Button, Drawer, Text } from '@mantine/core'
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import {
  BookOpen,
  BadgeCheck,
  PawPrint,
  Grid3X3,
  Package,
  Shield,
  ListChecks,
  Sparkles,
  StickyNote,
  Swords
} from 'lucide-react'
import type { CharacterSheetMobilePageId } from '../core/CharacterSheet.types'
import { CHARACTER_SHEET_MOBILE_PAGES } from '../core/characterSheetTabs'
import * as mobileStyles from './mobile.css'

const mobilePageIcons = {
  overview: Shield,
  actions: Swords,
  spells: Sparkles,
  extras: PawPrint,
  equipment: Package,
  features: BookOpen,
  notes: StickyNote,
  skills: ListChecks,
  proficiencies: BadgeCheck
} satisfies Record<CharacterSheetMobilePageId, typeof Shield>

export function CharacterSheetMobilePager({
  activePage,
  children,
  manualRollAction,
  pages = CHARACTER_SHEET_MOBILE_PAGES,
  onPageChange
}: {
  activePage: CharacterSheetMobilePageId
  children: ReactNode
  manualRollAction: ReactNode
  pages?: typeof CHARACTER_SHEET_MOBILE_PAGES
  onPageChange: (page: CharacterSheetMobilePageId) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const touchOriginRef = useRef<{ x: number; y: number } | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pageIndex = pages.findIndex((page) => page.id === activePage)
  const activeIndex = pageIndex >= 0 ? pageIndex : 0
  const activePageLabel = pages[activeIndex]?.label ?? 'Overview'

  useEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0
  }, [activePage])

  function goToPage(page: CharacterSheetMobilePageId) {
    setMenuOpen(false)
    onPageChange(page)
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    touchOriginRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const origin = touchOriginRef.current
    const touch = event.changedTouches[0]
    touchOriginRef.current = null
    if (!origin || !touch) return

    const deltaX = touch.clientX - origin.x
    const deltaY = touch.clientY - origin.y
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) return

    const nextIndex = deltaX < 0 ? activeIndex + 1 : activeIndex - 1
    const nextPage = pages[nextIndex]
    if (nextPage) goToPage(nextPage.id)
  }

  return (
    <section className={mobileStyles.mobilePager} aria-label='Character sheet mobile pages'>
      <Text component='h2' className={mobileStyles.mobilePageLabel} aria-live='polite'>
        {activePageLabel}
      </Text>
      <div
        className={mobileStyles.mobilePageViewport}
        ref={viewportRef}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
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
        <nav className={mobileStyles.mobilePageMenu} aria-label='Sheet sections'>
          {pages.map((page) => {
            const Icon = mobilePageIcons[page.id]
            return (
              <Button
                className={mobileStyles.mobilePageMenuItem}
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

      <div className={mobileStyles.mobileFloatingDock}>
        {manualRollAction}
        <ActionIcon
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close sheet section menu' : 'Open sheet section menu'}
          className={mobileStyles.mobileFloatingButton}
          data-section-navigation='true'
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
