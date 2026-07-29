import { AuthoredDetailItemList, AuthoredDetailProse } from '#app/components/AuthoredDetail'
import { ContextCard } from '#app/ui/components/ContextCard/ContextCard'
import * as contextStyles from '#ui/components/ContextCard/ContextCard.css'
import type { ReactNode } from 'react'
import type { AuthoredPreviewModel, PreviewSection } from './authoredPreview.types'
import * as styles from './AuthoredPreview.css'

type AuthoredPreviewProps = {
  model: AuthoredPreviewModel
}

export function AuthoredPreview({ model }: AuthoredPreviewProps) {
  if (model.sections.length === 0) return null

  return (
    <div className={styles.root}>
      {model.sections.map((section) => (
        <PreviewSectionView key={section.id} section={section} />
      ))}
    </div>
  )
}

function PreviewSectionView({ section }: { section: PreviewSection }) {
  if (section.type === 'facts') {
    return (
      <ContextCard title={section.title} titleId={`${section.id}-title`}>
        <dl className={styles.rows}>{section.facts.map((fact) => renderPreviewRow(fact))}</dl>
      </ContextCard>
    )
  }

  if (section.type === 'prose') {
    return (
      <ContextCard title={section.title} titleId={`${section.id}-title`}>
        <AuthoredDetailProse html={section.html} fallback={section.fallback}>
          {section.quote ? <p className={contextStyles.body}>{section.quote}</p> : null}
        </AuthoredDetailProse>
      </ContextCard>
    )
  }

  if (section.type === 'rows') {
    return (
      <ContextCard title={section.title} titleId={`${section.id}-title`}>
        {section.rows.length ? (
          <dl className={styles.rows}>
            {section.rows.map((row, index) => renderPreviewRow(row, index))}
          </dl>
        ) : section.empty ? (
          <p className={contextStyles.body}>{section.empty}</p>
        ) : null}
      </ContextCard>
    )
  }

  if (section.type === 'list') {
    return (
      <ContextCard title={section.title} titleId={`${section.id}-title`}>
        <AuthoredDetailItemList empty={section.empty} items={section.items} />
      </ContextCard>
    )
  }

  if (section.type === 'chips') {
    return (
      <ContextCard title={section.title} titleId={`${section.id}-title`}>
        <div className={styles.chips}>
          {section.items.map((item) => (
            <span className={styles.chip} key={item}>
              {item}
            </span>
          ))}
        </div>
      </ContextCard>
    )
  }

  return (
    <ContextCard title={section.title} titleId={`${section.id}-title`}>
      <div className={styles.damageList}>
        {section.items.map((item) => (
          <div className={styles.damageItem} key={`${item.amount}:${item.label}`}>
            <span className={styles.damageAmount[item.tone]}>{item.amount}</span>
            <span className={styles.damageLabel}>{item.label}</span>
          </div>
        ))}
      </div>
    </ContextCard>
  )
}

function renderPreviewRow(row: { label: string; value?: ReactNode }, index = 0) {
  const hasValue = row.value !== undefined && row.value !== null && row.value !== ''

  return (
    <div className={styles.row} key={`${row.label}:${index}`}>
      <dt className={hasValue ? styles.rowLabel : styles.singleRowValue}>{row.label}</dt>
      {hasValue ? <dd className={styles.rowValue}>{row.value}</dd> : null}
    </div>
  )
}
