import { Paper, Stack, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { AppMultiSelect, AppSelect } from '.'
import type { AppSelectData } from './Select.types'

const magicSchools: AppSelectData = [
  { value: 'abjuration', label: 'Abjuration' },
  { value: 'conjuration', label: 'Conjuration' },
  { value: 'evocation', label: 'Evocation' },
  { value: 'illusion', label: 'Illusion' }
]

const groupedClasses: AppSelectData = [
  {
    group: 'Prepared casters',
    items: [
      { value: 'cleric', label: 'Cleric' },
      { value: 'druid', label: 'Druid' },
      { value: 'wizard', label: 'Wizard' }
    ]
  },
  {
    group: 'Known casters',
    items: [
      { value: 'bard', label: 'Bard' },
      { value: 'sorcerer', label: 'Sorcerer' },
      { value: 'warlock', label: 'Warlock' }
    ]
  }
]

function SelectStory() {
  const [value, setValue] = useState<string | null>('evocation')

  return (
    <StoryFrame>
      <AppSelect
        label='Magic School'
        description='Choose the school that best describes the spell.'
        data={magicSchools}
        value={value}
        onChange={setValue}
      />
      <Text size='sm' c='dimmed'>{`Selected: ${value ?? 'None'}`}</Text>
    </StoryFrame>
  )
}

function SelectErrorStory() {
  const [value, setValue] = useState<string | null>(null)

  return (
    <StoryFrame>
      <AppSelect
        label='Magic School'
        data={magicSchools}
        value={value}
        onChange={setValue}
        error='Pick a magic school before saving.'
        required
      />
    </StoryFrame>
  )
}

function MultiSelectStory() {
  const [value, setValue] = useState<string[]>(['wizard', 'sorcerer'])

  return (
    <StoryFrame>
      <AppMultiSelect
        label='Classes'
        description='Select every class that can learn this spell.'
        data={groupedClasses}
        value={value}
        onChange={setValue}
      />
      <Text size='sm' c='dimmed'>{`Selected: ${value.length ? value.join(', ') : 'None'}`}</Text>
    </StoryFrame>
  )
}

function MultiSelectAllStory() {
  const [value, setValue] = useState<string[]>(['all'])

  return (
    <StoryFrame>
      <AppMultiSelect
        label='Eligible options'
        description='All is an authoring shortcut; choosing a specific option switches back to selected-only values.'
        data={groupedClasses}
        value={value}
        onChange={setValue}
        includeAllOption
      />
      <Text size='sm' c='dimmed'>{`Model value: ${value.length ? value.join(', ') : 'None'}`}</Text>
    </StoryFrame>
  )
}

function DisabledStory() {
  return (
    <StoryFrame>
      <AppSelect
        label='Magic School'
        data={magicSchools}
        value='abjuration'
        onChange={() => undefined}
        disabled
      />
      <AppMultiSelect
        label='Classes'
        data={groupedClasses}
        value={['cleric']}
        onChange={() => undefined}
        disabled
      />
    </StoryFrame>
  )
}

function StoryFrame({ children }: { children: ReactNode }) {
  return (
    <Paper p='lg' radius='lg' maw={520}>
      <Stack gap='md'>{children}</Stack>
    </Paper>
  )
}

const meta = {
  title: 'UI/Primitives/Select',
  parameters: {
    docs: {
      description: {
        component:
          'App-level wrappers around Mantine Select and MultiSelect. These keep Mantine accessibility and keyboard behavior while centralizing Artificer option normalization, token styling, grouped options, and opt-in authoring shortcuts.'
      }
    }
  }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Single: Story = {
  render: () => <SelectStory />
}

export const SingleWithError: Story = {
  render: () => <SelectErrorStory />
}

export const Multi: Story = {
  render: () => <MultiSelectStory />
}

export const MultiWithAllShortcut: Story = {
  render: () => <MultiSelectAllStory />
}

export const Disabled: Story = {
  render: () => <DisabledStory />
}
