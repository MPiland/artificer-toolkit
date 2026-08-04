import { AuthoredDetailItemList, AuthoredDetailProse } from '#app/components/AuthoredDetail'
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
      ) : model.domain === 'spell' ? (
        <SpellPreview model={model} />
      ) : (
        <DomainSheetPreview model={model} />
      )}
    </div>
  )
}

function SpellPreview({ model }: { model: AuthoredPreviewModel }) {
  const facts = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'facts' }> =>
      section.id === 'spell-facts' && section.type === 'facts'
  )
  const prose = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'prose' }> =>
      section.id === 'spell-prose' && section.type === 'prose'
  )
  const damage = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'damage' }> =>
      section.id === 'damage-preview' && section.type === 'damage'
  )
  const outcomes = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'facts' }> =>
      section.id === 'spell-outcomes' && section.type === 'facts'
  )
  const materials = model.sections.find(
    (section): section is Extract<PreviewSection, { type: 'prose' }> =>
      section.id === 'spell-materials' && section.type === 'prose'
  )
  const level = facts?.facts.find((fact) => fact.label === 'Level')?.value
  const school = facts?.facts.find((fact) => fact.label === 'School')?.value
  const metadata = [level, school].filter(Boolean)
  const stats =
    facts?.facts.filter((fact) => fact.label !== 'Level' && fact.label !== 'School') ?? []
  const hasProse = Boolean(prose?.html || prose?.quote)
  const hasMaterials = Boolean(materials?.html || materials?.quote)

  return (
    <>
      <section className={styles.spellHero}>
        <strong className={styles.spellTitle}>{model.label}</strong>
        {metadata.length ? (
          <span className={styles.spellMeta}>{metadata.map(String).join(' · ')}</span>
        ) : null}
      </section>
      {stats.length ? (
        <dl className={styles.spellStats}>
          {stats.map((fact) => (
            <div className={styles.spellStat} key={fact.label}>
              <dt className={styles.spellStatLabel}>{fact.label}</dt>
              <dd className={styles.spellStatValue}>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {hasProse && prose ? (
        <section className={styles.spellProse}>
          <AuthoredDetailProse html={prose.html}>
            {prose.quote ? <p className={styles.spellQuote}>{prose.quote}</p> : null}
          </AuthoredDetailProse>
        </section>
      ) : null}
      {damage?.items.length ? <SheetSectionView section={damage} /> : null}
      {outcomes?.facts.length ? <SheetSectionView section={outcomes} /> : null}
      {hasMaterials && materials ? <SheetSectionView section={materials} /> : null}
    </>
  )
}

function DomainSheetPreview({ model }: { model: AuthoredPreviewModel }) {
  return (
    <>
      <section className={styles.sheetHero} data-domain={model.domain}>
        <strong className={styles.sheetTitle}>{model.label}</strong>
      </section>
      {model.sections.map((section) => (
        <SheetSectionView key={section.id} section={section} />
      ))}
    </>
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
          <SheetSectionView key={section.id} section={section} />
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

function SheetSectionView({ section }: { section: PreviewSection }) {
  const title = (
    <h3 className={styles.sheetSectionTitle} id={`${section.id}-title`}>
      {section.title}
    </h3>
  )

  if (section.type === 'facts') {
    if (!section.facts.length) return null
    return (
      <section className={styles.sheetSection} aria-labelledby={`${section.id}-title`}>
        {title}
        <dl className={styles.sheetFacts}>
          {section.facts.map((fact, index) => renderPreviewFact(fact, index))}
        </dl>
      </section>
    )
  }

  if (section.type === 'prose') {
    if (!section.html && !section.quote && !section.fallback) return null
    const showsTitle = !section.id.endsWith('-prose')
    return (
      <section
        className={styles.sheetSection}
        aria-labelledby={showsTitle ? `${section.id}-title` : undefined}
      >
        {showsTitle ? title : null}
        <AuthoredDetailProse html={section.html} fallback={section.fallback}>
          {section.quote ? <p className={styles.sheetQuote}>{section.quote}</p> : null}
        </AuthoredDetailProse>
      </section>
    )
  }

  if (section.type === 'rows') {
    if (!section.rows.length) return null
    return (
      <section className={styles.sheetSection} aria-labelledby={`${section.id}-title`}>
        {title}
        <dl className={styles.rows}>
          {section.rows.map((row, index) => renderPreviewRow(row, index))}
        </dl>
      </section>
    )
  }

  if (section.type === 'list') {
    if (!section.items.length) return null
    return (
      <section className={styles.sheetSection} aria-labelledby={`${section.id}-title`}>
        {title}
        <AuthoredDetailItemList empty={section.empty} items={section.items} />
      </section>
    )
  }

  if (section.type === 'chips') {
    if (!section.items.length) return null
    return (
      <section className={styles.sheetSection} aria-labelledby={`${section.id}-title`}>
        {title}
        <div className={styles.chips}>
          {section.items.map((item) => (
            <span className={styles.chip} key={item}>
              {item}
            </span>
          ))}
        </div>
      </section>
    )
  }

  if (!section.items.length) return null
  return (
    <section className={styles.sheetSection} aria-labelledby={`${section.id}-title`}>
      {title}
      <div className={styles.damageList}>
        {section.items.map((item) => (
          <div className={styles.damageItem} key={`${item.amount}:${item.label}`}>
            <span className={styles.damageAmount[item.tone]}>{item.amount}</span>
            <span className={styles.damageLabel}>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function renderPreviewFact(fact: PreviewFact, index: number) {
  return (
    <div className={styles.sheetFact} key={`${fact.label}:${index}`}>
      <dt className={styles.spellStatLabel}>{fact.label}</dt>
      <dd className={styles.spellStatValue}>{fact.value}</dd>
    </div>
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
