import type { SystemResponseDto } from '@artificer-toolkit/schema/api/systems'
import type { AuthoredFormPreviewContext } from '../factories/authoredFormFactories.types'
import type {
  AuthoredPreviewModel,
  DamagePreviewItem,
  DamagePreviewTone,
  PreviewFact,
  PreviewListItem,
  PreviewSection
} from './authoredPreview.types'

type RuntimeRecord = Record<string, unknown>
type VocabularyKey = Exclude<
  keyof NonNullable<SystemResponseDto>,
  'description' | 'id' | 'label' | 'rulesetCode' | 'rulesetVersion' | 'userId'
>

const MAX_COLLECTION_ITEMS = 5

export function createAuthoredPreviewModel(
  context: AuthoredFormPreviewContext
): AuthoredPreviewModel {
  const values = toRecord(context.values)
  if (!values) return { sections: [] }

  const sections = createDomainSections(context.domain, values, context.system)
  return { sections: sections.filter(isUsefulSection) }
}

export function collectDamagePreviewItems(
  values: object,
  system?: SystemResponseDto | null
): DamagePreviewItem[] {
  const seen = new Set<string>()

  return collectRecords(values)
    .filter((record) => record.effectKind === 'DAMAGE')
    .flatMap((record) => {
      const item = createDamageItem(record, system)
      if (!item) return []

      const key = `${item.amount}:${item.label}`
      if (seen.has(key)) return []
      seen.add(key)
      return [item]
    })
    .slice(0, MAX_COLLECTION_ITEMS)
}

function createDomainSections(
  domain: AuthoredFormPreviewContext['domain'],
  values: RuntimeRecord,
  system?: SystemResponseDto | null
): PreviewSection[] {
  switch (domain) {
    case 'background':
      return [
        createProseSection('background-prose', 'Description', values, 'Add a description to preview its reader copy.'),
        createListSection('background-features', 'Features', readRecords(values.features), 'No background features yet.'),
        createListSection('background-details', 'Details', readRecords(values.details), 'No background details yet.')
      ]
    case 'class':
      return [
        createFactsSection('class-facts', 'Class Snapshot', [
          ['Hit Die', readRecord(values.hitpoint)?.dieConfig],
          ['Starting Gold', formatCost(readRecord(values.startingGold), system)],
          ['Features', formatCount(readRecords(values.features).length, 'feature')]
        ]),
        createListSection('class-features', 'Progression Hooks', readRecords(values.features), 'No class features yet.'),
        createChargesSection(values)
      ]
    case 'creature':
      return [
        createFactsSection('creature-facts', 'Stat Block', [
          ['AC', readNumber(values.armorClass)],
          ['HP', formatHitPoints(values)],
          ['CR', labelForVocabularyId(system, 'challengeRatings', readString(values.challengeRatingId))],
          ['Type', labelForVocabularyId(system, 'creatureTypes', readString(values.creatureTypeId))]
        ]),
        createRowsSection('creature-speeds', 'Speeds', createSpeedRows(readRecords(values.speeds), system), { showWhenEmpty: true }),
        createChipsSection('creature-defenses', 'Defenses', [
          ...labelIds(system, 'damageTypes', readStrings(values.damageVulnerabilities), 'Vulnerable'),
          ...labelIds(system, 'damageTypes', readStrings(values.damageResistances), 'Resists'),
          ...labelIds(system, 'damageTypes', readStrings(values.damageImmunities), 'Immune'),
          ...labelIds(system, 'conditionTypes', readStrings(values.conditionImmunities), 'Immune')
        ]),
        createDamageSection(values, system),
        createListSection('creature-features', 'Actions & Traits', readRecords(values.features), 'No creature traits yet.')
      ]
    case 'equipment':
      return [
        createFactsSection('equipment-facts', 'Item Snapshot', [
          ['Category', formatEnumLabel(readString(values.category))],
          ['Rarity', labelForVocabularyId(system, 'rarities', readString(values.rarityId))],
          ['Cost', formatCost(readRecord(values.cost), system)],
          ['Weight', formatMeasurement(readRecord(values.weight))]
        ]),
        createChipsSection(
          'equipment-properties',
          'Properties',
          readStrings(values.properties).map(formatEnumLabel).filter((value): value is string => value !== undefined)
        ),
        createDamageSection(values, system),
        createChargesSection(values),
        createListSection('equipment-features', 'Features', readRecords(values.features), 'No equipment features yet.')
      ]
    case 'feat':
      return [
        createProseSection('feat-prose', 'Description', values, 'Add a description to preview its reader copy.'),
        createDamageSection(values, system),
        createChargesSection(values),
        createListSection('feat-features', 'Feature Pieces', readRecords(values.features), 'No feat features yet.')
      ]
    case 'race':
      return [
        createProseSection('race-prose', 'Description', values, 'Add a description to preview how this will read.'),
        createRowsSection('race-traits', 'Traits', [
          ...createFactRows([
            ['Size', formatEnumLabel(readString(values.size))]
          ]),
          ...createSpeedRows(readRecords(values.speeds), system).map((speed) => ({
            label: 'Speeds',
            value: speed.label
          }))
        ]),
        createListSection('race-options', 'Ancestry Options', readRecords(values.options), 'No ancestry options yet.'),
        createListSection('race-features', 'Features', readRecords(values.features), 'No race features yet.'),
        createListSection('race-details', 'Details', readRecords(values.details), 'No race details yet.')
      ]
    case 'spell':
      return [
        createFactsSection('spell-facts', 'Spell Snapshot', [
          ['Level', formatSpellLevel(readNumber(values.level))],
          ['School', labelForVocabularyId(system, 'magicSchools', readString(values.magicSchoolId))],
          ['Casting', formatTimedUnit(readRecord(values.castingTime))],
          ['Components', readStrings(values.components).map(formatEnumLabel).join(', ')]
        ]),
        createDamageSection(values, system),
        createProseSection('spell-prose', 'Description', values, 'Add a description to preview its reader copy.'),
        createProseSection('spell-materials', 'Materials', { description: values.materialDescription }, undefined)
      ]
    case 'vehicle':
      return [
        createFactsSection('vehicle-facts', 'Vehicle Snapshot', [
          ['Category', formatEnumLabel(readString(values.category))],
          ['Armor Class', readNumber(values.armorClass)],
          ['Hit Points', readNumber(values.hitPoints)],
          ['Speed', readString(values.speedNote) ?? formatNumber(readNumber(values.speed))],
          ['Crew', formatCrew(values)],
          ['Cost', formatCost(readRecord(values.cost), system)]
        ]),
        createListSection('vehicle-features', 'Features', readRecords(values.features), 'No vehicle features yet.')
      ]
  }
}

