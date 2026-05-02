import { useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import {
  backgroundAuthoredDtoSchema,
  type AuthoredDraftDto,
  type BackgroundAuthoredDto,
  type BackgroundResponseDto
} from '@artificer-toolkit/schema'
import {
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

export function BackgroundDetailPage({
  backgroundId,
  draft,
  response
}: {
  backgroundId: string
  draft: AuthoredDraftDto | null
  response: BackgroundResponseDto
}) {
  const navigate = useNavigate()
  const [viewActive, setViewActive] = useState(false)
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: backgroundAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    discard: api.content.backgrounds.discardDraft,
    domainLabel: 'Background',
    domainQueryKey: queryKeys.content.backgrounds.all(),
    duplicate: api.content.backgrounds.duplicate,
    id: backgroundId,
    navigateEdit: async (id) => navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId: id } }),
    navigateList: async () => navigate({ to: '/backgrounds' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <Stack>
        <Alert color='yellow'>This background draft cannot be previewed. Discard it to return to the background list.</Alert>
        <Button loading={actions.isDiscardingDraft} onClick={() => void actions.discardDraft({ backToList: true })}>
          Discard draft
        </Button>
      </Stack>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That background could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/backgrounds' })}>Back to backgrounds</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const pageActions = compactAuthoredDetailActions([
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/backgrounds/new' }) },
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId } }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/backgrounds/$backgroundId/edit', params: { backgroundId } }) }
        : null,
    detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      description={summarizeHtml(item.description, 'A background reference entry ready for table use.')}
      eyebrow='Background'
      facts={getBackgroundFacts(item)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Background',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => setViewActive(true),
        onViewDraft: () => setViewActive(false)
      })}
      sections={getBackgroundSections(item)}
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

function getBackgroundFacts(background: BackgroundAuthoredDto): AuthoredDetailFact[] {
  return [
    { label: 'Details', value: formatCount(background.details?.length, 'detail') },
    { label: 'Proficiencies', value: formatCount(background.proficiencies?.length, 'grant') },
    { label: 'Features', value: formatCount(background.features?.length, 'feature') },
    { label: 'Equipment', value: formatStartingEquipment(background) }
  ]
}

function getBackgroundSections(background: BackgroundAuthoredDto): AuthoredDetailSectionModel[] {
  return [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={background.description} />
    },
    {
      id: 'details',
      title: 'Details',
      content: <AuthoredDetailItemList empty='No background details have been added.' items={toDetailItems(background.details)} />
    },
    {
      id: 'proficiencies',
      title: 'Proficiencies',
      content: (
        <AuthoredDetailItemList
          empty='No proficiencies have been added.'
          items={(background.proficiencies ?? []).map((grant, index) => ({
            id: grant.id,
            title: formatEnumLabel(grant.proficiencyKind),
            meta: grant.selectionKind ? formatEnumLabel(grant.selectionKind) : `Grant ${index + 1}`,
            description: grant.count ? `${grant.count} choice${grant.count === 1 ? '' : 's'} configured.` : undefined
          }))}
        />
      )
    },
    {
      id: 'features',
      title: 'Features',
      content: <AuthoredDetailItemList empty='No background features have been added.' items={toDetailItems(background.features)} />
    },
    {
      id: 'starting-equipment',
      title: 'Starting Equipment',
      content: (
        <AuthoredDetailItemList
          empty='No starting equipment has been added.'
          items={(background.startingEquipment?.sets ?? []).map((set, index) => ({
            id: set.id,
            title: `Equipment set ${index + 1}`,
            meta: formatCount(set.groups.length, 'choice group')
          }))}
        />
      )
    }
  ]
}

function formatStartingEquipment(background: BackgroundAuthoredDto): string {
  const setCount = background.startingEquipment?.sets.length ?? 0
  return setCount ? formatCount(setCount, 'set') : 'None'
}
