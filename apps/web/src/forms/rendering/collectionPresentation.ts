import type {
  NodeRuntimeArrayGroupNodeDto,
  NodeRuntimeCollectionActionDto,
  NodeRuntimeCollectionAuthoringDto,
  NodeRuntimeObjectActionDto,
  NodeRuntimeObjectGroupNodeDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  EFFECT_KIND_OPTIONS,
  MODIFIER_KIND_OPTIONS,
  MODIFIER_SCOPE_OPTIONS,
  NODE_SUBJECT_OPTIONS,
  PATH_CODE_OPTIONS,
  PREDICATE_OPTIONS,
  TRIGGER_OPTIONS,
  VALUE_DOMAIN_OPTIONS
} from '@artificer-toolkit/shared/core'
import { isRecord } from '../utils/valueGuards'

type CollectionAuthoring = NodeRuntimeCollectionAuthoringDto
type RowSummary = CollectionAuthoring['rowSummary']

type CollectionPresentation = {
  addAction?: Extract<NodeRuntimeCollectionActionDto, { type: 'collection.add' }>
  duplicateAction?: Extract<NodeRuntimeCollectionActionDto, { type: 'collection.duplicate' }>
  editAction?: Extract<NodeRuntimeCollectionActionDto, { type: 'collection.edit' }>
  emptyLabel: string
  heading: string | null
  headingIcon: 'help' | 'controls'
  itemLabel: string
  join?: 'AND' | 'OR'
  removeAction?: Extract<NodeRuntimeCollectionActionDto, { type: 'collection.remove' }>
  rowExpansion: 'collapsible' | 'expanded'
  rowLayout: 'default' | 'card' | 'flat' | 'compact'
}

type CollectionRowIcon = 'box' | 'sparkles' | 'sword'
type CollectionColumnKey = 'name' | 'source' | 'restrictions'

type CollectionColumn = {
  key: CollectionColumnKey
  label: string
}

type CollectionRowCell = CollectionColumn & {
  value: string
}

const MODIFIER_COLUMNS: readonly CollectionColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'source', label: 'Source' },
  { key: 'restrictions', label: 'Restrictions' }
]

export function getCollectionPresentation(
  node: NodeRuntimeArrayGroupNodeDto
): CollectionPresentation {
  const collection = node.authoring.collection
  const itemLabel = collection.itemLabel ?? toSingularLabel(node.label)

  return {
    addAction: findCollectionAction(collection.actions, 'collection.add'),
    duplicateAction: findCollectionAction(collection.actions, 'collection.duplicate'),
    editAction: findCollectionAction(collection.actions, 'collection.edit'),
    emptyLabel: collection.emptyLabel ?? `No ${node.label.toLowerCase()} added yet.`,
    heading: collection.showHeading === false ? null : node.label,
    headingIcon: collection.rowSummary === 'modifier' ? 'controls' : 'help',
    itemLabel,
    join: collection.join,
    removeAction: findCollectionAction(collection.actions, 'collection.remove'),
    rowExpansion: collection.rowExpansion ?? 'collapsible',
    rowLayout: collection.rowLayout ?? 'default'
  }
}

export function getObjectGroupPresentation(node: NodeRuntimeObjectGroupNodeDto) {
  const authoring = node.authoring
  const itemLabel = toSingularLabel(node.label)

  return {
    addAction: findObjectAction(authoring.actions, 'collection.add'),
    emptyLabel: authoring.emptyLabel ?? `${node.label} has not been configured yet.`,
    removeAction: findObjectAction(authoring.actions, 'collection.remove'),
    itemLabel
  }
}

