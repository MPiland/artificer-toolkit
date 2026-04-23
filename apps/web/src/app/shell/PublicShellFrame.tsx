import { Badge, Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import {
  brandLockup,
  brandMark,
  brandRow,
  heroPanel,
  publicFrame,
  shellGrid,
  shellRoot,
  summaryItem,
  summaryList,
  surfaceCard
} from './shell.css'

export interface PublicShellFrameProps {
  eyebrow: string
  title: string
  description: string
  highlights: string[]
  actions?: ReactNode
  children: ReactNode
}

export function PublicShellFrame({
  eyebrow,
  title,
  description,
  highlights,
  actions,
  children
}: PublicShellFrameProps) {
  return (
    <div className={shellRoot} data-testid='public-shell'>
      <div className={publicFrame}>
        <div className={brandRow}>
          <div className={brandLockup}>
            <span className={brandMark}>Artificer Toolkit</span>
            <Text size='sm' c='dimmed'>
              Phase 9 frontend platform foundation
            </Text>
          </div>

          {actions}
        </div>

        <div className={shellGrid}>
          <section className={heroPanel}>
            <Stack gap='lg'>
              <Badge variant='light' radius='xl'>
                {eyebrow}
              </Badge>
              <div>
                <Title order={1}>{title}</Title>
                <Text mt='md' size='lg' c='dimmed'>
                  {description}
                </Text>
              </div>

              <ul className={summaryList}>
                {highlights.map((item) => (
                  <li key={item} className={summaryItem}>
                    <Text fw={600}>{item}</Text>
                  </li>
                ))}
              </ul>
            </Stack>
          </section>

          <section className={surfaceCard}>
            <Group justify='space-between' mb='lg'>
              <Text fw={700}>Current surface</Text>
              <Badge variant='dot'>SSR ready</Badge>
            </Group>
            {children}
          </section>
        </div>
      </div>
    </div>
  )
}
