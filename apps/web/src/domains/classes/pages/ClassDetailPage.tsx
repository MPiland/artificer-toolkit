import { Alert,
  Button,
  Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { classAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import {
  type AuthoredDraftDto,
  type ClassResponseDto
} from '@artificer-toolkit/schema/api/content'
import { type ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  compactAuthoredDetailSections,
  formatCount,
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
  references: Pick<AuthoredContentReferenceData, 'currencies' | 'equipment' | 'languages' | 'skills'>
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
    discard: api.content.classes.discardDraft,
    detailQueryKey: queryKeys.content.classes.detail(classId),
    domainLabel: 'Class',
    domainQueryKey: queryKeys.content.classes.all(),
    draftQueryKey: queryKeys.content.classes.draft(classId),
    duplicate: api.content.classes.duplicate,
    hasActiveContent: Boolean(detailState.activeItem),
    id: classId,
    navigateEdit: async (subject) => navigate({
      params: buildClassRouteParams(subject.publicId, subject.label),
      to: '/classes/$classPublicId/$classSlug/edit'
    }),
    navigateList: async () => navigate({ to: '/classes' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <Stack>
        <Alert color='yellow'>This class draft cannot be previewed. Discard it to return to the class list.</Alert>
        <Button loading={actions.isDiscardingDraft} onClick={() => void actions.discardDraft({ backToList: true })}>
          Discard draft
        </Button>
      </Stack>
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
  const classParams = buildClassRouteParams(draft?.publicId ?? response?.publicId ?? classId, item.label)
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/classes/$classPublicId/$classSlug/edit', params: classParams }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/classes/$classPublicId/$classSlug/edit', params: classParams }) }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? { label: 'View Draft', tone: 'secondary', onClick: () => navigate({ to: '/classes/$classPublicId/$classSlug', params: classParams, search: { view: 'draft' } }) }
      : null,
    detailState.mode === 'active' && !detailState.draft && detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/classes/new' }) }
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      eyebrow={item.category === 'SUBCLASS' ? 'Subclass' : 'Class'}
      facts={[]}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Class',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => navigate({ to: '/classes/$classPublicId/$classSlug', params: classParams }),
        onViewDraft: () => navigate({ to: '/classes/$classPublicId/$classSlug', params: classParams, search: { view: 'draft' } })
      })}
      sections={getClassSections(item, references)}
      status={buildDetailStatusLabels({
        draft: detailState.draft,
        mode: detailState.mode,
        provenance: detailState.provenance,
        status: item.status
      })}
      title={item.label}
    />
  )
}

function getClassSections(
  classRecord: ClassAuthoringInputDto,
  references: Pick<AuthoredContentReferenceData, 'currencies' | 'equipment' | 'languages' | 'skills'>
): AuthoredDetailSectionModel[] {
  const startingEquipmentLine = formatStartingEquipmentLine(classRecord.startingEquipment, references)
  const startingGoldLine = formatStartingGoldLine(classRecord, references)
  const proficiencyEquipmentHtml = formatGrantDetailLinesHtml([
    ...formatProficiencyGrantLines(classRecord.proficiencies, references),
    ...(startingEquipmentLine ? [startingEquipmentLine] : []),
    ...(startingGoldLine ? [startingGoldLine] : [])
  ])
  const detailItems = toDetailItems(classRecord.details)
  const spellcastingItems = classRecord.spellcasting
    ? [
        {
          id: 'spellcasting-ability',
          title: 'Ability',
          description: classRecord.spellcasting.ability ? formatEnumLabel(classRecord.spellcasting.ability) : 'Not set'
        },
        {
          id: 'spellcasting-limits',
          title: 'Spell Limits',
          meta: formatCount(classRecord.spellcasting.spellLimits.length, 'level')
        },
        {
          id: classRecord.spellcasting.charges.id,
          title: 'Charges',
          meta: formatEnumLabel(classRecord.spellcasting.charges.resetKind)
        }
      ]
    : []
  const advancementItems = [
    ...(classRecord.features ?? []).map((feature) => ({
      id: feature.id,
      title: feature.label,
      meta: feature.availableAtLevel ? `Level ${feature.availableAtLevel}` : undefined,
      description: feature.description
    })),
    ...(classRecord.specializations ?? []).map((specialization) => ({
      id: specialization.id,
      title: specialization.label,
      meta: `Specialization ${specialization.order}`
    })),
    ...(classRecord.attributes ?? []).map((attribute) => ({
      id: attribute,
      title: formatReferenceList([attribute], 'attribute')
    }))
  ]
  const requirementItems = [
    ...(classRecord.hitpoint
      ? [
          {
            id: 'hitpoint',
            title: 'Hit Points',
            meta: classRecord.hitpoint.dieConfig,
            description: `${formatEnumLabel(classRecord.hitpoint.ability)} modifier applies.`
          }
        ]
      : []),
    ...(classRecord.multiclass
      ? [
          {
            id: classRecord.multiclass.id,
            title: 'Multiclass Requirements',
            meta: formatCount(classRecord.multiclass.requirementGroups.groups.length, 'group')
          }
        ]
      : [])
  ]

  return compactAuthoredDetailSections([
    hasDetailText(classRecord.description) ? {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={classRecord.description} />
    } : null,
    detailItems.length ? {
      id: 'details',
      title: 'Class Details',
      content: <AuthoredDetailItemList empty='No class details have been added.' items={detailItems} />
    } : null,
    hasDetailText(proficiencyEquipmentHtml) ? {
      id: 'proficiencies-equipment',
      title: 'Proficiencies & Equipment',
      content: <AuthoredDetailProse html={proficiencyEquipmentHtml} fallback='No proficiencies or equipment have been added.' />
    } : null,
    spellcastingItems.length ? {
      id: 'spellcasting',
      title: 'Spellcasting',
      content: <AuthoredDetailItemList empty='No spellcasting rules have been added.' items={spellcastingItems} />
    } : null,
    advancementItems.length ? {
      id: 'advancement',
      title: 'Advancement',
      content: <AuthoredDetailItemList empty='No advancement details have been added.' items={advancementItems} />
    } : null,
    requirementItems.length ? {
      id: 'requirements',
      title: 'Multiclass & Hit Points',
      content: <AuthoredDetailItemList empty='No multiclass or hit point rules have been added.' items={requirementItems} />
    } : null
  ])
}

function formatStartingGoldLine(
  classRecord: ClassAuthoringInputDto,
  references: Pick<AuthoredContentReferenceData, 'currencies'>
): GrantDetailLine | null {
  if (!classRecord.startingGold) return null

  const currencyLabel = formatReferenceLabel(classRecord.startingGold.currencyId, 'currency', references.currencies)
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
