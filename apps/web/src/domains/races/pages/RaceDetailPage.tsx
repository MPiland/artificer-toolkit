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
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  compactAuthoredDetailSections,
  escapeHtml,
  hasDetailText,
  resolveAuthoredDetailState,
  toDetailItems,
  useAuthoredDetailActions,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'

export function RaceDetailPage({
  draft,
  parentResponse,
  raceId,
  response,
  view
}: {
  draft: AuthoredDraftDto | null
  parentResponse?: RaceResponseDto | null
  raceId: string
  references: Pick<AuthoredContentReferenceData, 'speeds'>
  response: RaceResponseDto
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: raceAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    deleteActive: api.content.races.deleteActive,
    discard: api.content.races.discardDraft,
    detailSubjectQueryKey: queryKeys.content.races.detailRoot(raceId),
    domainLabel: 'Race',
    domainQueryKey: queryKeys.content.races.all(),
    draftQueryKey: queryKeys.content.races.draft(raceId),
    duplicate: api.content.races.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: raceId,
    navigateEdit: async (subject) => navigate({
      params: buildRaceRouteParams(subject.publicId, subject.label),
      to: '/races/$racePublicId/$raceSlug/edit'
    }),
    navigateList: async () => navigate({ to: '/races' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>This race draft cannot be previewed. Delete it to return to the race list.</Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() => actions.deleteContent({
              id: raceId,
              kind: 'draft',
              label: detailState.draft?.label ?? 'race draft'
            })}
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
        <Alert color='yellow'>That race could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/races' })}>Back to races</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const parentRace = parentResponse?.item?.category === 'BASE' ? parentResponse.item : null
  const raceParams = buildRaceRouteParams(draft?.publicId ?? response?.publicId ?? raceId, item.label)
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/races/$racePublicId/$raceSlug/edit', params: raceParams }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/races/$racePublicId/$raceSlug/edit', params: raceParams }) }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? { label: 'View Draft', tone: 'secondary', onClick: () => navigate({ to: '/races/$racePublicId/$raceSlug', params: raceParams, search: { view: 'draft' } }) }
      : null,
    detailState.mode === 'active' && !detailState.draft && detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, loading: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null,
    detailState.permissions.canDelete
      ? {
          label: 'Delete',
          tone: 'danger',
          disabled: actions.isDeleting,
          loading: actions.isDeleting,
          onClick: () => actions.deleteContent({
            id: raceId,
            kind: detailState.mode === 'draft' ? 'draft' : 'active',
            label: item.label
          })
        }
      : null,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/races/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        eyebrow='Race'
        facts={[]}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Race',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () => navigate({ to: '/races/$racePublicId/$raceSlug', params: raceParams }),
          onViewDraft: () => navigate({ to: '/races/$racePublicId/$raceSlug', params: raceParams, search: { view: 'draft' } })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getRaceSections(item, parentRace)}
        status={[
          ...buildDetailStatusLabels({
            draft: detailState.draft,
            mode: detailState.mode,
            provenance: detailState.provenance,
            status: item.status
          }),
          ...(isPlayableRace(item) ? ['Playable'] : [])
        ]}
        title={item.label}
      />
      {actions.deleteConfirmation}
    </>
  )
}

function getRaceSections(
  race: RaceAuthoredDto,
  parentRace?: Extract<RaceAuthoredDto, { category: 'BASE' }> | null
): AuthoredDetailSectionModel[] {
  const parentDetailItems = parentRace ? toDetailItems(parentRace.details) : []
  const detailItems = [
    ...parentDetailItems,
    ...toDetailItems(race.details)
  ]
  const parentFeatureItems = parentRace ? toDetailItems(parentRace.features) : []
  const featureItems = [
    ...parentFeatureItems,
    ...toDetailItems(race.features)
  ].map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description
  }))
  const descriptions = [
    parentRace?.description,
    race.description
  ].filter(hasDetailText)
  const ancestry = parentRace?.ancestry ?? (race.category === 'BASE' ? race.ancestry : undefined)

  return compactAuthoredDetailSections([
    descriptions.length ? {
      id: 'description',
      title: 'Description',
      content: (
        <Stack gap='md'>
          {descriptions.map((description, index) => (
            <AuthoredDetailProse html={description} fallback='' key={index} />
          ))}
        </Stack>
      )
    } : null,
    ancestry && hasAncestryContent(ancestry) ? {
      id: 'ancestry',
      title: 'Ancestry',
      content: <RaceAncestryContent ancestry={ancestry} />
    } : null,
    detailItems.length ? {
      id: 'details',
      title: 'Details',
      content: <AuthoredDetailItemList empty='No race details have been added.' items={detailItems} />
    } : null,
    featureItems.length ? {
      id: 'features',
      title: 'Features',
      content: <AuthoredDetailItemList empty='No race features have been added.' items={featureItems} />
    } : null
  ])
}

function isPlayableRace(race: RaceAuthoredDto): boolean {
  return race.category === 'SUBRACE' || race.selectionMode === 'DIRECT'
}

type RaceAncestry = NonNullable<Extract<RaceAuthoredDto, { category: 'BASE' }>['ancestry']>
type RaceAncestryOption = RaceAncestry['options'][number]

function RaceAncestryContent({ ancestry }: { ancestry: RaceAncestry }) {
  const optionsTableHtml = buildAncestryOptionsTableHtml(ancestry.options)
  const descriptionHtml = toParagraphHtml(ancestry.description)

  if (optionsTableHtml) {
    return <AuthoredDetailProse html={`${descriptionHtml}${optionsTableHtml}`} />
  }

  return (
    <Stack gap='md'>
      {descriptionHtml ? <AuthoredDetailProse html={descriptionHtml} fallback='' /> : null}
      <AuthoredDetailItemList
        empty='No ancestry options have been added.'
        items={ancestry.options.map((option) => ({
          id: option.id,
          title: option.label,
          description: option.description
        }))}
      />
    </Stack>
  )
}

function hasAncestryContent(ancestry: RaceAncestry): boolean {
  return hasDetailText(ancestry.description) || ancestry.options.length > 0
}

function buildAncestryOptionsTableHtml(options: RaceAncestryOption[]): string {
  const rows = options.map(parseDragonbornAncestryOption)

  if (rows.length < 4 || rows.some((row) => row === null)) {
    return ''
  }

  return `
    <table style="width: 100%">
      <colgroup>
        <col style="width: 28%" />
        <col style="width: 22%" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Dragon</th>
          <th scope="col">Damage Type</th>
          <th scope="col">Breath Weapon</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => row ? `
          <tr>
            <td>${escapeHtml(row.dragon)}</td>
            <td>${escapeHtml(row.damage)}</td>
            <td>${escapeHtml(row.breathWeapon)}</td>
          </tr>
        ` : '').join('')}
      </tbody>
    </table>
  `
}

function parseDragonbornAncestryOption(option: RaceAncestryOption): {
  breathWeapon: string
  damage: string
  dragon: string
} | null {
  const labelMatch = option.label.match(/^(.+?)\s*\((.+?)\)$/)
  const breathMarker = 'Breath weapon:'
  const breathMarkerIndex = option.description.toLowerCase().indexOf(breathMarker.toLowerCase())

  if (!labelMatch || breathMarkerIndex === -1) return null

  const breathWeapon = option.description
    .slice(breathMarkerIndex + breathMarker.length)
    .trim()
    .replace(/\.$/, '')

  return {
    breathWeapon,
    damage: labelMatch[2],
    dragon: labelMatch[1]
  }
}

function toParagraphHtml(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('<') ? trimmed : `<p>${escapeHtml(trimmed)}</p>`
}
