import type { ProficiencyGrantDto } from '@artificer-toolkit/schema/grants/proficiency'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared/startingEquipment'
import type { ReferenceOption } from '#app/data/contentReferences'
import { formatEnumLabel } from './detailFormatters'
import { isRecord } from '#app/forms/utils/valueGuards'

export type GrantDetailLine = {
  id: string
  label: string
  description: string
}

export type GrantReferenceData = {
  currencies: ReferenceOption[]
  equipment: ReferenceOption[]
  languages: ReferenceOption[]
  skills: ReferenceOption[]
}

type ProficiencyGrantLineOptions = {
  skillLabel?: string
}

type StartingEquipmentItem =
  StartingEquipmentDto['sets'][number]['groups'][number]['options'][number]['items'][number]

export function formatProficiencyGrantLines(
  grants: readonly ProficiencyGrantDto[] | null | undefined,
  references: GrantReferenceData,
  options: ProficiencyGrantLineOptions = {}
): GrantDetailLine[] {
  const groups = new Map<
    string,
    {
      id: string
      label: string
      order: number
      parts: string[]
    }
  >()

  for (const grant of [...(grants ?? [])].sort((first, second) => first.order - second.order)) {
    const label = formatProficiencyGrantLineLabel(grant, options)
    const description = formatProficiencyGrantDescription(grant, references)

    if (!description) continue

    const group = groups.get(label)

    if (group) {
      group.parts.push(description)
      continue
    }

    groups.set(label, {
      id: grant.id,
      label,
      order: grant.order,
      parts: [description]
    })
  }

  return [...groups.values()]
    .sort((first, second) => first.order - second.order)
    .map((group) => ({
      id: group.id,
      label: group.label,
      description: sentenceCase(group.parts.join(', '))
    }))
}

export function formatStartingEquipmentLine(
  startingEquipment: StartingEquipmentDto | null | undefined,
  references: Pick<GrantReferenceData, 'currencies' | 'equipment'>
): GrantDetailLine | null {
  const description = formatStartingEquipmentDescription(startingEquipment, references)

  if (!description) return null

  return {
    id: startingEquipment?.id ?? 'starting-equipment',
    label: 'Equipment',
    description
  }
}

export function formatGrantDetailLinesHtml(lines: readonly GrantDetailLine[]): string {
  return lines
    .filter((line) => line.description.trim())
    .map(
      (line) => `<p><strong>${escapeHtml(line.label)}:</strong> ${escapeHtml(line.description)}</p>`
    )
    .join('')
}

function formatProficiencyGrantLineLabel(
  grant: ProficiencyGrantDto,
  options: ProficiencyGrantLineOptions
): string {
  switch (grant.proficiencyKind) {
    case 'SKILL':
      return options.skillLabel ?? 'Skills'
    case 'LANGUAGE':
      return 'Languages'
    case 'SAVE_ABILITY':
      return 'Saving Throws'
    case 'EQUIPMENT':
    case 'EQUIPMENT_PROPERTY':
      return formatEquipmentProficiencyLineLabel(readOptionalString(grant, 'category'))
  }
}

function formatProficiencyGrantDescription(
  grant: ProficiencyGrantDto,
  references: GrantReferenceData
): string | undefined {
  if (grant.proficiencyKind === 'SKILL') {
    return formatGrantTarget({
      allOptions: isAllTarget(grant, readGrantIds(grant, 'skillIds'), references.skills),
      count: grant.count,
      labels: readGrantIds(grant, 'skillIds').map((id) =>
        findReferenceLabel(id, references.skills)
      ),
      noun: 'skill'
    })
  }

  if (grant.proficiencyKind === 'LANGUAGE') {
    return formatGrantTarget({
      allOptions: isAllTarget(grant, readGrantIds(grant, 'languageIds'), references.languages),
      count: grant.count,
      labels: readGrantIds(grant, 'languageIds').map((id) =>
        findReferenceLabel(id, references.languages)
      ),
      noun: 'language'
    })
  }

  if (grant.proficiencyKind === 'SAVE_ABILITY') {
    const abilities = readGrantIds(grant, 'abilities').map(formatEnumLabel)
    return abilities.length ? abilities.join(', ') : undefined
  }

  return formatEquipmentProficiencyDescription(grant, references.equipment)
}

function formatEquipmentProficiencyDescription(
  grant: ProficiencyGrantDto,
  equipmentReferences: ReferenceOption[]
): string | undefined {
  const category = readOptionalString(grant, 'category')

  if (grant.proficiencyKind === 'EQUIPMENT_PROPERTY') {
    const properties = readGrantIds(grant, 'properties')

    if (isFullArmorProficiency(category, properties)) {
      return 'all armor'
    }

    return formatGrantTarget({
      allOptions: isAllTarget(grant, properties, []),
      count: grant.count,
      labels: properties.map((property) => formatEquipmentPropertyLabel(property, category)),
      noun: formatEquipmentChoiceNoun(category)
    })
  }

  const equipmentIds = readGrantIds(grant, 'equipmentIds')
  const labels = equipmentIds.map((id) =>
    formatEquipmentName(findReferenceLabel(id, equipmentReferences))
  )
  const allOptions = isAllTarget(grant, equipmentIds, [])

  if (allOptions && !labels.length) {
    return formatAllEquipmentCategory(category)
  }

  return formatGrantTarget({
    allOptions,
    count: grant.count,
    labels,
    noun: formatEquipmentChoiceNoun(category)
  })
}

