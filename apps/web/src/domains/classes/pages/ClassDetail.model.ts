import {
  escapeHtml,
  formatEnumLabel,
  formatGrantDetailLinesHtml,
  formatProficiencyGrantLines,
  formatReferenceLabel,
  formatReferenceList,
  formatStartingEquipmentLine,
  toDetailItems,
  type GrantDetailLine
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { characterProgressionCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import type { ClassResponseDto } from '@artificer-toolkit/schema/api/content'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'

type ClassReferences = Pick<
  AuthoredContentReferenceData,
  'currencies' | 'equipment' | 'languages' | 'skills'
>

export function buildClassDetailModel(
  classRecord: ClassAuthoringInputDto,
  references: ClassReferences
) {
  const startingEquipmentLine = formatStartingEquipmentLine(
    classRecord.startingEquipment,
    references
  )
  const startingGoldLine = formatStartingGoldLine(classRecord, references)
  const proficienciesHtml = formatGrantDetailLinesHtml(
    formatProficiencyGrantLines(classRecord.proficiencies, references)
  )
  const equipmentHtml = formatGrantDetailLinesHtml([
    ...(startingEquipmentLine ? [startingEquipmentLine] : []),
    ...(startingGoldLine ? [startingGoldLine] : [])
  ])
  const hitPointHtml = formatHitPointHtml(classRecord)
  const progressionHtml = formatClassProgressionHtml(classRecord)
  const multiclassHtml = formatMulticlassHtml(classRecord, references)
  const detailItems = toDetailItems(classRecord.details)
  const spellcastingItems = toDetailItems(classRecord.spellcasting?.details)
  const resourceItems = classRecord.resources
    ? [
        {
          id: classRecord.resources.id,
          title: classRecord.resources.label,
          meta: `Level ${classRecord.resources.availableAtLevel}`,
          description: classRecord.resources.description
        }
      ]
    : []
  const featureItems = [...(classRecord.features ?? [])]
    .filter((feature) => shouldShowFeature(classRecord, feature.label))
    .map((feature) => ({
      id: feature.id,
      title: feature.label,
      meta: feature.availableAtLevel ? `Level ${feature.availableAtLevel}` : undefined,
      description: feature.description
    }))

  return {
    description: classRecord.description,
    detailItems,
    equipmentHtml,
    featureItems,
    hitPointHtml,
    multiclassHtml,
    progressionHtml,
    proficienciesHtml,
    resourceItems,
    spellcastingItems,
    spellcastingTitle: classRecord.spellcasting?.magicName ?? 'Spellcasting'
  }
}

export type ClassDetailModel = ReturnType<typeof buildClassDetailModel>

export function getClassParentLabel(
  item: ClassAuthoringInputDto,
  response: ClassResponseDto
): string | null {
  if (item.category !== 'SUBCLASS' || !item.parentClassId) return null

  return (
    response?.meta?.classes?.find((option) => option.value === item.parentClassId)?.label ?? null
  )
}

function formatHitPointHtml(classRecord: ClassAuthoringInputDto): string {
  if (!classRecord.hitpoint) return ''

  const progression = characterProgressionCapabilityRegistry.require(classRecord.systemId)
  const dieSize = progression.hitDieSize(classRecord.hitpoint.dieConfig)
  const hitDie = dieSize ? `1d${dieSize}` : classRecord.hitpoint.dieConfig
  const average = dieSize ? progression.hitDieAverage(dieSize) : null
  const className = classRecord.label.toLowerCase()
  const ability = formatEnumLabel(progression.derivedStatisticAbilityCodes.hitPoints)

  return [
    `<p><strong>Hit Dice:</strong> ${hitDie} per ${escapeHtml(className)} level</p>`,
    dieSize
      ? `<p><strong>Hit Points at 1st Level:</strong> ${dieSize} + your ${escapeHtml(ability)} modifier</p>`
      : '',
    average
      ? `<p><strong>Hit Points at Higher Levels:</strong> ${hitDie} (or ${average}) + your ${escapeHtml(ability)} modifier per ${escapeHtml(className)} level after 1st</p>`
      : ''
  ]
    .filter(Boolean)
    .join('')
}

function formatMulticlassHtml(classRecord: ClassAuthoringInputDto, references: ClassReferences) {
  if (!classRecord.multiclass) return ''

  const requirementLine = formatMulticlassRequirementLine(classRecord)
  const proficiencyLines = formatProficiencyGrantLines(
    classRecord.multiclass.proficiencies,
    references
  )

  return formatGrantDetailLinesHtml([
    ...(requirementLine ? [requirementLine] : []),
    ...proficiencyLines
  ])
}

function formatMulticlassRequirementLine(
  classRecord: ClassAuthoringInputDto
): GrantDetailLine | null {
  const groups = classRecord.multiclass?.requirementGroups.groups ?? []
  const descriptions = groups
    .map((group) =>
      group.requirements
        .map((requirement) => `${formatEnumLabel(requirement.ability)} ${requirement.min}`)
        .join(' and ')
    )
    .filter(Boolean)

  if (!descriptions.length) return null

  return {
    id: 'multiclass-requirements',
    label: 'Requirements',
    description: descriptions.join(' or ')
  }
}

function formatClassProgressionHtml(classRecord: ClassAuthoringInputDto): string {
  if (!shouldShowProgression(classRecord)) return ''

  const maxLevel = getProgressionMaxLevel(classRecord)
  if (maxLevel <= 0) return ''

  const { proficiencyBonus } = characterProgressionCapabilityRegistry.require(classRecord.systemId)
  const rows = Array.from({ length: maxLevel }, (_, index) => index + 1)
  const spellLimitsByLevel = new Map(
    (classRecord.spellcasting?.spellLimits ?? []).map((limit) => [limit.classLevel, limit])
  )
  const firstSpellcastingLevel = Math.min(
    ...(classRecord.spellcasting?.spellLimits ?? []).map((limit) => limit.classLevel)
  )
  const hasSpellcasting = Boolean(classRecord.spellcasting)
  const spellSlotLevels = getProgressionSpellSlotLevels(classRecord)
  const spellCountHeader = getSpellCountHeader(classRecord)

  return [
    '<table data-detail-table="class-progression"><colgroup>',
    '<col style="width: 4.5rem">',
    classRecord.category === 'BASE' ? '<col style="width: 6.25rem">' : '',
    '<col style="min-width: 19rem">',
    hasSpellcasting ? '<col style="width: 5.5rem"><col style="width: 6.75rem">' : '',
    spellSlotLevels.map(() => '<col style="width: 3.75rem">').join(''),
    '</colgroup><thead>',
    spellSlotLevels.length
      ? [
          '<tr>',
          `<th data-progression-column="level" rowspan="2">Level</th>`,
          classRecord.category === 'BASE'
            ? '<th data-progression-column="proficiency" rowspan="2">Prof.</th>'
            : '',
          '<th data-progression-column="features" rowspan="2">Features</th>',
          hasSpellcasting
            ? `<th data-progression-column="number" rowspan="2">Cantrips</th><th data-progression-column="number" rowspan="2">${spellCountHeader}</th>`
            : '',
          `<th data-progression-column="slot-group" colspan="${spellSlotLevels.length}">Spell Slots per Spell Level</th>`,
          '</tr><tr>',
          spellSlotLevels
            .map(
              (spellLevel) => `<th data-progression-column="slot">${formatOrdinal(spellLevel)}</th>`
            )
            .join(''),
          '</tr>'
        ].join('')
      : [
          '<tr>',
          `<th data-progression-column="level">Level</th>`,
          classRecord.category === 'BASE'
            ? '<th data-progression-column="proficiency">Prof.</th>'
            : '',
          '<th data-progression-column="features">Features</th>',
          hasSpellcasting
            ? `<th data-progression-column="number">Cantrips</th><th data-progression-column="number">${spellCountHeader}</th>`
            : '',
          '</tr>'
        ].join(''),
    '</thead><tbody>',
    rows
      .map((level) => {
        const limit = spellLimitsByLevel.get(level)
        return [
          '<tr>',
          `<td data-progression-column="level">${formatOrdinal(level)}</td>`,
          classRecord.category === 'BASE'
            ? `<td data-progression-column="proficiency">+${proficiencyBonus(level)}</td>`
            : '',
          `<td data-progression-column="features">${escapeHtml(formatProgressionFeatures(classRecord, level, firstSpellcastingLevel))}</td>`,
          hasSpellcasting
            ? `<td data-progression-column="number">${limit?.cantripsLimit ?? '-'}</td><td data-progression-column="number">${formatSpellLimitCount(limit)}</td>`
            : '',
          spellSlotLevels
            .map(
              (spellLevel) =>
                `<td data-progression-column="slot">${formatSpellSlotCount(limit, spellLevel)}</td>`
            )
            .join(''),
          '</tr>'
        ].join('')
      })
      .join(''),
    '</tbody></table>'
  ].join('')
}

function shouldShowFeature(classRecord: ClassAuthoringInputDto, featureLabel: string): boolean {
  const spellcastingLabel = classRecord.spellcasting?.magicName ?? 'Spellcasting'
  if (featureLabel === spellcastingLabel) return false
  if (featureLabel === classRecord.resources?.label) return false

  return true
}

function shouldShowProgression(classRecord: ClassAuthoringInputDto): boolean {
  if (classRecord.category === 'BASE') return true

  return Boolean(classRecord.spellcasting || classRecord.resources)
}

function getProgressionMaxLevel(classRecord: ClassAuthoringInputDto): number {
  if (classRecord.category === 'BASE') return 20

  return Math.max(
    0,
    classRecord.resources?.availableAtLevel ?? 0,
    ...(classRecord.features ?? []).map((feature) => feature.availableAtLevel ?? 0),
    ...(classRecord.spellcasting?.spellLimits ?? []).map((limit) => limit.classLevel)
  )
}

function formatProgressionFeatures(
  classRecord: ClassAuthoringInputDto,
  level: number,
  firstSpellcastingLevel: number
): string {
  const labels = [
    ...(classRecord.spellcasting &&
    Number.isFinite(firstSpellcastingLevel) &&
    firstSpellcastingLevel === level
      ? [classRecord.spellcasting.magicName ?? 'Spellcasting']
      : []),
    ...(classRecord.resources?.availableAtLevel === level ? [classRecord.resources.label] : []),
    ...(classRecord.features ?? [])
      .filter(
        (feature) =>
          feature.availableAtLevel === level && shouldShowFeature(classRecord, feature.label)
      )
      .map((feature) => feature.label),
    ...(classRecord.specializations ?? [])
      .filter((specialization) => specialization.order === level)
      .map((specialization) => specialization.label),
    ...(classRecord.attributes ?? [])
      .filter(() => level === 1)
      .map((attribute) => formatReferenceList([attribute], 'attribute'))
  ]

  return labels.length ? labels.join(', ') : '-'
}

function formatSpellLimitCount(
  limit: NonNullable<ClassAuthoringInputDto['spellcasting']>['spellLimits'][number] | undefined
): string {
  if (!limit) return '-'
  if (limit.learnedSpellsLimit !== undefined) return String(limit.learnedSpellsLimit)
  if (limit.preparedSpellsLimit !== undefined) return String(limit.preparedSpellsLimit)

  return '-'
}

function getSpellCountHeader(classRecord: ClassAuthoringInputDto): string {
  const limits = classRecord.spellcasting?.spellLimits ?? []
  if (limits.some((limit) => limit.learnedSpellsLimit !== undefined)) return 'Known'
  if (limits.some((limit) => limit.preparedSpellsLimit !== undefined)) return 'Prepared'

  return 'Spells'
}

function getProgressionSpellSlotLevels(classRecord: ClassAuthoringInputDto): number[] {
  return Array.from(
    new Set(
      (classRecord.spellcasting?.spellLimits ?? []).flatMap((limit) =>
        limit.slots.map((slot) => slot.spellLevel)
      )
    )
  ).sort((first, second) => first - second)
}

function formatSpellSlotCount(
  limit: NonNullable<ClassAuthoringInputDto['spellcasting']>['spellLimits'][number] | undefined,
  spellLevel: number
): string {
  return String(limit?.slots.find((slot) => slot.spellLevel === spellLevel)?.slotCount ?? '-')
}

function formatOrdinal(value: number): string {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? 'th'
      : value % 10 === 1
        ? 'st'
        : value % 10 === 2
          ? 'nd'
          : value % 10 === 3
            ? 'rd'
            : 'th'

  return `${value}${suffix}`
}

function formatStartingGoldLine(
  classRecord: ClassAuthoringInputDto,
  references: Pick<AuthoredContentReferenceData, 'currencies'>
): GrantDetailLine | null {
  if (!classRecord.startingGold) return null

  const currencyLabel = formatReferenceLabel(
    classRecord.startingGold.currencyId,
    'currency',
    references.currencies
  )
    .replace('Gold Piece', 'gp')
    .replace('Silver Piece', 'sp')
    .replace('Copper Piece', 'cp')
    .replace('Electrum Piece', 'ep')
    .replace('Platinum Piece', 'pp')

  return {
    id: 'starting-gold',
    label: 'Starting Gold',
    description: `${classRecord.startingGold.dieConfig} x ${classRecord.startingGold.multiplier} ${currencyLabel}.`
  }
}
