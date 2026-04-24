import {
  heroMockup,
  mockupBody,
  mockupCard,
  mockupContent,
  mockupRail,
  mockupSplit,
  mockupTopbar,
  planBadge,
  railDot,
  railDotActive,
  sectionCopy,
  sectionTitle
} from '../marketing.css'

export function AppMockup() {
  return (
    <div className={heroMockup} aria-label='Campaign overview preview'>
      <div className={mockupTopbar} />
      <div className={mockupBody}>
        <div className={mockupRail} aria-hidden='true'>
          <div className={railDotActive} />
          <div className={railDot} />
          <div className={railDot} />
          <div className={railDot} />
          <div className={railDot} />
        </div>
        <div className={mockupContent}>
          <div>
            <h2 className={sectionTitle}>Campaign overview</h2>
            <p className={sectionCopy}>
              Keep characters, notes, and encounters ready for session night.
            </p>
          </div>
          <article className={mockupCard}>
            <span className={planBadge}>Active</span>
            <strong>Party roster</strong>
            <span>
              Track player resources, classes, and party balance at a glance before the next session.
            </span>
          </article>
          <div className={mockupSplit}>
            <article className={mockupCard}>
              <strong>Encounter prep</strong>
              <span>Build and save initiative, creatures, and notes before game night starts.</span>
            </article>
            <article className={mockupCard}>
              <strong>Shared content</strong>
              <span>Send custom spells, races, and items directly to your campaign.</span>
            </article>
          </div>
        </div>
      </div>
    </div>
  )
}