function formatGrantTarget({
  allOptions,
  count,
  labels,
  noun
}: {
  allOptions: boolean
  count: number | undefined
  labels: string[]
  noun: string
}): string | undefined {
  if (count && count > 0) {
    if (allOptions) {
      return count === 1 ? `Choose any ${noun}.` : `Choose any ${count} ${pluralize(noun)}.`
    }

    if (labels.length === 2 && count === 1) {
      return `Choose either ${labels[0]} or ${labels[1]}.`
    }

    if (labels.length) {
      return count === 1
        ? `Choose one from ${formatOrList(labels)}.`
        : `Choose ${count} from ${formatOrList(labels)}.`
    }

    return count === 1 ? `Choose one ${noun}.` : `Choose ${count} ${pluralize(noun)}.`
  }

  if (allOptions) return `all ${pluralize(noun)}`
  return labels.length ? labels.join(', ') : undefined
}

function formatStartingEquipmentDescription(
  startingEquipment: StartingEquipmentDto | null | undefined,
  references: Pick<GrantReferenceData, 'currencies' | 'equipment'>
): string {
  const setDescriptions = [...(startingEquipment?.sets ?? [])]
    .sort((first, second) => first.order - second.order)
    .map((set) =>
      [...set.groups]
        .sort((first, second) => first.order - second.order)
        .map((group) => formatStartingEquipmentGroup(group, references))
        .filter(Boolean)
        .join('; ')
    )
    .filter(Boolean)

  return ensureSentencePunctuation(sentenceCase(setDescriptions.join('; ')))
}

function formatStartingEquipmentGroup(
  group: NonNullable<StartingEquipmentDto['sets'][number]['groups']>[number],
  references: Pick<GrantReferenceData, 'currencies' | 'equipment'>
): string {
  const options = [...group.options]
    .sort((first, second) => first.order - second.order)
    .map((option) => formatStartingEquipmentOption(option, references))
    .filter(Boolean)

  if (options.length <= 1) return options[0] ?? ''
  if (options.length === 2) return `choose either ${options[0]} or ${options[1]}`

  return `choose one from ${formatOrList(options)}`
}

function formatStartingEquipmentOption(
  option: StartingEquipmentDto['sets'][number]['groups'][number]['options'][number],
  references: Pick<GrantReferenceData, 'currencies' | 'equipment'>
): string {
  const parts = [...option.items]
    .sort((first, second) => first.order - second.order)
    .map((item) => formatStartingEquipmentItem(item, references))
    .filter(Boolean)

  return formatAndList(mergeContainerCurrency(parts))
}

function formatStartingEquipmentItem(
  item: StartingEquipmentItem,
  references: Pick<GrantReferenceData, 'currencies' | 'equipment'>
): string {
  if (item.startingEquipmentKind === 'CURRENCY') {
    return item.currencies
      .map(
        (currency) =>
          `${currency.amount} ${formatCurrency(currency.currencyId, references.currencies)}`
      )
      .join(', ')
  }

  const equipmentIds = readGrantIds(item, 'equipmentIds')
  const labels = equipmentIds.map((id) =>
    formatEquipmentName(findReferenceLabel(id, references.equipment))
  )
  const fallback = formatEquipmentCategoryTarget(readOptionalString(item, 'category'))
  const choices = labels.length ? labels : [fallback]

  if (item.selectionKind === 'CHOSEN') {
    return formatEquipmentChoice(choices, item.count, readOptionalString(item, 'category'))
  }

  return formatGrantedEquipment(choices, item.quantity)
}

function formatEquipmentChoice(
  labels: string[],
  count: number,
  category: string | undefined
): string {
  if (labels.length === 2 && count === 1) {
    return `choose either ${withIndefiniteArticle(labels[0])} or ${labels[1]}`
  }

  const choices = labels.map(withIndefiniteArticle)

  if (labels.length) {
    return count === 1
      ? `choose one from ${formatOrList(choices)}`
      : `choose ${count} from ${formatOrList(choices)}`
  }

  return count === 1
    ? `choose any ${formatEquipmentChoiceNoun(category)}`
    : `choose any ${count} ${pluralize(formatEquipmentChoiceNoun(category))}`
}

function formatGrantedEquipment(labels: string[], quantity: number): string {
  if (labels.length !== 1) {
    return formatAndList(labels.map(withIndefiniteArticle))
  }

  const label = labels[0]

  if (quantity > 1) return formatQuantity(label, quantity)
  return withIndefiniteArticle(label)
}