/** `rowScope` is the row's resolved child scope; it supplies the System option labels a row summary names. */
export function getCollectionRowLabel(
  node: NodeRuntimeArrayGroupNodeDto,
  row: unknown,
  index: number,
  rowScope?: NodeRuntimeResolveResponseDto
) {
  if (isRecord(row) && typeof row.label === 'string' && row.label.trim()) {
    const availableAtLevel = readNumber(row.availableAtLevel)
    return availableAtLevel === undefined ? row.label : `Level ${availableAtLevel} · ${row.label}`
  }

  const summary = node.authoring?.collection?.rowSummary
  const label = summary ? getRowSummaryLabel(summary, row, rowScope) : undefined
  if (label) return label

  const proficiencyLabel = getProficiencyRowLabel(row)
  if (proficiencyLabel) return proficiencyLabel

  const spellLimitLabel = getClassSpellLimitRowLabel(row)
  if (spellLimitLabel) return spellLimitLabel

  const itemLabel = getCollectionPresentation(node).itemLabel
  return `${toTitleCase(itemLabel)} ${index + 1}`
}

function getClassSpellLimitRowLabel(row: unknown): string | undefined {
  if (!isRecord(row) || !Array.isArray(row.slots)) return undefined
  const classLevel = readNumber(row.classLevel)
  if (classLevel === undefined) return undefined

  const slots = row.slots
    .map((slot) => (isRecord(slot) ? readNumber(slot.slotCount) : undefined))
    .filter((count): count is number => count !== undefined)
  const known = readNumber(row.learnedSpellsLimit)
  const slotLabel = slots.length > 0 ? `${slots.join('/')} slots` : 'No slots'
  return `Level ${classLevel} · ${slotLabel}${known === undefined ? '' : ` · ${known} known`}`
}

function getProficiencyRowLabel(row: unknown): string | undefined {
  if (!isRecord(row)) return undefined

  const kind = readString(row.proficiencyKind)
  if (!kind) return undefined

  const count = readNumber(row.count) ?? 1
  const isChosen = row.selectionKind === 'CHOSEN'
  if (isChosen) {
    const target =
      kind === 'SKILL'
        ? 'skill'
        : kind === 'LANGUAGE'
          ? 'language'
          : readString(row.category) === 'TOOL'
            ? 'tool proficiency'
            : 'proficiency'
    return `Choose ${count} ${target}${count === 1 ? '' : 's'}`
  }

  if (kind === 'SAVE_ABILITY' && Array.isArray(row.abilities)) {
    const abilities = row.abilities
      .map((ability) => formatEnumLabel(readString(ability)))
      .filter((ability): ability is string => Boolean(ability))
    if (abilities.length > 0) return `${abilities.join(' & ')} saves`
  }

  if (kind === 'EQUIPMENT_PROPERTY' && Array.isArray(row.properties)) {
    const properties = row.properties
      .map((property) => formatEnumLabel(readString(property)))
      .filter((property): property is string => Boolean(property))
    const category = formatEnumLabel(readString(row.category))?.toLowerCase()
    if (properties.length > 0) {
      return `${properties.join(' / ')}${category ? ` ${category}` : ''} proficiency`
    }
  }

  const category = formatEnumLabel(readString(row.category))
  return category ? `${category} proficiency` : `${formatEnumLabel(kind)} proficiency`
}

export function getCollectionRowDescription(
  node: NodeRuntimeArrayGroupNodeDto,
  row: unknown
): string | undefined {
  if (!isRecord(row) || node.authoring?.collection?.rowSummary !== 'modifier') return undefined

  const attackDomain = formatEnumLabel(readString(getRecordValue(row, 'domain.attackDomain')))
  const scope = getOptionLabel(MODIFIER_SCOPE_OPTIONS, readString(row.scope))
  const valueKind = formatEnumLabel(readString(getRecordValue(row, 'payload.valueKind')))
  const restriction = getRestrictionLabel(row)

  return [attackDomain, scope, valueKind, restriction].filter(Boolean).join(' · ') || undefined
}

