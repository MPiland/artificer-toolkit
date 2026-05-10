import {
  useState } from 'react'
import { Alert,
  Button,
  Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import {
  type AuthoredDraftDto,
  type SpellResponseDto
} from '@artificer-toolkit/schema/api/content'
import { type SpellAuthoredDto } from '@artificer-toolkit/schema/subjects/spell'
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
  formatNumber,
  formatReferenceLabel,
  formatReferenceLabelList,
  resolveAuthoredDetailState,
  summarizeHtml,
  useAuthoredDetailActions,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { SpellReferenceData } from '#app/data/spells/referenceData'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function SpellDetailPage({
  draft,
  references,
  response,
  spellId
}: {
  draft: AuthoredDraftDto | null
  references: SpellReferenceData
  response: SpellResponseDto
  spellId: string
}) {
  const navigate = useNavigate()
  const [viewActive, setViewActive] = useState(false)
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: spellAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    discard: api.content.spells.discardDraft,
    detailQueryKey: queryKeys.content.spells.detail(spellId),
    domainLabel: 'Spell',
    domainQueryKey: queryKeys.content.spells.all(),
    draftQueryKey: queryKeys.content.spells.draft(spellId),
    duplicate: api.content.spells.duplicate,
    hasActiveContent: Boolean(detailState.activeItem),
    id: spellId,
    navigateEdit: async (id) => navigate({ to: '/spells/$spellId/edit', params: { spellId: id } }),
    navigateList: async () => navigate({ to: '/spells' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <Stack>
        <Alert color='yellow'>This spell draft cannot be previewed. Discard it to return to the spell list.</Alert>
        <Button loading={actions.isDiscardingDraft} onClick={() => void actions.discardDraft({ backToList: true })}>
          Discard draft
        </Button>
      </Stack>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That spell could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/spells' })}>Back to spells</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const pageActions = compactAuthoredDetailActions([
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/spells/new' }) },
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/spells/$spellId/edit', params: { spellId } }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/spells/$spellId/edit', params: { spellId } }) }
        : null,
    detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      description={summarizeHtml(item.description, 'A spell reference entry ready for table use.')}
      eyebrow='Spell'
      facts={getSpellFacts(item, references)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Spell',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => setViewActive(true),
        onViewDraft: () => setViewActive(false)
      })}
      sections={getSpellSections(item)}
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

function getSpellFacts(spell: SpellAuthoredDto, references: SpellReferenceData): AuthoredDetailFact[] {
  return [
    { label: 'Level', value: spell.level === 0 ? 'Cantrip' : formatNumber(spell.level) },
    { label: 'School', value: formatReferenceLabel(spell.magicSchoolId, 'Magic school selected', references.magicSchools) },
    { label: 'Casting', value: `${spell.castingTime.amount} ${formatEnumLabel(spell.castingTime.unit)}` },
    { label: 'Components', value: spell.components?.map(formatEnumLabel).join(', ') || 'None' },
    { label: 'Classes', value: formatReferenceLabelList(spell.classIds, 'class', references.classes) },
    { label: 'Effects', value: formatCount(spell.effects?.length, 'effect') }
  ]
}

function getSpellSections(spell: SpellAuthoredDto): AuthoredDetailSectionModel[] {
  return [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={spell.description} />
    },
    {
      id: 'materials',
      title: 'Materials',
      content: spell.materialDescription
        ? <AuthoredDetailProse html={spell.materialDescription} />
        : <AuthoredDetailEmptyBlock>No material notes have been added.</AuthoredDetailEmptyBlock>
    },
    {
      id: 'effects',
      title: 'Effects',
      content: (
        <AuthoredDetailItemList
          empty='No effect mechanics have been added.'
          items={(spell.effects ?? []).map((effect, index) => ({
            id: effect.id,
            title: `Effect ${index + 1}`,
            meta: formatEnumLabel(effect.invocation.triggerCode),
            description: `${formatCount(effect.paths.length, 'outcome path')} configured.`
          }))}
        />
      )
    }
  ]
}