function formatQuantity(label: string, quantity: number): string {
  if (label === 'incense') return `${quantity} sticks of incense`
  return `${quantity} ${pluralizeLabel(label)}`
}

function formatEquipmentProficiencyLineLabel(category: string | undefined): string {
  if (category === 'ARMOR' || category === 'SHIELD') return 'Armor'
  if (category === 'WEAPON') return 'Weapons'
  if (category === 'TOOL') return 'Tools'
  return 'Equipment Proficiencies'
}

function formatEquipmentPropertyLabel(property: string, category: string | undefined): string {
  const label = formatEnumLabel(property).toLowerCase()

  if (category === 'ARMOR') return `${label} armor`
  if (category === 'WEAPON') return `${label} weapons`

  return label
}

function formatAllEquipmentCategory(category: string | undefined): string {
  if (category === 'ARMOR') return 'all armor'
  if (category === 'SHIELD') return 'shields'
  if (category === 'WEAPON') return 'all weapons'
  if (category === 'TOOL') return 'all tools'
  return 'all equipment'
}

function formatEquipmentChoiceNoun(category: string | undefined): string {
  if (category === 'ARMOR') return 'armor proficiency'
  if (category === 'SHIELD') return 'shield proficiency'
  if (category === 'WEAPON') return 'weapon proficiency'
  if (category === 'TOOL') return 'tool'
  return 'equipment proficiency'
}

function formatEquipmentCategoryTarget(category: string | undefined): string {
  if (!category) return 'equipment'
  if (category === 'SHIELD') return 'shield'
  return formatEnumLabel(category).toLowerCase()
}

function isFullArmorProficiency(category: string | undefined, properties: string[]): boolean {
  return (
    category === 'ARMOR' &&
    properties.includes('LIGHT') &&
    properties.includes('MEDIUM') &&
    properties.includes('HEAVY')
  )
}

function isAllTarget<T extends object>(
  value: T,
  ids: string[],
  references: ReferenceOption[]
): boolean {
  const mode = readOptionalString(value, 'authoringModeKind')
  return mode === 'ALL' || (references.length > 0 && ids.length === references.length)
}

function readGrantIds(value: object, key: string): string[] {
  const ids = isRecord(value) ? value[key] : undefined
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
}

function readOptionalString(value: object, key: string): string | undefined {
  const field = isRecord(value) ? value[key] : undefined
  return typeof field === 'string' ? field : undefined
}

function findReferenceLabel(id: string, references: ReferenceOption[]): string {
  return references.find((reference) => reference.value === id)?.label ?? id
}

function formatCurrency(currencyId: string, currencies: ReferenceOption[]): string {
  const label = findReferenceLabel(currencyId, currencies)
  return label
    .replace('Gold Piece', 'gp')
    .replace('Silver Piece', 'sp')
    .replace('Copper Piece', 'cp')
    .replace('Electrum Piece', 'ep')
    .replace('Platinum Piece', 'pp')
}

function formatEquipmentName(label: string): string {
  const normalized = label.trim().replace(/\s+/g, ' ').toLowerCase()

  if (normalized.startsWith('holy symbol:')) return 'holy symbol'

  return normalized
}

function mergeContainerCurrency(parts: string[]): string[] {
  return parts.reduce<string[]>((merged, part) => {
    const previous = merged[merged.length - 1]

    if (previous === 'a pouch' && /^\d+ [a-z]{1,3}$/i.test(part)) {
      return [...merged.slice(0, -1), `${previous} containing ${part}`]
    }

    return [...merged, part]
  }, [])
}

function withIndefiniteArticle(label: string): string {
  if (!label || doesNotNeedArticle(label)) return label
  return `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`
}

function doesNotNeedArticle(label: string): boolean {
  return (
    /^(a|an|all|any|some|\d+)\b/i.test(label) ||
    (label.endsWith('s') && !label.endsWith('ss')) ||
    label === 'armor' ||
    label === 'equipment' ||
    label === 'incense'
  )
}

function formatAndList(values: string[]): string {
  return formatInlineList(values, 'and')
}

function formatOrList(values: string[]): string {
  return formatInlineList(values, 'or')
}

function formatInlineList(values: string[], conjunction: 'and' | 'or'): string {
  if (values.length <= 1) return values[0] ?? ''
  if (values.length === 2) return `${values[0]} ${conjunction} ${values[1]}`

  return `${values.slice(0, -1).join(', ')}, ${conjunction} ${values[values.length - 1]}`
}

function pluralize(noun: string): string {
  if (noun.endsWith('y')) return `${noun.slice(0, -1)}ies`
  return `${noun}s`
}

function pluralizeLabel(label: string): string {
  if (label.endsWith('s')) return label
  if (label.endsWith('y')) return `${label.slice(0, -1)}ies`
  return `${label}s`
}

function sentenceCase(value: string): string {
  return value.replace(/^([a-z])/, (letter) => letter.toUpperCase())
}

function ensureSentencePunctuation(value: string): string {
  if (!value) return value
  return /[.!?]$/.test(value) ? value : `${value}.`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
