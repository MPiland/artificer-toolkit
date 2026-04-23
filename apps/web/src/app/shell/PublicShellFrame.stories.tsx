import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button, Stack, Text } from '@mantine/core'
import { PublicShellFrame } from './PublicShellFrame'

const meta = {
  title: 'Platform/Shells/PublicShellFrame',
  component: PublicShellFrame,
  args: {
    eyebrow: 'Storybook review',
    title: 'Public shell foundation',
    description: 'Shared review surface for marketing and auth routes before the dedicated visual tranche begins.',
    highlights: [
      'Mantine and vanilla-extract stay active.',
      'The app shell is isolated from the provisional route graph.',
      'Storybook and Playwright are now part of the review loop.'
    ],
    actions: <Button>Primary action</Button>,
    children: (
      <Stack gap='md'>
        <Text c='dimmed'>
          This panel becomes the marketing hero callout, auth frame, and other logged-out surfaces in the
          next tranche.
        </Text>
        <Button variant='default'>Secondary action</Button>
      </Stack>
    )
  }
} satisfies Meta<typeof PublicShellFrame>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
