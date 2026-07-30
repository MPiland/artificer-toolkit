import { AuthoredDetailItemList, AuthoredDetailProse } from '#app/components/AuthoredDetail'
import { ContextCard } from '#app/ui/components/ContextCard/ContextCard'
import * as contextStyles from '#ui/components/ContextCard/ContextCard.css'
import { Axe, Backpack, BowArrow, Hammer, Shield, Shirt, Sword, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  AuthoredPreviewModel,
  EquipmentPreviewIcon,
  PreviewFact,
  PreviewSection
} from './authoredPreview.types'
import * as styles from './AuthoredPreview.css'

type AuthoredPreviewProps = {
  model: AuthoredPreviewModel
}

export function AuthoredPreview({ model }: AuthoredPreviewProps) {
  if (model.sections.length === 0) return null

  return (
    <div className={styles.root}>
      {model.domain === 'equipment' ? (
        <EquipmentPreview model={model} />
      ) : (
        <>
          <PreviewIdentity model={model} />
          {model.sections.map((section) => (
            <PreviewSectionView key={section.id} section={section} />
          ))}
        </>
      )}
    </div>
  )
}

function PreviewIdentity({ model }: { model: AuthoredPreviewModel }) {
  return (
    <section className={styles.previewIdentity}>
      <span className={styles.previewStatus}>{model.statusLabel}</span>
      <strong className={styles.previewTitle}>{model.label}</strong>
    </section>
  )
}

function EquipmentPreview({ model }: { model: AuthoredPreviewModel }) {
  const facts = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'facts' }> =>
      section.id === 'equipment-facts' && section.type === 'facts'
  )
  const prose = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'prose' }> =>
      section.id === 'equipment-prose' && section.type === 'prose'
  )
  const properties = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'chips' }> =>
      section.id === 'equipment-properties' && section.type === 'chips'
  )
  const damage = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'damage' }> =>
      section.id === 'damage-preview' && section.type === 'damage'
  )
  const category = facts?.facts.find((fact) => fact.label === 'Category')?.value
  const rarity = facts?.facts.find((fact) => fact.label === 'Rarity')?.value
  const metadata = [rarity, category].filter(Boolean)
  const stats: PreviewFact[] = [
    ...(damage?.items.length
      ? [
          {
            label: 'Damage',
            value: damage.items.map((item) => `${item.amount} ${item.label}`).join(', ')
          }
        ]
      : []),
    ...(properties?.items.length
      ? [{ label: 'Properties', value: properties.items.join(', ') }]
      : []),
    ...(facts?.facts.filter((fact) => fact.label === 'Weight' || fact.label === 'Value') ?? [])
  ]
  const consumedSectionIds = new Set([
    'damage-preview',
    'equipment-facts',
    'equipment-properties',
    'equipment-prose'
  ])

  return (
    <>
      <section className={styles.equipmentHero}>
        <div className={styles.equipmentVisual} aria-hidden='true'>
          <EquipmentIcon icon={model.equipmentIcon ?? 'gear'} />
        </div>
        <div className={styles.equipmentIdentity}>
          <span className={styles.previewStatus}>{model.statusLabel}</span>
          <strong className={styles.previewTitle}>{model.label}</strong>
          {metadata.length ? (
            <span className={styles.equipmentMeta}>{metadata.map(String).join(' · ')}</span>
          ) : null}
          {prose?.quote ? <p className={styles.equipmentQuote}>{prose.quote}</p> : null}
        </div>
        {stats.length ? (
          <dl className={styles.equipmentStats}>
            {stats.map((fact, index) => renderPreviewRow(fact, index))}
          </dl>
        ) : null}
      </section>
      {prose ? (
        <section className={styles.equipmentProse}>
          <AuthoredDetailProse html={prose.html} fallback={prose.fallback} />
        </section>
      ) : null}
      {model.sections
        .filter((section) => !consumedSectionIds.has(section.id))
        .map((section) => (
          <PreviewSectionView key={section.id} section={section} />
        ))}
    </>
  )
}

function EquipmentIcon({ icon }: { icon: EquipmentPreviewIcon }) {
  const props = { size: 58, strokeWidth: 1.35 }

  switch (icon) {
    case 'armor':
      return <Shirt {...props} />
    case 'axe':
      return <Axe {...props} />
    case 'bow':
      return <BowArrow {...props} />
    case 'hammer':
      return <Hammer {...props} />
    case 'shield':
      return <Shield {...props} />
    case 'sword':
      return <Sword {...props} />
    case 'tool':
      return <Wrench {...props} />
    case 'gear':
    default:
      return <Backpack {...props} />
  }
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
