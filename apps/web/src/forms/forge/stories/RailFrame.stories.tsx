import { Transition } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import clsx from 'clsx'
import { Rail } from '../components/Rail/Rail'
import { TopBar } from '../components/TopBar/TopBar'
import { railItems, railSummaries } from '../fixtures/rail.fixtures'
import * as styles from './RailFrame.stories.css'

function RailFrameStory() {
  const [isRailOpen, { toggle: toggleRail }] = useDisclosure(true)

  return (
    <div className={styles.storyCanvas} data-mantine-color-scheme='dark'>
      <div className={styles.frame}>
        <TopBar
          accountLabel='Account'
          crumbs={[{ label: 'Spells' }, { label: 'Ember Lance' }]}
          isNavigationOpen={isRailOpen}
          onNavigationToggle={toggleRail}
          statusLabel='Draft'
        />
        <div className={styles.workspace}>
          <div
            className={clsx(styles.railCollapse, !isRailOpen && styles.railCollapseClosed)}
            aria-hidden={!isRailOpen}
            id='forge-structure-rail'
          >
            <Transition
              duration={180}
              keepMounted
              mounted={isRailOpen}
              timingFunction='cubic-bezier(0.2, 0, 0, 1)'
              transition={{
                in: { opacity: 1, transform: 'translateX(0)' },
                out: { opacity: 0, transform: 'translateX(-8px)' },
                transitionProperty: 'opacity, transform'
              }}
            >
              {(transitionStyles) => (
                <div className={styles.railSlot} style={transitionStyles}>
                  <Rail items={railItems} summaries={railSummaries} subtitle='Ember Lance' title='Structure' />
                </div>
              )}
            </Transition>
          </div>
          <div className={styles.editorPlaceholder} aria-hidden='true' />
          <div className={styles.inspectorPlaceholder} aria-hidden='true' />
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Forms/Authoring/Rail/Frame',
  component: Rail,
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta<typeof Rail>

export default meta

type Story = StoryObj<typeof meta>

export const InFrame: Story = {
  render: () => <RailFrameStory />
}
