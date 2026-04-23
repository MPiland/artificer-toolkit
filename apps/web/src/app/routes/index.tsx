import { Badge, Button, Card, Group, List, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  IconBolt,
  IconClipboardCheck,
  IconLayoutDashboard,
  IconSparkles
} from '@tabler/icons-react'
import { PublicShellFrame } from '#app/shell'

const platformHighlights = [
  'SSR-first shell routing for the new TanStack Start app slice.',
  'Shared providers for Mantine, Query, notifications, Storybook, and tests.',
  'Review gates wired for Vitest, Playwright, and Storybook before feature tranches.'
]

export const Route = createFileRoute('/')({
  component: MarketingPage
})

function MarketingPage() {
  return (
    <PublicShellFrame
      eyebrow='Phase 9.1 live'
      title='The frontend rebuild now has a dedicated platform slice.'
      description='We are rebuilding the public and authenticated experience on top of the backend-first architecture, starting with the shells, provider graph, and review tooling.'
      highlights={platformHighlights}
      actions={
        <Group>
          <Button component={Link} to='/login' variant='default'>
            Sign in
          </Button>
          <Button component={Link} to='/signup'>
            Start account
          </Button>
        </Group>
      }
    >
      <Stack gap='lg'>
        <Group justify='space-between'>
          <Text fw={700}>What this tranche delivers</Text>
          <Badge variant='light'>Platform</Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing='md'>
          {[
            {
              icon: IconLayoutDashboard,
              title: 'New route graph',
              copy: 'A clean Phase 9 app tree replaces the provisional route surface as the active build target.'
            },
            {
              icon: IconClipboardCheck,
              title: 'Review harness',
              copy: 'Storybook, Playwright, and Vitest now gate the next component and shell tranches.'
            },
            {
              icon: IconSparkles,
              title: 'Shared theme layer',
              copy: 'Mantine, vanilla-extract, and your CSS layer override strategy stay intact.'
            },
            {
              icon: IconBolt,
              title: 'Lighter frontend',
              copy: 'The new app shell is intentionally thinner and avoids pulling legacy form/runtime code into the active build.'
            }
          ].map((item) => (
            <Card key={item.title} withBorder radius='lg' padding='lg'>
              <ThemeIcon radius='xl' size='lg' variant='light'>
                <item.icon size={18} />
              </ThemeIcon>
              <Text fw={700} mt='md'>
                {item.title}
              </Text>
              <Text size='sm' c='dimmed' mt='xs'>
                {item.copy}
              </Text>
            </Card>
          ))}
        </SimpleGrid>

        <List spacing='xs' size='sm'>
          <List.Item>Next review gate: verify the shell stories and app smoke tests.</List.Item>
          <List.Item>Next tranche: public/auth visuals and the logged-out marketing experience.</List.Item>
          <List.Item>Legacy feature routes remain on disk, but they are no longer the active build slice.</List.Item>
        </List>
      </Stack>
    </PublicShellFrame>
  )
}
