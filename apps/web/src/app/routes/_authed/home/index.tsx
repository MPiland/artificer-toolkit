import { Card, Group, List, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/home/')({
  component: HomePage
})

function HomePage() {
  return (
    <Stack gap='lg'>
      <div>
        <Title order={2}>Phase 9.1 checkpoint</Title>
        <Text mt='sm' c='dimmed'>
          The authenticated shell is now isolated from the provisional route graph so we can review the
          shared foundation, test harness, and SSR behavior before rebuilding list surfaces and authored
          forms.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='md'>
        <Card withBorder radius='lg' padding='lg'>
          <Text fw={700}>What is live</Text>
          <List mt='md' spacing='xs' size='sm'>
            <List.Item>New Start route tree dedicated to the rebuild.</List.Item>
            <List.Item>Shared Mantine and Query providers for app, tests, and Storybook.</List.Item>
            <List.Item>Playwright and Storybook review gates for the next tranche.</List.Item>
          </List>
        </Card>

        <Card withBorder radius='lg' padding='lg'>
          <Text fw={700}>Next tranche</Text>
          <List mt='md' spacing='xs' size='sm'>
            <List.Item>Marketing page polish from the locked Figma file.</List.Item>
            <List.Item>Logged-out shell and auth surface refinement.</List.Item>
            <List.Item>Canonical authenticated navigation and list-view pattern.</List.Item>
          </List>
        </Card>
      </SimpleGrid>

      <Card withBorder radius='lg' padding='lg'>
        <Group justify='space-between' align='start'>
          <div>
            <Text fw={700}>Review guidance</Text>
            <Text size='sm' c='dimmed' mt='xs'>
              Validate the storybook shell stories first, then the app smoke route. Once that looks solid,
              we can move into the public/auth visual pass without dragging the old domain implementation
              forward.
            </Text>
          </div>
        </Group>
      </Card>
    </Stack>
  )
}