function createFactsSection(
  id: string,
  title: string,
  entries: readonly (readonly [string, unknown])[]
): PreviewSection {
  return {
    facts: createFactRows(entries),
    id,
    title,
    type: 'facts'
  }
}

function createFactRows(entries: readonly (readonly [string, unknown])[]): PreviewFact[] {
  return entries.flatMap(([label, value]) => {
    const formatted = formatFactValue(value)
    return formatted ? [{ label, value: formatted }] : []
  })
}

function createProseSection(
  id: string,
  title: string,
  values: RuntimeRecord,
  fallback?: string
): PreviewSection {
  return {
    fallback,
    html: readString(values.description),
    id,
    quote: readString(values.quote),
    title,
    type: 'prose'
  }
}

function createListSection(
  id: string,
  title: string,
  records: readonly RuntimeRecord[],
  empty: string
): PreviewSection {
  return {
    empty,
    id,
    items: records.slice(0, MAX_COLLECTION_ITEMS).map(createListItem),
    title,
    type: 'list'
  }
}

function createRowsSection(
  id: string,
  title: string,
  rows: readonly PreviewFact[],
  options?: {
    empty?: string
    showWhenEmpty?: boolean
  }
): PreviewSection {
  return {
    empty: options?.empty,
    id,
    rows: [...rows],
    showWhenEmpty: options?.showWhenEmpty,
    title,
    type: 'rows'
  }
}

function createChipsSection(id: string, title: string, items: readonly string[]): PreviewSection {
  return {
    id,
    items: [...new Set(items.filter(Boolean))].slice(0, MAX_COLLECTION_ITEMS),
    title,
    type: 'chips'
  }
}

function createDamageSection(
  values: RuntimeRecord,
  system?: SystemResponseDto | null
): PreviewSection {
  return {
    id: 'damage-preview',
    items: collectDamagePreviewItems(values, system),
    title: 'Damage',
    type: 'damage'
  }
}

