import { AuthoredDetailItemList, AuthoredDetailProse } from '#app/components/AuthoredDetail'
import { ContextCard } from '#app/ui/components/ContextCard/ContextCard'
import * as contextStyles from '#ui/components/ContextCard/ContextCard.css'
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
        <dl className={styles.facts}>
          {section.facts.map((fact) => (
            <div className={styles.fact} key={fact.label}>
              <dt className={styles.factLabel}>{fact.label}</dt>
              <dd className={styles.factValue}>{fact.value}</dd>
            </div>
          ))}
        </dl>
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
