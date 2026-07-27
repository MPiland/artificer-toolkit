import { PageHeader } from '#app/shell'
import {
  homeGrid,
  homeMeta,
  homePanel,
  homePanelCopy,
  homePanelText,
  homePanelTitle,
  homeStack
} from './home.css'

const homePanels = [
  {
    title: 'Open a content list',
    copy: 'Find spells, classes, races, backgrounds, feats, equipment, creatures, and vehicles from one consistent place.',
    meta: 'Content'
  },
  {
    title: 'Keep drafts separate',
    copy: 'Work on changes without losing the active version your table already trusts.',
    meta: 'Drafts'
  },
  {
    title: 'Start from the SRD',
    copy: 'Use locked SRD records for reference, then duplicate one when you need your own version.',
    meta: 'Reference'
  }
] as const

export function HomePage() {
  return (
    <div className={homeStack}>
      <PageHeader
        title='What are you building today?'
        description='Open a list, review active records, or turn a trusted starting point into homebrew for your table.'
      />

      <section className={homeGrid} aria-label='Home next steps'>
        {homePanels.map((panel) => (
          <article className={homePanel} key={panel.title}>
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