function createChargesSection(values: RuntimeRecord): PreviewSection {
  const charges = collectRecords(values)
    .filter((record) => typeof record.resetKind === 'string' && typeof record.limitKind === 'string')
    .map(formatCharge)
    .filter(Boolean)

  return createChipsSection('charges-preview', 'Charges', charges)
}

function createListItem(record: RuntimeRecord, index: number): PreviewListItem {
  const label = readString(record.label) ?? readString(record.title) ?? `Item ${index + 1}`
  return {
    description: readString(record.description),
    id: readString(record.id) ?? `${label}:${index}`,
    meta: formatOrder(record.order),
    title: label
  }
}

function createDamageItem(
  record: RuntimeRecord,
  system?: SystemResponseDto | null
): DamagePreviewItem | undefined {
  const damageTypeId = readString(record.damageTypeId)
  const vocabulary = findVocabulary(system, 'damageTypes', damageTypeId)
  const label = vocabulary?.label ?? formatEnumLabel(damageTypeId) ?? 'Damage'
  const amount = formatDamageAmount(record)
  if (!amount && !damageTypeId) return undefined

  return {
    amount: amount ?? 'Damage',
    label,
    tone: getDamageTone(vocabulary?.code ?? damageTypeId)
  }
}

function formatDamageAmount(record: RuntimeRecord): string | undefined {
  const diceConfig = readString(record.diceConfig)
  const amount = readNumber(record.amount)
  const levelAmount = readFirstScalingValue(record.levels, 'amount')
  const levelDice = readFirstScalingValue(record.levels, 'diceConfig')
  const breakpointAmount = readFirstScalingValue(record.breakpoints, 'amount')
  const breakpointDice = readFirstScalingValue(record.breakpoints, 'diceConfig')
  const formatted = diceConfig
    ?? formatNumber(amount)
    ?? formatScalingValue(levelDice ?? levelAmount)
    ?? formatScalingValue(breakpointDice ?? breakpointAmount)

  if (!formatted) return undefined
  return record.amountKind === 'HALF' ? `Half ${formatted}` : formatted
}

function readFirstScalingValue(value: unknown, key: string): string | number | undefined {
  const record = readRecords(value)[0]
  if (!record) return undefined
  const entry = record[key]
  return typeof entry === 'string' || typeof entry === 'number' ? entry : undefined
}

function formatScalingValue(value: string | number | undefined): string | undefined {
  if (typeof value === 'string') return `${value}+`
  if (typeof value === 'number') return `${value}+`
  return undefined
}

function formatCharge(record: RuntimeRecord): string {
  const limitKind = readString(record.limitKind)
  const resetKind = readString(record.resetKind)
  const amount = readNumber(record.amount)
  const limit = amount !== undefined ? `${amount}` : formatEnumLabel(limitKind) ?? 'Scaling'
  const reset = formatEnumLabel(resetKind)?.toLowerCase()
  return reset ? `${limit}, ${reset}` : limit
}

function formatCost(cost: RuntimeRecord | undefined, system?: SystemResponseDto | null): string | undefined {
  const amount = readNumber(cost?.amount)
  if (amount === undefined) return undefined
  const currency = labelForVocabularyId(system, 'currencies', readString(cost?.currencyId), 'short')
  return currency ? `${formatNumber(amount)} ${currency}` : formatNumber(amount)
}

function formatMeasurement(record: RuntimeRecord | undefined): string | undefined {
  const amount = readNumber(record?.amount)
  const unit = formatEnumLabel(readString(record?.unit))?.toLowerCase()
  if (amount === undefined) return undefined
  return unit ? `${formatNumber(amount)} ${unit}` : formatNumber(amount)
}

function formatTimedUnit(record: RuntimeRecord | undefined): string | undefined {
  const amount = readNumber(record?.amount)
  const unit = formatEnumLabel(readString(record?.unit))?.toLowerCase()
  if (amount === undefined || !unit) return undefined
  return `${formatNumber(amount)} ${amount === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit}`
}

function formatHitPoints(values: RuntimeRecord): string | undefined {
  const hitPoints = readNumber(values.hitPoints)
  const hitDice = readString(values.hitDice)
  if (hitPoints === undefined) return undefined
  return hitDice ? `${formatNumber(hitPoints)} (${hitDice})` : formatNumber(hitPoints)
}

function formatCrew(values: RuntimeRecord): string | undefined {
  const min = readNumber(values.crewMin)
  const max = readNumber(values.crewMax)
  if (min === undefined && max === undefined) return undefined
  if (min !== undefined && max !== undefined && min !== max) return `${min}-${max}`
  return formatNumber(min ?? max)
}

