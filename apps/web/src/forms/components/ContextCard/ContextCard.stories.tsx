import { Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { ContextCard } from './ContextCard'
import * as styles from './ContextCard.css'
import * as storyStyles from './ContextCard.stories.css'

function ContextCardStory() {
  return (
    <ContextCard title='Description' titleId='context-card-description-heading'>
      <Text component='p' className={styles.previewText}>
        A lance of ember erupts in a line from a point you choose. A creature takes{' '}
        <span className={styles.damageValue}>3d6 fire</span> damage on a failed save.
      </Text>
      <Text component='p' className={styles.previewSubheading}>
        At higher levels
      </Text>
      <Text component='p' className={styles.previewText}>
        The damage increases to <span className={styles.damageValue}>4d6</span> at cast level 2.
      </Text>
    </ContextCard>
  )
}

const meta = {
  title: 'Forms/Authoring/Editor/Context Card',
  component: ContextCard,
  parameters: {
    layout: 'fullscreen'
  },
  decorators: [
    (Story) => (
      <div className={storyStyles.storyCanvas}>
        <div className={storyStyles.cardSlot}>
          <Story />
        </div>
      </div>
    )
  ]
} satisfies Meta<typeof ContextCard>

export default meta

type Story = StoryObj<typeof meta>

export const Description: Story = {
  args: {
    children: null,
    title: 'Description',
    titleId: 'context-card-description-heading'
  },
  render: () => <ContextCardStory />
}
