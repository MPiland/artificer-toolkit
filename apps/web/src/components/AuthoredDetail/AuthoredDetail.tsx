import { Button, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core'
import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'
import * as styles from './AuthoredDetail.css'
import type {
  AuthoredDetailAction,
  AuthoredDetailFact,
  AuthoredDetailNotice,
  AuthoredDetailPendingOperation,
  AuthoredDetailSectionModel
} from './AuthoredDetail.types'
import { renderSanitizedRichHtml } from '#app/ui/primitives/renderSanitizedRichHtml'

interface AuthoredDetailLayoutProps {
  actions?: AuthoredDetailAction[]
  actionsDisabled?: boolean
  afterFacts?: ReactNode
  description?: string
  eyebrow?: string
  facts: AuthoredDetailFact[]
  notice?: AuthoredDetailNotice
  pendingOperation?: AuthoredDetailPendingOperation | null
  sections: AuthoredDetailSectionModel[]
  showSectionNav?: boolean
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

interface AuthoredDetailPillListProps {
  items: string[]
  label: string
}

export function AuthoredDetailLayout({
  actions = [],
  actionsDisabled = false,
  afterFacts,
  description,
  eyebrow,
  facts,
  notice,
  pendingOperation,
  sections,
  showSectionNav = true,
  status,
  title
}: AuthoredDetailLayoutProps) {
  const hasStatus = status.length > 0
  const hasActions = actions.length > 0
  const shouldShowSectionNav = showSectionNav && sections.length > 0

  return (
    <article className={styles.layout} aria-busy={pendingOperation ? true : undefined}>
      <Modal
        centered
        closeOnClickOutside={false}
        closeOnEscape={false}
        opened={Boolean(pendingOperation)}
        title={pendingOperation?.title ?? 'Working'}
        withCloseButton={false}
        onClose={() => undefined}
      >
        {pendingOperation
          ? (
              <Stack align='center' gap='md'>
                <Loader size='sm' />
                <Text ta='center' size='sm'>{pendingOperation.body}</Text>
              </Stack>
            )
          : null}
      </Modal>
      <header className={styles.hero}>
        {hasStatus || hasActions
          ? (
              <div className={styles.heroToolbar}>
                {hasStatus
                  ? (
                      <Group className={styles.statusRow}>
                        {status.map((label) => (
                          <span key={label} className={getStatusChipClassName(label)}>
                            {label}
                          </span>
                        ))}
                      </Group>
                    )
                  : <span />}
                {hasActions
                  ? (
                      <div className={styles.actionBar}>
                        {actions.map((action) => (
                          <Button
                            className={action.tone === 'danger' ? styles.dangerActionButton : undefined}
                            key={action.label}
                            disabled={actionsDisabled || action.disabled}
                            loading={action.loading}
                            size='sm'
                            variant={action.tone === 'primary' ? 'filled' : action.tone === 'quiet' ? 'subtle' : action.tone === 'danger' ? 'default' : 'light'}
                            onClick={action.onClick}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )
                  : null}
              </div>
            )
          : null}
        <div className={styles.heroMain}>
          {eyebrow ? <Text className={styles.eyebrow}>{eyebrow}</Text> : null}
          <Title className={styles.title}>{title}</Title>
          {description ? <Text className={styles.summary}>{description}</Text> : null}
        </div>
        {facts.length ? <AuthoredDetailFactGrid facts={facts} /> : null}
        {afterFacts ? <div className={styles.afterFacts}>{afterFacts}</div> : null}
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
                      className={notice.action.tone === 'danger' ? styles.dangerActionButton : undefined}
                      disabled={actionsDisabled || notice.action.disabled}
                      loading={notice.action.loading}
                      size='sm'
                      variant={notice.action.tone === 'primary' ? 'filled' : notice.action.tone === 'quiet' ? 'subtle' : notice.action.tone === 'danger' ? 'default' : 'light'}
                      onClick={notice.action.onClick}
                    >
                      {notice.action.label}
                    </Button>
                  )
                : null}
            </div>
          )
        : null}

      <div className={clsx(styles.contentLayout, !shouldShowSectionNav && styles.contentLayoutNoNav)}>
        {shouldShowSectionNav ? <AuthoredDetailNav sections={sections} /> : null}
        <div className={styles.sectionStack}>
          {sections.map((section) => <AuthoredDetailSection key={section.id} section={section} />)}
        </div>
      </div>
    </article>
  )
}

function getStatusChipClassName(label: string): string {
  return clsx(
    styles.statusChip,
    label === 'SRD' && styles.statusChipSrd,
    label === 'Homebrew' && styles.statusChipHomebrew,
    label.toLowerCase().includes('draft') && styles.statusChipDraft
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

export function AuthoredDetailPillList({ items, label }: AuthoredDetailPillListProps) {
  if (!items.length) {
    return null
  }

  return (
    <section className={styles.pillList} aria-label={label}>
      <Text className={styles.pillListLabel}>{label}</Text>
      <div className={styles.pillListItems}>
        {items.map((item) => <span className={styles.pill} key={item}>{item}</span>)}
      </div>
    </section>
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
    <dl className={styles.factGrid} style={{ '--authored-detail-fact-grid-columns': getFactGridColumnCount(facts.length) } as CSSProperties}>
      {facts.map((fact) => (
        <div key={fact.label} className={styles.fact}>
          <dt className={styles.factLabel}>{fact.label}</dt>
          <dd className={styles.factValue}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function getFactGridColumnCount(factCount: number): number {
  return Math.min(6, Math.max(1, Math.ceil(factCount / 2)))
}

export function AuthoredDetailProse({ html, fallback = 'No description has been added yet.' }: AuthoredDetailProseProps) {
  const content = html?.trim()

  if (!content) {
    return <AuthoredDetailEmptyBlock>{fallback}</AuthoredDetailEmptyBlock>
  }

  return <div className={styles.prose}>{renderSanitizedRichHtml(content)}</div>
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