export function getCollectionRowMetadata(
  node: NodeRuntimeArrayGroupNodeDto,
  row: unknown
): string[] {
  if (!isRecord(row) || node.authoring?.collection?.rowSummary !== 'modifier') return []

  const valueDomainCode = readString(row.valueDomainCode)
  const valueDomain =
    valueDomainCode === 'ATTACK_ROLL'
      ? 'Attack Roll'
      : valueDomainCode === 'DAMAGE'
        ? 'Damage'
        : getOptionLabel(VALUE_DOMAIN_OPTIONS, valueDomainCode)
  const attackDomain = formatEnumLabel(readString(getRecordValue(row, 'domain.attackDomain')))
  const scope = getOptionLabel(MODIFIER_SCOPE_OPTIONS, readString(row.scope))
  const valueKind = formatEnumLabel(readString(getRecordValue(row, 'payload.valueKind')))
  const amount = readNumber(getRecordValue(row, 'payload.amount'))
  const unit = formatEnumLabel(readString(getRecordValue(row, 'payload.unit')))?.toLowerCase()
  const signedAmount =
    amount === undefined ? undefined : `${amount > 0 ? '+' : ''}${formatNumber(amount)}`
  // A speed or sense range amount is a typed length: its unit stands in for the value source.
  const amountLabel =
    signedAmount !== undefined && unit
      ? `${signedAmount} ${unit}`
      : signedAmount === undefined || !valueKind
        ? valueKind
        : `${valueKind} ${signedAmount}`

  return [valueDomain, attackDomain, scope, amountLabel, getRestrictionLabel(row)].filter(
    (item): item is string => Boolean(item)
  )
}

export function getCollectionRowIcon(
  node: NodeRuntimeArrayGroupNodeDto,
  row: unknown
): CollectionRowIcon {
  if (node.authoring?.collection?.rowSummary !== 'modifier') return 'box'
  return isRecord(row) && row.valueDomainCode === 'ATTACK_ROLL' ? 'sword' : 'sparkles'
}

export function getCollectionColumns(
  node: NodeRuntimeArrayGroupNodeDto
): readonly CollectionColumn[] {
  return node.authoring?.collection?.rowSummary === 'modifier' ? MODIFIER_COLUMNS : []
}

export function getCollectionRowCells(
  node: NodeRuntimeArrayGroupNodeDto,
  row: unknown,
  label: string
): readonly CollectionRowCell[] {
  if (!isRecord(row) || node.authoring?.collection?.rowSummary !== 'modifier') return []

  const source =
    row.scope === 'SOURCE' ? 'This item' : row.scope === 'GLOBAL' ? 'Global' : 'Not specified'

  return [
    { ...MODIFIER_COLUMNS[0], value: label },
    { ...MODIFIER_COLUMNS[1], value: source },
    { ...MODIFIER_COLUMNS[2], value: getRestrictionLabel(row) ?? 'None' }
  ]
}

function findCollectionAction<TType extends NodeRuntimeCollectionActionDto['type']>(
  actions: readonly NodeRuntimeCollectionActionDto[],
  type: TType
): Extract<NodeRuntimeCollectionActionDto, { type: TType }> | undefined {
  return actions.find(
    (action): action is Extract<NodeRuntimeCollectionActionDto, { type: TType }> =>
      action.type === type
  )
}

function findObjectAction<TType extends NodeRuntimeObjectActionDto['type']>(
  actions: readonly NodeRuntimeObjectActionDto[],
  type: TType
): Extract<NodeRuntimeObjectActionDto, { type: TType }> | undefined {
  return actions.find(
    (action): action is Extract<NodeRuntimeObjectActionDto, { type: TType }> => action.type === type
  )
}

