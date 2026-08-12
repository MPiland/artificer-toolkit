import { PageHeader } from '#app/shell'
import {
  homeGrid,
  homePanel,
  homePanelCopy,
  homePanelText,
  homePanelTitle,
  homeStack
} from './home.css'

const homePanels = [
  {
    title: 'Library',
    copy: 'Browse spells, classes, races, backgrounds, feats, equipment, creatures, and vehicles.'
  },
  {
    title: 'Drafts',
    copy: 'Edit a draft without changing the active version your table uses.'
  },
  {
    title: 'SRD content',
    copy: 'SRD content is read-only. Copy an entry when you want to make your own version.'
  }
] as const

export function HomePage() {
  return (
    <div className={homeStack}>
      <PageHeader
        title='Start with Library or Create'
        description='Open Library to browse your content. Use Create to start a character or homebrew draft.'
      />

      <section className={homeGrid} aria-label='Home next steps'>
        {homePanels.map((panel) => (
          <article className={homePanel} key={panel.title}>
            <div className={homePanelCopy}>
              <h2 className={homePanelTitle}>{panel.title}</h2>
              <p className={homePanelText}>{panel.copy}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
