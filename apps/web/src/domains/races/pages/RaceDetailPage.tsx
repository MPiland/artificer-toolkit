import {
  useState } from 'react'
import { Alert,
  Button,
  Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import {
  type AuthoredDraftDto,
  type RaceResponseDto
} from '@artificer-toolkit/schema/api/content'
import { type RaceAuthoredDto } from '@artificer-toolkit/schema/subjects/race'
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
  formatReferenceLabel,
  formatReferenceLabelList,
  resolveAuthoredDetailState,
  summarizeHtml,
  toDetailItems,
  useAuthoredDetailActions,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function RaceDetailPage({
  draft,
  raceId,
  references,
  response
}: {
  draft: AuthoredDraftDto | null
  raceId: string
  references: Pick<AuthoredContentReferenceData, 'heritages' | 'races' | 'speeds'>
  response: RaceResponseDto
}) {
  const navigate = useNavigate()
  const [viewActive, setViewActive] = useState(false)
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: raceAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    discard: api.content.races.discardDraft,
    detailQueryKey: queryKeys.content.races.detail(raceId),
    domainLabel: 'Race',
    domainQueryKey: queryKeys.content.races.all(),
    draftQueryKey: queryKeys.content.races.draft(raceId),
    duplicate: api.content.races.duplicate,
    hasActiveContent: Boolean(detailState.activeItem),
    id: raceId,
    navigateEdit: async (id) => navigate({ to: '/races/$raceId/edit', params: { raceId: id } }),
    navigateList: async () => navigate({ to: '/races' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <Stack>
        <Alert color='yellow'>This race draft cannot be previewed. Discard it to return to the race list.</Alert>
        <Button loading={actions.isDiscardingDraft} onClick={() => void actions.discardDraft({ backToList: true })}>
          Discard draft
        </Button>
      </Stack>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That race could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/races' })}>Back to races</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const pageActions = compactAuthoredDetailActions([
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/races/new' }) },
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/races/$raceId/edit', params: { raceId } }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/races/$raceId/edit', params: { raceId } }) }
        : null,
    detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      description={summarizeHtml(item.description, 'A race reference entry ready for table use.')}
      eyebrow={item.category === 'SUBRACE' ? 'Subrace' : 'Race'}
      facts={getRaceFacts(item, references)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Race',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => setViewActive(true),
        onViewDraft: () => setViewActive(false)
      })}
      sections={getRaceSections(item, references)}
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

function getRaceFacts(
  race: RaceAuthoredDto,
  references: Pick<AuthoredContentReferenceData, 'heritages' | 'races'>
): AuthoredDetailFact[] {
  if (race.category === 'SUBRACE') {
    return [
      { label: 'Category', value: 'Subrace' },
      { label: 'Parent', value: formatReferenceLabel(race.parentRaceId, 'Parent race selected', references.races) },
      { label: 'Details', value: formatCount(race.details?.length, 'detail') },
      { label: 'Features', value: formatCount(race.features?.length, 'feature') }
    ]
  }

  return [
    { label: 'Category', value: 'Base Race' },
    { label: 'Selection', value: formatEnumLabel(race.selectionMode) },
    { label: 'Size', value: formatReference(race.size, 'Size selected') },
    { label: 'Speeds', value: formatCount(race.speeds.length, 'speed') },
    { label: 'Heritages', value: formatReferenceLabelList(race.heritageIds, 'heritage', references.heritages) },
    { label: 'Features', value: formatCount(race.features?.length, 'feature') }
  ]
}

function getRaceSections(
  race: RaceAuthoredDto,
  references: Pick<AuthoredContentReferenceData, 'speeds'>
): AuthoredDetailSectionModel[] {
  const sharedSections: AuthoredDetailSectionModel[] = [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={race.description} />
    },
    {
      id: 'details',
      title: 'Details',
      content: <AuthoredDetailItemList empty='No race details have been added.' items={toDetailItems(race.details)} />
    },
    {
      id: 'features',
      title: 'Features',
      content: <AuthoredDetailItemList empty='No race features have been added.' items={toDetailItems(race.features)} />
    }
  ]

  if (race.category === 'SUBRACE') {
    return [
      {
        id: 'lineage',
        title: 'Lineage',
        content: <AuthoredDetailEmptyBlock>Parent race content is inherited from the selected base race.</AuthoredDetailEmptyBlock>
      },
      ...sharedSections
    ]
  }

  return [
    ...sharedSections.slice(0, 1),
    {
      id: 'ancestry',
      title: 'Ancestry',
      content: race.ancestry
        ? (
            <AuthoredDetailItemList
              empty='No ancestry options have been added.'
              items={[
                {
                  id: race.ancestry.id,
                  title: race.ancestry.label,
                  description: race.ancestry.description
                },
                ...race.ancestry.options.map((option) => ({
                  id: option.id,
                  title: option.label,
                  meta: `Option ${option.order}`,
                  description: option.description
                }))
              ]}
            />
          )
        : <AuthoredDetailEmptyBlock>No ancestry has been added.</AuthoredDetailEmptyBlock>
    },
    {
      id: 'speeds',
      title: 'Speeds',
      content: (
        <AuthoredDetailItemList
          empty='No speeds have been added.'
          items={race.speeds.map((speed, index) => ({
            id: `${speed.speedId}-${index}`,
            title: formatReferenceLabel(speed.speedId, 'Speed', references.speeds),
            meta: `${speed.amount} ${formatEnumLabel(speed.unit)}`
          }))}
        />
      )
    },
    ...sharedSections.slice(1)
  ]
}
