import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { classAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { type AuthoredDraftDto, type ClassResponseDto } from '@artificer-toolkit/schema/api/content'
import { type ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  compactAuthoredDetailSections,
  formatEnumLabel,
  formatGrantDetailLinesHtml,
  formatProficiencyGrantLines,
  formatReferenceLabel,
  formatReferenceList,
  formatStartingEquipmentLine,
  hasDetailText,
  resolveAuthoredDetailState,
  toDetailItems,
  useAuthoredDetailActions,
  useAuthoredExportAction,
  type GrantDetailLine,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildClassRouteParams } from '#app/routing/authoredRouteParams'

export function ClassDetailPage({
  classId,
  draft,
  references,
  response,
  view
}: {
  classId: string
  draft: AuthoredDraftDto | null
  references: Pick<
    AuthoredContentReferenceData,
    'currencies' | 'equipment' | 'languages' | 'skills'
  >
  response: ClassResponseDto
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState<ClassAuthoringInputDto>({
    draft,
    response,
    schema: classAuthoringInputDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: api.content.classes.deleteActive,
    discard: api.content.classes.discardDraft,
    detailSubjectQueryKey: queryKeys.content.classes.detailRoot(classId),
    domainLabel: 'Class',
    domainQueryKey: queryKeys.content.classes.all(),
    draftQueryKey: queryKeys.content.classes.draft(classId),
    duplicate: api.content.classes.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: classId,
    navigateEdit: async (subject) =>
      navigate({
        params: buildClassRouteParams(subject.publicId, subject.label),
        to: '/classes/$classPublicId/$classSlug/edit'
      }),
    navigateList: async () => navigate({ to: '/classes' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>
            This class draft cannot be previewed. Delete it to return to the class list.
          </Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() =>
              actions.deleteContent({
                id: classId,
                kind: 'draft',
                label: detailState.draft?.label ?? 'class draft'
              })
            }
          >
            Delete
          </Button>
        </Stack>
        {actions.deleteConfirmation}
      </>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That class could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/classes' })}>Back to classes</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const classParams = buildClassRouteParams(
    draft?.publicId ?? response?.publicId ?? classId,
    item.label
  )
  const exportAction = useAuthoredExportAction({
    canExport: detailState.provenance.kind === 'OWNED' && detailState.permissions.canEdit,
    id: classId,
    label: item.label,
    subjectKind: 'CLASS',
    view: detailState.mode === 'draft' ? 'draft' : 'active'
  })
  const parentClassLabel = getParentClassLabel(item, response)
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? {
          label: 'Resume Draft',
          tone: 'primary',
          onClick: () =>
            navigate({ to: '/classes/$classPublicId/$classSlug/edit', params: classParams })
        }
      : detailState.permissions.canEdit
        ? {
            label: 'Edit',
            tone: 'primary',
            onClick: () =>
              navigate({ to: '/classes/$classPublicId/$classSlug/edit', params: classParams })
          }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? {
          label: 'View Draft',
          tone: 'secondary',
          onClick: () =>
            navigate({
              to: '/classes/$classPublicId/$classSlug',
              params: classParams,
              search: { view: 'draft' }
            })
        }
      : null,
    detailState.mode === 'active' && !detailState.draft && detailState.permissions.canCopy
      ? {
          label: 'Duplicate',
          tone: 'secondary',
          disabled: actions.isDuplicating,
          loading: actions.isDuplicating,
          onClick: () => void actions.duplicateToDraft()
        }
      : null,
    detailState.permissions.canDelete
      ? {
          label: 'Delete',
          tone: 'danger',
          disabled: actions.isDeleting,
          loading: actions.isDeleting,
          onClick: () =>
            actions.deleteContent({
              id: classId,
              kind: detailState.mode === 'draft' ? 'draft' : 'active',
              label: item.label
            })
        }
      : null,
    exportAction,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/classes/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        eyebrow={item.category === 'SUBCLASS' ? 'Subclass' : 'Class'}
        facts={[]}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Class',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () =>
            navigate({ to: '/classes/$classPublicId/$classSlug', params: classParams }),
          onViewDraft: () =>
            navigate({
              to: '/classes/$classPublicId/$classSlug',
              params: classParams,
              search: { view: 'draft' }
            })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getClassSections(item, references)}
        status={buildDetailStatusLabels({
          draft: detailState.draft,
          mode: detailState.mode,
          provenance: detailState.provenance,
          status: item.status
        }).concat(parentClassLabel ? [`${parentClassLabel} subclass`] : [])}
        title={item.label}
      />
      {actions.deleteConfirmation}
    </>
  )
}

function getParentClassLabel(
  item: ClassAuthoringInputDto,
  response: ClassResponseDto
): string | null {
  if (item.category !== 'SUBCLASS' || !item.parentClassId) return null

  return (
    response?.meta?.classes?.find((option) => option.value === item.parentClassId)?.label ?? null
  )
}

function getClassSections(
  classRecord: ClassAuthoringInputDto,
  references: Pick<
    AuthoredContentReferenceData,
    'currencies' | 'equipment' | 'languages' | 'skills'
  >
): AuthoredDetailSectionModel[] {
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
  const featureItems = [
    ...(classRecord.features ?? [])
      .filter((feature) => shouldShowFeature(classRecord, feature.label))
      .map((feature) => ({
        id: feature.id,
        title: feature.label,
        meta: feature.availableAtLevel ? `Level ${feature.availableAtLevel}` : undefined,
        description: feature.description
      }))
  ]
  const spellcastingTitle = classRecord.spellcasting?.magicName ?? 'Spellcasting'

  return compactAuthoredDetailSections([
    hasDetailText(classRecord.description)
      ? {
          id: 'description',
          title: 'Description',
          content: <AuthoredDetailProse html={classRecord.description} />
        }
      : null,
    detailItems.length
      ? {
          id: 'details',
          title: 'Details',
          content: (
            <AuthoredDetailItemList empty='No class details have been added.' items={detailItems} />
          )
        }
      : null,
    hasDetailText(hitPointHtml)
      ? {
          id: 'hit-points',
          title: 'Hit Points',
          content: <AuthoredDetailProse html={hitPointHtml} />
        }
      : null,
    hasDetailText(proficienciesHtml)
      ? {
          id: 'proficiencies',
          title: 'Proficiencies',
          content: (
            <AuthoredDetailProse
              html={proficienciesHtml}
              fallback='No proficiencies have been added.'
            />
          )
        }
      : null,
    hasDetailText(equipmentHtml)
      ? {
          id: 'equipment',
          title: 'Equipment',
          content: (
            <AuthoredDetailProse
              html={equipmentHtml}
              fallback='No starting equipment has been added.'
            />
          )
        }
      : null,
    hasDetailText(progressionHtml)
      ? {
          id: 'progression',
          title: 'Progression',
          content: <AuthoredDetailProse html={progressionHtml} />
        }
      : null,
    spellcastingItems.length
      ? {
          id: 'spellcasting',
          title: spellcastingTitle,
          content: (
            <AuthoredDetailItemList
              empty='No spellcasting rules have been added.'
              items={spellcastingItems}
            />
          )
        }
      : null,
    resourceItems.length
      ? {
          id: 'resources',
          title: 'Resources',
          content: (
            <AuthoredDetailItemList empty='No resources have been added.' items={resourceItems} />
          )
        }
      : null,
    featureItems.length
      ? {
          id: 'features',
          title: 'Features',
          content: (
            <AuthoredDetailItemList empty='No features have been added.' items={featureItems} />
          )
        }
      : null,
    hasDetailText(multiclassHtml)
      ? {
          id: 'multiclass',
          title: 'Multiclass',
          content: <AuthoredDetailProse html={multiclassHtml} />
        }
      : null
  ])
}

function shouldShowFeature(classRecord: ClassAuthoringInputDto, featureLabel: string): boolean {
  const spellcastingLabel = classRecord.spellcasting?.magicName ?? 'Spellcasting'
  if (featureLabel === spellcastingLabel) return false
  if (featureLabel === classRecord.resources?.label) return false

  return true
}

function formatHitPointHtml(classRecord: ClassAuthoringInputDto): string {
  if (!classRecord.hitpoint) return ''

  const hitDie = normalizeHitDie(classRecord.hitpoint.dieConfig)
  const dieSize = parseHitDieSize(hitDie)
  const average = dieSize ? Math.floor(dieSize / 2) + 1 : null
  const className = classRecord.label.toLowerCase()
  const ability = formatEnumLabel(classRecord.hitpoint.ability)

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

function formatMulticlassHtml(
  classRecord: ClassAuthoringInputDto,
  references: Pick<
    AuthoredContentReferenceData,
    'currencies' | 'equipment' | 'languages' | 'skills'
  >
): string {
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
            ? `<td data-progression-column="proficiency">+${getProficiencyBonus(level)}</td>`
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

function normalizeHitDie(dieConfig: string): string {
  return dieConfig.startsWith('d') ? `1${dieConfig}` : dieConfig
}

function parseHitDieSize(hitDie: string): number | null {
  const match = /d(\d+)/i.exec(hitDie)
  return match ? Number(match[1]) : null
}

function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
