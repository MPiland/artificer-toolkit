import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { useDisclosure } from '@mantine/hooks'
import { TopBar } from './TopBar'
import * as styles from './TopBar.stories.css'

function HeaderStory() {
  const [isNavigationOpen, { toggle: toggleNavigation }] = useDisclosure(true)

  return (
    <TopBar
      accountLabel='Account'
      crumbs={[{ label: 'Spells' }, { label: 'Ember Lance' }]}
      isNavigationOpen={isNavigationOpen}
      onNavigationToggle={toggleNavigation}
      statusLabel='Draft'
    />
  )
}

const meta = {
  title: 'Forms/Authoring/Top Bar/Header',
  component: TopBar,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className={styles.storyCanvas}>
        <div className={styles.frame}>
          <Story />
          <div className={styles.workspaceHint} aria-hidden='true'>
            <div className={styles.railHint} />
            <div className={styles.editorHint} />
            <div className={styles.inspectorHint} />
          </div>
        </div>
      </div>
    )
  ]
} satisfies Meta<typeof TopBar>

export default meta

type Story = StoryObj<typeof meta>

export const HeaderInContext: Story = {
  args: {
    accountLabel: 'Account',
    crumbs: [{ label: 'Spells' }, { label: 'Ember Lance' }],
    isNavigationOpen: true,
    onNavigationToggle: () => undefined,
    statusLabel: 'Draft'
  },
  render: () => <HeaderStory />
}
