import { useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import {
  classAuthoringInputDtoSchema,
  type AuthoredDraftDto,
  type ClassAuthoringInputDto,
  type ClassResponseDto
} from '@artificer-toolkit/schema'
import {
  AuthoredDetailEmptyBlock,
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  formatCount,
  formatEnumLabel,
  formatReference,
  formatReferenceList,
  resolveAuthoredDetailState,
  summarizeHtml,
  toDetailItems,
  useAuthoredDetailActions,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function ClassDetailPage({
  classId,
  draft,
  response
}: {
  classId: string
  draft: AuthoredDraftDto | null
  response: ClassResponseDto
}) {
  const navigate = useNavigate()
  const [viewActive, setViewActive] = useState(false)
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
    navigateEdit: async (id) => navigate({ to: '/classes/$classId/edit', params: { classId: id } }),
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
  const pageActions = compactAuthoredDetailActions([
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/classes/new' }) },
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/classes/$classId/edit', params: { classId } }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/classes/$classId/edit', params: { classId } }) }
        : null,
    detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      description={summarizeHtml(item.description, 'A class reference entry ready for table use.')}
      eyebrow={item.category === 'SUBCLASS' ? 'Subclass' : 'Class'}
      facts={getClassFacts(item)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Class',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => setViewActive(true),
        onViewDraft: () => setViewActive(false)
      })}
      sections={getClassSections(item)}
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

function getClassFacts(classRecord: ClassAuthoringInputDto): AuthoredDetailFact[] {
  return [
    { label: 'Category', value: classRecord.category ? formatEnumLabel(classRecord.category) : 'Uncategorized Draft' },
    { label: 'Parent', value: classRecord.category === 'SUBCLASS' ? formatReference(classRecord.parentClassId, 'Parent class selected') : 'None' },
    { label: 'Proficiencies', value: formatCount(classRecord.proficiencies?.length, 'grant') },
    { label: 'Features', value: formatCount(classRecord.features?.length, 'feature') },
    { label: 'Spellcasting', value: classRecord.spellcasting ? 'Configured' : 'None' },
    { label: 'Resources', value: classRecord.resources ? 'Configured' : 'None' }
  ]
}

function getClassSections(classRecord: ClassAuthoringInputDto): AuthoredDetailSectionModel[] {
  return [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={classRecord.description} />
    },
    {
      id: 'details',
      title: 'Class Details',
      content: <AuthoredDetailItemList empty='No class details have been added.' items={toDetailItems(classRecord.details)} />
    },
    {
      id: 'proficiencies-equipment',
      title: 'Proficiencies & Equipment',
      content: (
        <AuthoredDetailItemList
          empty='No proficiencies or equipment have been added.'
          items={[
            ...(classRecord.proficiencies ?? []).map((grant, index) => ({
              id: grant.id,
              title: formatEnumLabel(grant.proficiencyKind),
              meta: grant.selectionKind ? formatEnumLabel(grant.selectionKind) : `Grant ${index + 1}`,
              description: grant.count ? `${grant.count} choice${grant.count === 1 ? '' : 's'} configured.` : undefined
            })),
            ...(classRecord.startingEquipment?.sets ?? []).map((set, index) => ({
              id: set.id,
              title: `Equipment set ${index + 1}`,
              meta: formatCount(set.groups.length, 'choice group')
            })),
            ...(classRecord.startingGold
              ? [
                  {
                    id: 'starting-gold',
                    title: 'Starting Gold',
                    meta: classRecord.startingGold.dieConfig,
                    description: `${classRecord.startingGold.multiplier}x currency roll configured.`
                  }
                ]
              : [])
          ]}
        />
      )
    },
    {
      id: 'spellcasting',
      title: 'Spellcasting',
      content: classRecord.spellcasting
        ? (
            <AuthoredDetailItemList
              empty='No spellcasting rules have been added.'
              items={[
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
              ]}
            />
          )
        : <AuthoredDetailEmptyBlock>No spellcasting rules have been added.</AuthoredDetailEmptyBlock>
    },
    {
      id: 'advancement',
      title: 'Advancement',
      content: (
        <AuthoredDetailItemList
          empty='No advancement details have been added.'
          items={[
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
          ]}
        />
      )
    },
    {
      id: 'requirements',
      title: 'Multiclass & Hit Points',
      content: (
        <AuthoredDetailItemList
          empty='No multiclass or hit point rules have been added.'
          items={[
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
          ]}
        />
      )
    }
  ]
}
