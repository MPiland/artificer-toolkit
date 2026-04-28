import { Button } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { PageHeader } from '#app/shell'
import {
  homeGrid,
  homeMeta,
  homePanel,
  homePanelCopy,
  homePanelQuiet,
  homePanelText,
  homePanelTitle,
  homeStack
} from './home.css'

const homePanels = [
  {
    title: 'Open your content shelf',
    copy: 'Start with spells, then use the same familiar list pattern as each authored domain comes online.',
    meta: 'Create'
  },
  {
    title: 'Build without babysitting rules',
    copy: 'The frontend stays light while shared contracts and engine-backed services carry the heavy logic.',
    meta: 'Flow'
  },
  {
    title: 'Remix from trusted starting points',
    copy: 'Seeded content stays protected, but you can duplicate it into your own draft when you want to customize.',
    meta: 'Library'
  }
] as const

export function HomePage() {
  return (
    <div className={homeStack}>
      <PageHeader
        eyebrow='Workspace'
        title='Start creating for the table.'
        description='Jump into authored content, characters, and play surfaces from a shell that stays out of your way.'
        actions={<Button component={Link} to='/spells'>Open spells</Button>}
      />

      <section className={homeGrid} aria-label='Workspace next steps'>
        {homePanels.map((panel, index) => (
          <article
            className={index === 0 ? homePanel : `${homePanel} ${homePanelQuiet}`}
            key={panel.title}
          >
            <div className={homePanelCopy}>
              <span className={homeMeta}>{panel.meta}</span>
              <h2 className={homePanelTitle}>{panel.title}</h2>
              <p className={homePanelText}>{panel.copy}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
