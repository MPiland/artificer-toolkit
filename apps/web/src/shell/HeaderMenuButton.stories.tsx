import type { Meta, StoryObj } from '@storybook/tanstack-react'
import type { CSSProperties } from 'react'
import { Box, Button, Group } from '@mantine/core'
import { BookOpen, PlusCircle } from 'lucide-react'
import * as styles from './shell.css'

type HeaderMenuButtonStoryArgs = {
  backgroundColor: string
  borderColor: string
  hoverBackgroundColor: string
  hoverBorderColor: string
  hoverTextColor: string
  label: string
  textColor: string
  variant: 'library' | 'create'
}

type MenuButtonVariables = CSSProperties & Record<`--shell-menu-button-${string}`, string>

const meta = {
  title: 'Shell/App/Header/Menu Button',
  component: HeaderMenuButtonStory,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The desktop shell Library/Create menu trigger style. It uses the same shell class as production and exposes temporary CSS variable controls for color comparison.'
      }
    }
  },
  argTypes: {
    backgroundColor: { control: 'color' },
    borderColor: { control: 'color' },
    hoverBackgroundColor: { control: 'color' },
    hoverBorderColor: { control: 'color' },
    hoverTextColor: { control: 'color' },
    textColor: { control: 'color' },
    variant: {
      control: 'inline-radio',
      options: ['library', 'create']
    }
  },
  args: {
    backgroundColor: '#ec8c06',
    borderColor: '#c95704',
    hoverBackgroundColor: '#f97316',
    hoverBorderColor: '#c95704',
    hoverTextColor: '#241002',
    label: 'Library',
    textColor: '#241002',
    variant: 'library'
  }
} satisfies Meta<typeof HeaderMenuButtonStory>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const ShellActions: Story = {
  args: {
    label: 'Library'
  },
  render: (args) => (
    <Box style={getButtonVariables(args)}>
      <Group gap='xs'>
        <Button
          className={styles.headerMenuButton}
          leftSection={<BookOpen size={16} aria-hidden='true' />}
          size='compact-sm'
          variant='subtle'
        >
          Library
        </Button>
        <Button
          className={styles.headerMenuButton}
          leftSection={<PlusCircle size={16} aria-hidden='true' />}
          size='compact-sm'
          variant='subtle'
        >
          Create
        </Button>
      </Group>
    </Box>
  )
}

function HeaderMenuButtonStory({
  label,
  variant,
  ...colorArgs
}: HeaderMenuButtonStoryArgs) {
  const Icon = variant === 'create' ? PlusCircle : BookOpen

  return (
    <Button
      className={styles.headerMenuButton}
      leftSection={<Icon size={16} aria-hidden='true' />}
      size='compact-sm'
      style={getButtonVariables(colorArgs)}
      variant='subtle'
    >
      {label}
    </Button>
  )
}

function getButtonVariables({
  backgroundColor,
  borderColor,
  hoverBackgroundColor,
  hoverBorderColor,
  hoverTextColor,
  textColor
}: Pick<
  HeaderMenuButtonStoryArgs,
  | 'backgroundColor'
  | 'borderColor'
  | 'hoverBackgroundColor'
  | 'hoverBorderColor'
  | 'hoverTextColor'
  | 'textColor'
>): MenuButtonVariables {
  return {
    '--shell-menu-button-background': backgroundColor,
    '--shell-menu-button-border': borderColor,
    '--shell-menu-button-hover-background': hoverBackgroundColor,
    '--shell-menu-button-hover-border': hoverBorderColor,
    '--shell-menu-button-hover-text': hoverTextColor,
    '--shell-menu-button-text': textColor
  }
}
