import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Button, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useMemo, useState } from 'react'
import { useShellAuthoringChrome } from './headerSupplement'
import { storybookNavigation } from './navigation'
import { railItems, railSummaries } from '../forms/fixtures/rail.fixtures'
import { editorHeaderPath, editorScalingRows } from '../forms/fixtures/editor.fixtures'
import {
  commitScalingRow,
  createScalingDraftRow,
  getScalingRowSummary,
  getScalingRowTitle,
  renderScalingRowActions,
  renderScalingRowEditor,
  scalingColumns
} from '../forms/fixtures/table.fixtures'
import { EditorCanvas } from '../forms/components/EditorCanvas/EditorCanvas'
import type { EditableTableRow, TableProps } from '../forms/components/Table/Table.types'
import { MarketingPage } from '../marketing/pages'
import { Rail, StructureRail } from './Rail/Rail'
import { PageHeader, Shell } from './Shell'

const meta = {
  title: 'Shell/App/Shell',
  component: Shell,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Composed app shell harness for signed-in navigation, signed-out pages, and authoring chrome. Component-level stories live beside each shell piece; this story verifies the full frame working together.'
      }
    }
  }
} satisfies Meta<typeof Shell>

export default meta

type Story = StoryObj<typeof meta>

const authoringArgs = {
  breadcrumbs: ['Spells', 'Ember Lance'],
  children: <AuthoringStoryContent />,
  currentPath: '/spells/ember-lance/edit',
  navigation: storybookNavigation,
  userEmail: 'creator@example.com'
} satisfies Story['args']

export const Docs: Story = {
  args: {
    breadcrumbs: ['Shell'],
    children: (
      <Stack gap='lg'>
        <PageHeader
          eyebrow='Shell'
          title='App shell'
          description='The signed-in shell owns app-wide Library and Create menus. Authoring screens add a structure rail only while editing.'
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing='md'>
          <StoryCard title='Library' text='Browse/list navigation is exposed as header and mobile footer menus.' />
          <StoryCard title='Create' text='Create navigation is separate from browse navigation and links directly to new-content routes.' />
          <StoryCard title='Structure' text='Authoring structure is contextual to forms and never doubles as app navigation.' />
        </SimpleGrid>
      </Stack>
    ),
    currentPath: '/home',
    navigation: storybookNavigation,
    userEmail: 'creator@example.com'
  }
}

export const SignedInLibrary: Story = {
  args: {
    breadcrumbs: ['Spells'],
    children: <LibraryStoryContent />,
    currentPath: '/spells',
    navigation: storybookNavigation,
    userEmail: 'creator@example.com'
  }
}

export const SignedOutMarketing: Story = {
  args: {
    breadcrumbs: [],
    children: null,
    currentPath: '/',
    navigation: []
  },
  render: () => <MarketingPage />
}

export const AuthoringWorkspace: Story = {
  args: authoringArgs
}

export const AuthoringMobile: Story = {
  args: authoringArgs,
  parameters: {
    viewport: {
      defaultViewport: 'mobile2'
    }
  }
}

function LibraryStoryContent() {
  return (
    <Stack gap='lg'>
      <PageHeader
        eyebrow='Library'
        title='Spells'
        description='Browse, continue drafts, and create new tabletop content from the app shell.'
        actions={<Button>Create spell</Button>}
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing='md'>
        <StoryCard title='Drafts' text='3 spells need review before activation.' />
        <StoryCard
          title='Published'
          text='18 spells are ready for use in characters and campaigns.'
        />
        <StoryCard title='Recent' text='Ember Lance was edited 14 minutes ago.' />
      </SimpleGrid>
    </Stack>
  )
}

const baseTable = {
  addLabel: 'Add cast level',
  ariaLabel: 'Scaling progression',
  columns: scalingColumns,
  editorTitle: (row, mode) =>
    mode === 'create' ? 'Add cast level' : `Edit ${row ? getScalingRowTitle(row) : 'cast level'}`,
  getRowSummary: getScalingRowSummary,
  getRowTitle: getScalingRowTitle,
  renderRowActions: renderScalingRowActions,
  renderRowEditor: renderScalingRowEditor,
  rows: editorScalingRows,
  saveLabel: 'Save cast level'
} satisfies TableProps

function AuthoringStoryContent() {
  const [opened, { close, toggle }] = useDisclosure(true)
  const [rows, setRows] = useState<readonly EditableTableRow[]>(editorScalingRows)
  const table = useMemo(
    () => ({
      ...baseTable,
      createDraftRow: () => createScalingDraftRow(rows),
      onCommitRow: (payload) => {
        setRows((currentRows) => commitScalingRow(currentRows, payload))
      },
      rows
    }),
    [rows]
  ) satisfies TableProps

  const chrome = useMemo(
    () => ({
      crumbs: [{ label: 'Spells' }, { label: 'Ember Lance' }],
      desktopRail: (
        <Rail
          aria-label='Authoring workspace navigation'
          items={railItems}
          subtitle='Ember Lance'
          summaries={railSummaries}
          title='Structure'
        />
      ),
      isNavigationOpen: opened,
      mobileRail: (
        <StructureRail
          items={railItems}
          onClose={close}
          subtitle='Ember Lance'
          summaries={railSummaries}
          title='Structure'
        />
      ),
      onNavigationClose: close,
      onNavigationToggle: toggle,
      statusLabel: 'Draft'
    }),
    [close, opened, toggle]
  )

  useShellAuthoringChrome(chrome)

  return (
    <EditorCanvas path={editorHeaderPath} table={table} title='Upcast Scaling' />
  )
}

function StoryCard({ title, text }: { text: string; title: string }) {
  return (
    <Paper component='section' withBorder p='md' radius='md'>
      <Title order={2} size='md'>
        {title}
      </Title>
      <Text c='dimmed' size='sm'>
        {text}
      </Text>
    </Paper>
  )
}
