import { useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import {
  creatureAuthoredDtoSchema,
  type AuthoredDraftDto,
  type CreatureAuthoredDto,
  type CreatureResponseDto
} from '@artificer-toolkit/schema'
import {
  AuthoredDetailItemList,
  AuthoredDetailLayout,
  AuthoredDetailProse,
  buildAuthoredDetailNotice,
  buildDetailStatusLabels,
  compactAuthoredDetailActions,
  formatEnumLabel,
  formatNumber,
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

export function CreatureDetailPage({
  creatureId,
  draft,
  response
}: {
  creatureId: string
  draft: AuthoredDraftDto | null
  response: CreatureResponseDto
}) {
  const navigate = useNavigate()
  const [viewActive, setViewActive] = useState(false)
  const detailState = resolveAuthoredDetailState({
    draft,
    response,
    schema: creatureAuthoredDtoSchema,
    viewActive
  })
  const actions = useAuthoredDetailActions({
    discard: api.content.creatures.discardDraft,
    domainLabel: 'Creature',
    domainQueryKey: queryKeys.content.creatures.all(),
    duplicate: api.content.creatures.duplicate,
    id: creatureId,
    navigateEdit: async (id) => navigate({ to: '/creatures/$creatureId/edit', params: { creatureId: id } }),
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
  const pageActions = compactAuthoredDetailActions([
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/creatures/new' }) },
    detailState.mode === 'draft'
      ? { label: 'Resume Draft', tone: 'primary', onClick: () => navigate({ to: '/creatures/$creatureId/edit', params: { creatureId } }) }
      : detailState.permissions.canEdit
        ? { label: 'Edit', tone: 'primary', onClick: () => navigate({ to: '/creatures/$creatureId/edit', params: { creatureId } }) }
        : null,
    detailState.permissions.canCopy
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null
  ])

  return (
    <AuthoredDetailLayout
      actions={pageActions}
      description={summarizeHtml(item.description, 'A creature reference entry ready for table use.')}
      eyebrow='Creature'
      facts={getCreatureFacts(item)}
      notice={buildAuthoredDetailNotice({
        canViewActive: Boolean(detailState.activeItem && detailState.draftItem),
        domainLabel: 'Creature',
        hasInvalidDraft: detailState.hasInvalidDraft,
        isViewingActive: viewActive,
        mode: detailState.mode,
        onDiscard: () => void actions.discardDraft(),
        onViewActive: () => setViewActive(true),
        onViewDraft: () => setViewActive(false)
      })}
      sections={getCreatureSections(item)}
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

function getCreatureFacts(creature: CreatureAuthoredDto): AuthoredDetailFact[] {
  return [
    { label: 'Category', value: formatEnumLabel(creature.category) },
    { label: 'Type', value: formatReference(creature.creatureTypeId, 'Creature type selected') },
    { label: 'Size', value: formatReference(creature.size, 'Size selected') },
    { label: 'Armor Class', value: formatNumber(creature.armorClass) },
    { label: 'Hit Points', value: formatNumber(creature.hitPoints) },
    { label: 'Challenge', value: formatReference(creature.challengeRatingId, 'Challenge selected') }
  ]
}

function getCreatureSections(creature: CreatureAuthoredDto): AuthoredDetailSectionModel[] {
  return [
    {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={creature.description} />
    },
    {
      id: 'stats',
      title: 'Stats',
      content: (
        <AuthoredDetailItemList
          empty='No stats have been added.'
          items={[
            ...Object.entries(creature.abilityScores).map(([ability, value]) => ({
              id: ability,
              title: formatEnumLabel(ability),
              meta: String(value)
            })),
            ...creature.speeds.map((speed, index) => ({
              id: `${speed.speedId}-${index}`,
              title: formatReference(speed.speedId, 'Speed'),
              meta: `${speed.amount} ${formatEnumLabel(speed.unit)}`
            }))
          ]}
        />
      )
    },
    {
      id: 'defenses',
      title: 'Defenses',
      content: (
        <AuthoredDetailItemList
          empty='No defenses have been added.'
          items={[
            {
              id: 'damage-vulnerabilities',
              title: 'Damage Vulnerabilities',
              description: formatReferenceList(creature.damageVulnerabilities, 'damage type')
            },
            {
              id: 'damage-resistances',
              title: 'Damage Resistances',
              description: formatReferenceList(creature.damageResistances, 'damage type')
            },
            {
              id: 'damage-immunities',
              title: 'Damage Immunities',
              description: formatReferenceList(creature.damageImmunities, 'damage type')
            },
            {
              id: 'condition-immunities',
              title: 'Condition Immunities',
              description: formatReferenceList(creature.conditionImmunities, 'condition')
            }
          ].filter((item) => item.description !== 'None')}
        />
      )
    },
    {
      id: 'actions',
      title: 'Actions',
      content: (
        <AuthoredDetailItemList
          empty='No actions have been added.'
          items={[
            ...toCreatureActionItems('Action', creature.actions),
            ...toCreatureActionItems('Bonus Action', creature.bonusActions),
            ...toCreatureActionItems('Reaction', creature.reactions),
            ...toCreatureActionItems('Lair Action', creature.lairProfile?.lairActions)
          ]}
        />
      )
    },
    {
      id: 'profile',
      title: 'Profile',
      content: <AuthoredDetailItemList empty='No profile details have been added.' items={getCreatureProfileItems(creature)} />
    },
    {
      id: 'details',
      title: 'Details & Features',
      content: (
        <AuthoredDetailItemList
          empty='No creature details or features have been added.'
          items={[
            ...toDetailItems(creature.details),
            ...toDetailItems(creature.features)
          ]}
        />
      )
    }
  ]
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
