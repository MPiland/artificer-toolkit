import { Alert,
  Button,
  Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import {
  type AuthoredDraftDto,
  type CreatureResponseDto
} from '@artificer-toolkit/schema/api/content'
import { type CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  compactAuthoredDetailSections,
  formatEnumLabel,
  formatNumber,
  formatReference,
  formatReferenceLabel,
  formatReferenceLabelList,
  hasDetailText,
  resolveAuthoredDetailState,
  toDetailItems,
  useAuthoredDetailActions,
  type AuthoredDetailFact,
  type AuthoredDetailSectionModel
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'

export function CreatureDetailPage({
  creatureId,
  draft,
  references,
  response,
  view
}: {
  creatureId: string
  draft: AuthoredDraftDto | null
  references: Pick<AuthoredContentReferenceData, 'challengeRatings' | 'conditionTypes' | 'creatureTypes' | 'damageTypes' | 'speeds'>
  response: CreatureResponseDto
  view: 'active' | 'draft'
}) {
  const navigate = useNavigate()
  const viewActive = view === 'active'
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: creatureAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    discard: api.content.creatures.discardDraft,
    detailQueryKey: queryKeys.content.creatures.detail(creatureId),
    domainLabel: 'Creature',
    domainQueryKey: queryKeys.content.creatures.all(),
    draftQueryKey: queryKeys.content.creatures.draft(creatureId),
    duplicate: api.content.creatures.duplicate,
    hasActiveContent: Boolean(detailState.activeItem),
    id: creatureId,
    navigateEdit: async (subject) => navigate({
      params: buildCreatureRouteParams(subject.publicId, subject.label),
      to: '/creatures/$creaturePublicId/$creatureSlug/edit'
    }),
    navigateList: async () => navigate({ to: '/creatures' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <Stack>
        <Alert color='yellow'>This creature draft cannot be previewed. Discard it to return to the creature list.</Alert>
        <Button loading={actions.isDiscardingDraft} onClick={() => void actions.discardDraft({ backToList: true })}>
          Discard draft
        </Button>
      </Stack>
    )
  }

  if (!detailState.item) {
    return (
      <Stack>
        <Alert color='yellow'>That creature could not be found.</Alert>
        <Button onClick={() => navigate({ to: '/creatures' })}>Back to creatures</Button>
      </Stack>
    )
  }

  const item = detailState.item
  const creatureParams = buildCreatureRouteParams(draft?.publicId ?? response?.publicId ?? creatureId, item.label)
  const pageActions = compactAuthoredDetailActions([
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/creatures/$creaturePublicId/$creatureSlug/edit', params: creatureParams }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/creatures/$creaturePublicId/$creatureSlug/edit', params: creatureParams }) }
        : null,
    detailState.mode === 'active' && detailState.draft
      ? { label: 'View Draft', tone: 'secondary', onClick: () => navigate({ to: '/creatures/$creaturePublicId/$creatureSlug', params: creatureParams, search: { view: 'draft' } }) }
      : null,
    detailState.mode === 'active' && !detailState.draft && detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/creatures/new' }) }
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      eyebrow='Creature'
      facts={getCreatureFacts(item, references)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Creature',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => navigate({ to: '/creatures/$creaturePublicId/$creatureSlug', params: creatureParams }),
        onViewDraft: () => navigate({ to: '/creatures/$creaturePublicId/$creatureSlug', params: creatureParams, search: { view: 'draft' } })
      })}
      sections={getCreatureSections(item, references)}
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

function getCreatureFacts(
  creature: CreatureAuthoredDto,
  references: Pick<AuthoredContentReferenceData, 'challengeRatings' | 'creatureTypes'>
): AuthoredDetailFact[] {
  return [
    { label: 'Category', value: formatEnumLabel(creature.category) },
    { label: 'Type', value: formatReferenceLabel(creature.creatureTypeId, 'Creature type selected', references.creatureTypes) },
    { label: 'Size', value: formatReference(creature.size, 'Size selected') },
    { label: 'Armor Class', value: formatNumber(creature.armorClass) },
    { label: 'Hit Points', value: formatNumber(creature.hitPoints) },
    { label: 'Challenge', value: formatReferenceLabel(creature.challengeRatingId, 'Challenge selected', references.challengeRatings) }
  ]
}

