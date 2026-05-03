import {
  useState } from 'react'
import { Alert,
  Button,
  Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import {
  type AuthoredDraftDto,
  type FeatResponseDto
} from '@artificer-toolkit/schema/api/content'
import { type FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
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
  resolveAuthoredDetailState,
  summarizeHtml,
  toDetailItems,
  useAuthoredDetailActions,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function FeatDetailPage({
  draft,
  featId,
  response
}: {
  draft: AuthoredDraftDto | null
  featId: string
  response: FeatResponseDto
}) {
  const navigate = useNavigate()
  const [viewActive, setViewActive] = useState(false)
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: featAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    discard: api.content.feats.discardDraft,
    detailQueryKey: queryKeys.content.feats.detail(featId),
    domainLabel: 'Feat',
    domainQueryKey: queryKeys.content.feats.all(),
    draftQueryKey: queryKeys.content.feats.draft(featId),
    duplicate: api.content.feats.duplicate,
    hasActiveContent: Boolean(detailState.activeItem),
    id: featId,
    navigateEdit: async (id) => navigate({ to: '/feats/$featId/edit', params: { featId: id } }),
    navigateList: async () => navigate({ to: '/feats' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <Stack>
        <Alert color='yellow'>This feat draft cannot be previewed. Discard it to return to the feat list.</Alert>
        <Button loading={actions.isDiscardingDraft} onClick={() => void actions.discardDraft({ backToList: true })}>
          Discard draft
        </Button>
      </Stack>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That feat could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/feats' })}>Back to feats</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const pageActions = compactAuthoredDetailActions([
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/feats/new' }) },
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/feats/$featId/edit', params: { featId } }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/feats/$featId/edit', params: { featId } }) }
        : null,
    detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      description={summarizeHtml(item.description, 'A feat reference entry ready for table use.')}
      eyebrow='Feat'
      facts={getFeatFacts(item)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Feat',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => setViewActive(true),
        onViewDraft: () => setViewActive(false)
      })}
      sections={getFeatSections(item)}
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

function getFeatFacts(feat: FeatAuthoredDto): AuthoredDetailFact[] {
  return [
    { label: 'Requirements', value: feat.prerequisites ? 'Configured' : 'None' },
    { label: 'Effects', value: formatCount(feat.effects?.length, 'effect') },
    { label: 'Grants', value: formatCount(countFeatGrants(feat), 'grant') },
    { label: 'Features', value: formatCount(feat.features?.length, 'feature') }
  ]
}

function getFeatSections(feat: FeatAuthoredDto): AuthoredDetailSectionModel[] {
  return [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={feat.description} />
    },
    {
      id: 'requirements',
      title: 'Requirements',
      content: feat.prerequisites
        ? <AuthoredDetailEmptyBlock>Requirements are configured for this feat.</AuthoredDetailEmptyBlock>
        : <AuthoredDetailEmptyBlock>No requirements have been added.</AuthoredDetailEmptyBlock>
    },
    {
      id: 'mechanics',
      title: 'Mechanics',
      content: (
        <AuthoredDetailItemList
          empty='No mechanics have been added.'
          items={[
            ...(feat.detail ? [{ id: 'detail', title: 'Detail', description: feat.detail }] : []),
            ...(feat.charges ? [{ id: feat.charges.id, title: 'Charges', meta: formatEnumLabel(feat.charges.resetKind) }] : []),
            ...(feat.effects ?? []).map((effect, index) => ({
              id: effect.id,
              title: `Effect ${index + 1}`,
              meta: formatEnumLabel(effect.invocation.triggerCode),
              description: `${formatCount(effect.paths.length, 'outcome path')} configured.`
            }))
          ]}
        />
      )
    },
    {
      id: 'grants',
      title: 'Grants',
      content: (
        <AuthoredDetailItemList
          empty='No grants have been added.'
          items={getFeatGrantItems(feat)}
        />
      )
    },
    {
      id: 'features',
      title: 'Features',
      content: <AuthoredDetailItemList empty='No feat features have been added.' items={toDetailItems(feat.features)} />
    }
  ]
}

function countFeatGrants(feat: FeatAuthoredDto): number {
  const grants = feat.grants
  if (!grants) return 0

  return [
    grants.feats?.length ?? 0,
    grants.modifiers?.length ?? 0,
    grants.proficiencies?.length ?? 0,
    grants.senses?.length ?? 0,
    grants.spells?.length ?? 0
  ].reduce((total, count) => total + count, 0)
}

function getFeatGrantItems(feat: FeatAuthoredDto) {
  const grants = feat.grants
  if (!grants) return []

  return [
    ...(grants.feats ?? []).map((grant, index) => ({
      id: grant.id,
      title: 'Feat grant',
      meta: `Grant ${index + 1}`
    })),
    ...(grants.modifiers ?? []).map((grant, index) => ({
      id: grant.id,
      title: 'Modifier grant',
      meta: `Grant ${index + 1}`
    })),
    ...(grants.proficiencies ?? []).map((grant, index) => ({
      id: grant.id,
      title: formatEnumLabel(grant.proficiencyKind),
      meta: `Grant ${index + 1}`
    })),
    ...(grants.senses ?? []).map((grant, index) => ({
      id: grant.id,
      title: 'Sense grant',
      meta: `Grant ${index + 1}`
    })),
    ...(grants.spells ?? []).map((grant, index) => ({
      id: grant.id,
      title: 'Spell grant',
      meta: `Grant ${index + 1}`
    }))
  ]
}
