import { Badge, Group, Stack, Text, Title } from '@mantine/core'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { AppShellNavItem } from './navigation'
import {
  appFrame,
  appGrid,
  brandLockup,
  brandMark,
  brandRow,
  contentColumn,
  navItem,
  navItemActive,
  navList,
  shellRoot,
  sidebar,
  surfaceCard
} from '#app/shell/shell.css'

export interface AppShellFrameProps {
  title: string
  description: string
  navigation: AppShellNavItem[]
  headerActions?: ReactNode
  sidebarFooter?: ReactNode
  children: ReactNode
}

export function AppShellFrame({
  title,
  description,
  navigation,
  headerActions,
  sidebarFooter,
  children
}: AppShellFrameProps) {
  return (
    <div className={shellRoot} data-testid='app-shell'>
      <div className={appFrame}>
        <div className={brandRow}>
          <div className={brandLockup}>
            <span className={brandMark}>Authed Workspace</span>
            <Text size='sm' c='dimmed'>
              Phase 9 shell and runtime foundation
            </Text>
          </div>

          {headerActions}
        </div>

        <div className={appGrid}>
          <aside className={sidebar}>
            <section className={surfaceCard}>
              <Stack gap='md'>
                <Text fw={700}>Navigation</Text>

                <div className={navList}>
                  {navigation.map((item) => (
                    <div
                      key={item.label}
                      className={clsx(navItem, item.active && navItemActive)}
                    >
                      <Group justify='space-between' align='start'>
                        <Text fw={600}>{item.label}</Text>
                        {item.active ? <Badge size='sm'>Live</Badge> : null}
                      </Group>
                      <Text size='sm' c='dimmed'>
                        {item.note}
                      </Text>
                    </div>
                  ))}
                </div>
              </Stack>
            </section>

            {sidebarFooter ? <section className={surfaceCard}>{sidebarFooter}</section> : null}
          </aside>

          <main className={contentColumn}>
            <section className={surfaceCard}>
              <Stack gap='sm'>
                <Badge variant='light' radius='xl'>
                  Workspace
                </Badge>
                <Title order={1}>{title}</Title>
                <Text size='lg' c='dimmed'>
                  {description}
                </Text>
              </Stack>
            </section>

            <section className={surfaceCard}>{children}</section>
          </main>
        </div>
      </div>
    </div>
  )
}