function getCreatureSections(
  creature: CreatureAuthoredDto,
  references: Pick<AuthoredContentReferenceData, 'conditionTypes' | 'damageTypes' | 'speeds'>
): AuthoredDetailSectionModel[] {
  const statItems = [
    ...Object.entries(creature.abilityScores).map(([ability, value]) => ({
      id: ability,
      title: formatEnumLabel(ability),
      meta: String(value)
    })),
    ...creature.speeds.map((speed, index) => ({
      id: `${speed.speedId}-${index}`,
      title: formatReferenceLabel(speed.speedId, 'Speed', references.speeds),
      meta: `${speed.amount} ${formatEnumLabel(speed.unit)}`
    }))
  ]
  const defenseItems = [
    {
      id: 'damage-vulnerabilities',
      title: 'Damage Vulnerabilities',
      description: formatReferenceLabelList(creature.damageVulnerabilities, 'damage type', references.damageTypes)
    },
    {
      id: 'damage-resistances',
      title: 'Damage Resistances',
      description: formatReferenceLabelList(creature.damageResistances, 'damage type', references.damageTypes)
    },
    {
      id: 'damage-immunities',
      title: 'Damage Immunities',
      description: formatReferenceLabelList(creature.damageImmunities, 'damage type', references.damageTypes)
    },
    {
      id: 'condition-immunities',
      title: 'Condition Immunities',
      description: formatReferenceLabelList(creature.conditionImmunities, 'condition', references.conditionTypes)
    }
  ].filter((item) => item.description !== 'None')
  const actionItems = [
    ...toCreatureActionItems('Action', creature.actions),
    ...toCreatureActionItems('Bonus Action', creature.bonusActions),
    ...toCreatureActionItems('Reaction', creature.reactions),
    ...toCreatureActionItems('Lair Action', creature.lairProfile?.lairActions)
  ]
  const profileItems = getCreatureProfileItems(creature)
  const detailItems = [
    ...toDetailItems(creature.details),
    ...toDetailItems(creature.features).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description
    }))
  ]

  return compactAuthoredDetailSections([
    hasDetailText(creature.description) ? {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={creature.description} />
    } : null,
    statItems.length ? {
      id: 'stats',
      title: 'Stats',
      content: <AuthoredDetailItemList empty='No stats have been added.' items={statItems} />
    } : null,
    defenseItems.length ? {
      id: 'defenses',
      title: 'Defenses',
      content: <AuthoredDetailItemList empty='No defenses have been added.' items={defenseItems} />
    } : null,
    actionItems.length ? {
      id: 'actions',
      title: 'Actions',
      content: <AuthoredDetailItemList empty='No actions have been added.' items={actionItems} />
    } : null,
    profileItems.length ? {
      id: 'profile',
      title: 'Profile',
      content: <AuthoredDetailItemList empty='No profile details have been added.' items={profileItems} />
    } : null,
    detailItems.length ? {
      id: 'details',
      title: 'Details & Features',
      content: <AuthoredDetailItemList empty='No creature details or features have been added.' items={detailItems} />
    } : null
  ])
}

function toCreatureActionItems(
  label: string,
  actions: CreatureAuthoredDto['actions']
) {
  return (actions ?? []).map((action) => ({
    id: action.id,
    title: action.label,
    meta: label,
    description: action.description
  }))
}

function getCreatureProfileItems(creature: CreatureAuthoredDto) {
  return [
    ...(creature.npcProfile?.personalityTraits ?? []).map((trait, index) => ({
      id: `personality-${index}`,
      title: 'Personality Trait',
      description: trait
    })),
    ...(creature.npcProfile?.ideals ?? []).map((ideal, index) => ({
      id: `ideal-${index}`,
      title: 'Ideal',
      description: ideal
    })),
    ...(creature.npcProfile?.bonds ?? []).map((bond, index) => ({
      id: `bond-${index}`,
      title: 'Bond',
      description: bond
    })),
    ...(creature.npcProfile?.flaws ?? []).map((flaw, index) => ({
      id: `flaw-${index}`,
      title: 'Flaw',
      description: flaw
    })),
    ...(creature.mountProfile
      ? [
          {
            id: 'mount-profile',
            title: 'Mount Profile',
            meta: formatEnumLabel(creature.mountProfile.mountType),
            description: creature.mountProfile.notes
          }
        ]
      : []),
    ...(creature.companionProfile
      ? [
          {
            id: 'companion-profile',
            title: 'Companion Profile',
            meta: formatEnumLabel(creature.companionProfile.bondType),
            description: creature.companionProfile.notes
          }
        ]
      : []),
    ...(creature.logisticsNotes ?? []).map((note, index) => ({
      id: `logistics-${index}`,
      title: 'Logistics Note',
      description: note
    }))
  ]
}