function getRowSummaryLabel(
  summary: RowSummary,
  row: unknown,
  rowScope: NodeRuntimeResolveResponseDto | undefined
): string | undefined {
  if (!isRecord(row)) return undefined

  switch (summary) {
    case 'facet-context': {
      const subject = getOptionLabel(NODE_SUBJECT_OPTIONS, readString(row.subject))
      return subject ? `${subject} condition` : undefined
    }
    case 'facet-condition':
      return getOptionLabel(PREDICATE_OPTIONS, readString(row.predicateCode))
    case 'modifier': {
      const amount = readNumber(getRecordValue(row, 'payload.amount'))
      const kind = readString(row.modifierKind)
      const influence = formatEnumLabel(readString(getRecordValue(row, 'payload.influence')))
      // A roll influence reads as its System code (Advantage); a suppressed one as its absence.
      const modifierKind =
        influence === undefined
          ? getOptionLabel(MODIFIER_KIND_OPTIONS, kind)
          : kind === 'SUPPRESS_ROLL_INFLUENCE'
            ? `No ${influence}`
            : influence
      const valueDomainCode = readString(row.valueDomainCode)
      const valueDomain =
        valueDomainCode === 'ATTACK_ROLL'
          ? 'Attack Rolls'
          : valueDomainCode === 'DAMAGE'
            ? 'Damage Rolls'
            : getOptionLabel(VALUE_DOMAIN_OPTIONS, valueDomainCode)
      const unit = formatEnumLabel(readString(getRecordValue(row, 'payload.unit')))?.toLowerCase()
      const amountLabel =
        amount === undefined
          ? undefined
          : [`${amount > 0 ? '+' : ''}${formatNumber(amount)}`, unit].filter(Boolean).join(' ')

      return [amountLabel, valueDomain, modifierKind !== 'Bonus' ? modifierKind : undefined]
        .filter(Boolean)
        .join(' ')
    }
    case 'effect':
      return getOptionLabel(
        TRIGGER_OPTIONS,
        readString(getRecordValue(row, 'invocation.triggerCode'))
      )
    case 'effect-path':
      return getOptionLabel(PATH_CODE_OPTIONS, readString(row.pathCode))
    case 'outcome': {
      const effectKind = readString(row.effectKind)
      return effectKind === 'HEAL' ? 'Healing' : getOptionLabel(EFFECT_KIND_OPTIONS, effectKind)
    }
    case 'speed': {
      const speedLabel = getResolvedOptionLabel(rowScope, 'speedId', readString(row.speedId))
      const amount = readNumber(row.amount)
      const unit = formatEnumLabel(readString(row.unit))
      const amountLabel =
        amount === undefined ? undefined : `${formatNumber(amount)} ${unit ?? 'Feet'}`
      return speedLabel && amountLabel
        ? `${speedLabel} - ${amountLabel}`
        : (speedLabel ?? amountLabel)
    }
    case 'default':
      return undefined
  }
}

function getRestrictionLabel(row: Record<string, unknown>) {
  if (hasPredicateCode(row, 'WHILE_SOURCE_ATTUNED')) return 'While source attuned'
  if (hasPredicateCode(row, 'WHILE_SOURCE_EQUIPPED')) return 'While source equipped'
  if (hasPredicateCode(row, 'WHILE_SOURCE_CARRIED')) return 'While source carried'
  return undefined
}

function getResolvedOptionLabel(
  scope: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string,
  value: string | undefined
) {
  if (!value) return undefined
  for (const step of scope?.steps ?? []) {
    for (const section of step.sections) {
      for (const node of section.nodes) {
        if (node.kind === 'INPUT' && 'options' in node && node.id === nodeId) {
          return node.options.find((option) => option.value === value)?.label
        }
      }
    }
  }
  return undefined
}

function getOptionLabel(
  options: readonly { code: string; label: string }[],
  value: string | undefined
) {
  if (!value) return undefined
  return options.find((option) => option.code === value)?.label
}

function getRecordValue(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!isRecord(value)) return undefined
    return value[segment]
  }, record)
}

function hasPredicateCode(value: unknown, predicateCode: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasPredicateCode(item, predicateCode))
  if (!isRecord(value)) return false
  if (value.predicateCode === predicateCode) return true
  return Object.values(value).some((item) => hasPredicateCode(item, predicateCode))
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function formatEnumLabel(value: string | undefined): string | undefined {
  if (!value) return undefined
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function toSingularLabel(label: string) {
  const trimmed = label.trim()
  if (/ies$/i.test(trimmed)) return `${trimmed.slice(0, -3)}y`
  if (/ses$/i.test(trimmed)) return trimmed.slice(0, -2)
  if (/s$/i.test(trimmed)) return trimmed.slice(0, -1)
  return trimmed
}

function toTitleCase(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value
}

export function toCollectionDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}
