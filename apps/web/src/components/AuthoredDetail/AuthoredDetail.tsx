import parse from 'html-react-parser'
import { Badge, Button, Group, Text, Title } from '@mantine/core'
import * as styles from './AuthoredDetail.css'
import type {
  AuthoredDetailAction,
  AuthoredDetailFact,
  AuthoredDetailNotice,
  AuthoredDetailSectionModel
} from './AuthoredDetail.types'

interface AuthoredDetailLayoutProps {
  actions?: AuthoredDetailAction[]
  description?: string
  eyebrow: string
  facts: AuthoredDetailFact[]
  notice?: AuthoredDetailNotice
  sections: AuthoredDetailSectionModel[]
  status: string[]
  title: string
}

interface AuthoredDetailNavProps {
  sections: Pick<AuthoredDetailSectionModel, 'id' | 'title'>[]
}

interface AuthoredDetailSectionProps {
  section: AuthoredDetailSectionModel
}

interface AuthoredDetailFactGridProps {
  facts: AuthoredDetailFact[]
}

interface AuthoredDetailProseProps {
  html?: string | null
  fallback?: string
}

interface AuthoredDetailEmptyBlockProps {
  children: string
}

interface AuthoredDetailItemListProps {
  empty: string
  items: {
    id: string
    title: string
    meta?: string
    description?: string | null
  }[]
}

export function AuthoredDetailLayout({
  actions = [],
  description,
  eyebrow,
  facts,
  notice,
  sections,
  status,
  title
}: AuthoredDetailLayoutProps) {
  return (
    <article className={styles.layout}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <Text className={styles.eyebrow}>{eyebrow}</Text>
          <Title className={styles.title}>{title}</Title>
          {description ? <Text className={styles.summary}>{description}</Text> : null}
          {actions.length
            ? (
                <div className={styles.actionBar}>
                  {actions.map((action) => (
                    <Button
                      key={action.label}
                      disabled={action.disabled}
                      size='sm'
                      variant={action.tone === 'primary' ? 'filled' : action.tone === 'quiet' ? 'subtle' : 'light'}
                      onClick={action.onClick}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )
            : null}
        </div>
        <aside className={styles.metaRail} aria-label='Record summary'>
          <Group className={styles.statusRow}>
            {status.map((label) => <Badge key={label} variant='light'>{label}</Badge>)}
          </Group>
          <AuthoredDetailFactGrid facts={facts} />
        </aside>
      </header>

      {notice
        ? (
            <div className={`${styles.noticeBase} ${styles.notice[notice.tone]}`}>
              <div className={styles.noticeText}>
                <Text className={styles.noticeTitle}>{notice.title}</Text>
                <Text className={styles.noticeBody}>{notice.body}</Text>
              </div>
              {notice.action
                ? (
                    <Button
                      size='sm'
                      variant={notice.action.tone === 'primary' ? 'filled' : notice.action.tone === 'quiet' ? 'subtle' : 'light'}
                      onClick={notice.action.onClick}
                    >
                      {notice.action.label}
                    </Button>
                  )
                : null}
            </div>
          )
        : null}

      <div className={styles.contentLayout}>
        <AuthoredDetailNav sections={sections} />
        <div className={styles.sectionStack}>
          {sections.map((section) => <AuthoredDetailSection key={section.id} section={section} />)}
        </div>
      </div>
    </article>
  )
}

export function AuthoredDetailNav({ sections }: AuthoredDetailNavProps) {
  return (
    <nav className={styles.nav} aria-label='Detail sections'>
      {sections.map((section) => (
        <a key={section.id} className={styles.navLink} href={`#${section.id}`}>
          {section.title}
        </a>
      ))}
    </nav>
  )
}

export function AuthoredDetailSection({ section }: AuthoredDetailSectionProps) {
  return (
    <section className={styles.section} id={section.id} aria-labelledby={`${section.id}-title`}>
      <header className={styles.sectionHeader}>
        {section.eyebrow ? <Text className={styles.sectionEyebrow}>{section.eyebrow}</Text> : null}
        <Title className={styles.sectionTitle} id={`${section.id}-title`}>
          {section.title}
        </Title>
      </header>
      {section.content}
    </section>
  )
}

export function AuthoredDetailFactGrid({ facts }: AuthoredDetailFactGridProps) {
  if (!facts.length) {
    return <AuthoredDetailEmptyBlock>No facts are available yet.</AuthoredDetailEmptyBlock>
  }

  return (
    <dl className={styles.factGrid}>
      {facts.map((fact) => (
        <div key={fact.label} className={styles.fact}>
          <dt className={styles.factLabel}>{fact.label}</dt>
          <dd className={styles.factValue}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function AuthoredDetailProse({ html, fallback = 'No description has been added yet.' }: AuthoredDetailProseProps) {
  const content = html?.trim()

  if (!content) {
    return <AuthoredDetailEmptyBlock>{fallback}</AuthoredDetailEmptyBlock>
  }

  return <div className={styles.prose}>{parse(content)}</div>
}

export function AuthoredDetailEmptyBlock({ children }: AuthoredDetailEmptyBlockProps) {
  return <div className={styles.emptyBlock}>{children}</div>
}

export function AuthoredDetailItemList({ empty, items }: AuthoredDetailItemListProps) {
  if (!items.length) {
    return <AuthoredDetailEmptyBlock>{empty}</AuthoredDetailEmptyBlock>
  }

  return (
    <div className={styles.itemList}>
      {items.map((item) => (
        <article key={item.id} className={styles.item}>
          <header className={styles.itemHeader}>
            <Title className={styles.itemTitle}>{item.title}</Title>
            {item.meta ? <Text className={styles.itemMeta}>{item.meta}</Text> : null}
          </header>
          {item.description ? <AuthoredDetailProse html={item.description} fallback='' /> : null}
        </article>
      ))}
    </div>
  )
}