function createSpeedRows(
  speeds: readonly RuntimeRecord[],
  system?: SystemResponseDto | null
): PreviewFact[] {
  return speeds.flatMap((speed) => {
    const speedLabel = labelForVocabularyId(system, 'speeds', readString(speed.speedId))
    if (!speedLabel) return []
    const amount = readNumber(speed.amount)
    const unit = formatEnumLabel(readString(speed.unit))?.toLowerCase() ?? 'feet'
    const label = speedLabel.replace(/\s*Speed$/i, '')
    const value = amount === undefined ? label : `${label} - ${formatNumber(amount)} ${unit}`

    return [{
      label: value
    }]
  })
}

function formatSpellLevel(level: number | undefined): string | undefined {
  if (level === undefined) return undefined
  return level === 0 ? 'Cantrip' : `${level}${getOrdinalSuffix(level)} level`
}

function getOrdinalSuffix(value: number): string {
  const tens = value % 100
  if (tens >= 11 && tens <= 13) return 'th'
  switch (value % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

function formatOrder(value: unknown): string | undefined {
  const order = readNumber(value)
  return order === undefined ? undefined : `Order ${order + 1}`
}

function formatCount(count: number, label: string): string | undefined {
  if (count <= 0) return undefined
  return `${count} ${count === 1 ? label : `${label}s`}`
}

function formatFactValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number') return formatNumber(value)
  return undefined
}

function formatNumber(value: number | undefined): string | undefined {
  return value === undefined ? undefined : new Intl.NumberFormat('en-US').format(value)
}

function labelIds(
  system: SystemResponseDto | null | undefined,
  key: VocabularyKey,
  ids: readonly string[],
  prefix: string
): string[] {
  return ids.flatMap((id) => {
    const label = labelForVocabularyId(system, key, id)
    return label ? [`${prefix}: ${label}`] : []
  })
}

function labelForVocabularyId(
  system: SystemResponseDto | null | undefined,
  key: VocabularyKey,
  id: string | undefined,
  labelKey: 'label' | 'short' = 'label'
): string | undefined {
  const vocabulary = findVocabulary(system, key, id)
  return vocabulary?.[labelKey] ?? vocabulary?.label
}

function findVocabulary(
  system: SystemResponseDto | null | undefined,
  key: VocabularyKey,
  id: string | undefined
) {
  if (!system || !id) return undefined
  return system[key].find((entry) => entry.id === id || entry.code === id)
}

function getDamageTone(value: string | undefined): DamagePreviewTone {
  const normalized = value?.toLowerCase().replace(/[^a-z]/g, '')
  switch (normalized) {
    case 'acid':
    case 'bludgeoning':
    case 'cold':
    case 'fire':
    case 'force':
    case 'lightning':
    case 'necrotic':
    case 'piercing':
    case 'poison':
    case 'psychic':
    case 'radiant':
    case 'slashing':
    case 'thunder':
      return normalized
    default:
      return 'neutral'
  }
}

function formatEnumLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function readRecord(value: unknown): RuntimeRecord | undefined {
  return toRecord(value) ?? undefined
}

function readRecords(value: unknown): RuntimeRecord[] {
  return Array.isArray(value) ? value.flatMap((entry) => {
    const record = toRecord(entry)
    return record ? [record] : []
  }) : []
}

function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toRecord(value: unknown): RuntimeRecord | null {
  return typeof value === 'object' && value !== null ? value as RuntimeRecord : null
}

function collectRecords(value: unknown): RuntimeRecord[] {
  const root = toRecord(value)
  if (!root) return []

  const records: RuntimeRecord[] = []
  const visit = (entry: unknown) => {
    if (Array.isArray(entry)) {
      entry.forEach(visit)
      return
    }

    const record = toRecord(entry)
    if (!record) return
    records.push(record)
    Object.values(record).forEach(visit)
  }

  visit(root)
  return records
}

function isUsefulSection(section: PreviewSection): boolean {
  if (section.type === 'facts') return section.facts.length > 0
  if (section.type === 'prose') return Boolean(section.html?.trim() || section.quote?.trim() || section.fallback)
  if (section.type === 'rows') return section.rows.length > 0 || Boolean(section.empty) || Boolean(section.showWhenEmpty)
  return section.items.length > 0
}
