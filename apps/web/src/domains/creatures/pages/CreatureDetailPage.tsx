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
import * as styles from './CreatureDetailPage.css'

type CreatureFeature = NonNullable<CreatureAuthoredDto['features']>[number]

const abilityOrder = [
  'STRENGTH',
  'DEXTERITY',
  'CONSTITUTION',
  'INTELLIGENCE',
  'WISDOM',
  'CHARISMA'
] as const

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
    deleteActive: api.content.creatures.deleteActive,
    discard: api.content.creatures.discardDraft,
    detailSubjectQueryKey: queryKeys.content.creatures.detailRoot(creatureId),
    domainLabel: 'Creature',
    domainQueryKey: queryKeys.content.creatures.all(),
    draftQueryKey: queryKeys.content.creatures.draft(creatureId),
    duplicate: api.content.creatures.duplicate,
    hasActiveContent: detailState.hasActiveContent,
    id: creatureId,
    navigateEdit: async (subject) => navigate({
      params: buildCreatureRouteParams(subject.publicId, subject.label),
      to: '/creatures/$creaturePublicId/$creatureSlug/edit'
    }),
    navigateList: async () => navigate({ to: '/creatures' })
  })

  if (detailState.mode === 'invalid-draft-only') {
    return (
      <>
        <Stack>
          <Alert color='yellow'>This creature draft cannot be previewed. Delete it to return to the creature list.</Alert>
          <Button
            color='red'
            loading={actions.isDeleting}
            onClick={() => actions.deleteContent({
              id: creatureId,
              kind: 'draft',
              label: detailState.draft?.label ?? 'creature draft'
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
      ? { label: 'Duplicate', tone: 'secondary', disabled: actions.isDuplicating, loading: actions.isDuplicating, onClick: () => void actions.duplicateToDraft() }
      : null,
    detailState.permissions.canDelete
      ? {
          label: 'Delete',
          tone: 'danger',
          disabled: actions.isDeleting,
          loading: actions.isDeleting,
          onClick: () => actions.deleteContent({
            id: creatureId,
            kind: detailState.mode === 'draft' ? 'draft' : 'active',
            label: item.label
          })
        }
      : null,
    { label: 'Create New', tone: 'secondary', onClick: () => navigate({ to: '/creatures/new' }) }
  ])

  return (
    <>
      <AuthoredDetailLayout
        actions={pageActions}
        actionsDisabled={actions.isDetailOperationPending}
        eyebrow='Creature'
        facts={getCreatureFacts(item, references)}
        notice={buildAuthoredDetailNotice({
          canViewActive: detailState.canViewActive,
          domainLabel: 'Creature',
          hasInvalidDraft: detailState.hasInvalidDraft,
          isViewingActive: viewActive,
          mode: detailState.mode,
          onDiscard: () => void actions.discardDraft(),
          onViewActive: () => navigate({ to: '/creatures/$creaturePublicId/$creatureSlug', params: creatureParams }),
          onViewDraft: () => navigate({ to: '/creatures/$creaturePublicId/$creatureSlug', params: creatureParams, search: { view: 'draft' } })
        })}
        pendingOperation={actions.pendingOperation}
        sections={getCreatureSections(item, references)}
        showSectionNav={false}
        status={buildDetailStatusLabels({
          draft: detailState.draft,
          mode: detailState.mode,
          provenance: detailState.provenance,
          status: item.status
        })}
        title={item.label}
      />
      {actions.deleteConfirmation}
    </>
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
  const legendaryActionFeature = creature.features?.find(isLegendaryActionFeature)
  const featureBuckets = getCreatureFeatureBuckets(creature.features, legendaryActionFeature)
  const actionItems = featureBuckets.actions
  const bonusActionItems = featureBuckets.bonusActions
  const reactionItems = featureBuckets.reactions
  const lairActionItems = featureBuckets.lairActions
  const profileItems = getCreatureProfileItems(creature)
  const traitItems = [
    ...toDetailItems(creature.details),
    ...featureBuckets.traits
  ]

  return compactAuthoredDetailSections([
    hasDetailText(creature.description) ? {
      id: 'description',
      title: 'Description',
      content: <AuthoredDetailProse html={creature.description} />
    } : null,
    {
      id: 'stats',
      title: 'Stats',
      content: <CreatureStats creature={creature} references={references} />
    },
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
    bonusActionItems.length ? {
      id: 'bonus-actions',
      title: 'Bonus Actions',
      content: <AuthoredDetailItemList empty='No bonus actions have been added.' items={bonusActionItems} />
    } : null,
    reactionItems.length ? {
      id: 'reactions',
      title: 'Reactions',
      content: <AuthoredDetailItemList empty='No reactions have been added.' items={reactionItems} />
    } : null,
    lairActionItems.length ? {
      id: 'lair-actions',
      title: 'Lair Actions',
      content: <AuthoredDetailItemList empty='No lair actions have been added.' items={lairActionItems} />
    } : null,
    legendaryActionFeature ? {
      id: 'legendary-actions',
      title: 'Legendary Actions',
      content: <LegendaryActionsContent feature={legendaryActionFeature} />
    } : null,
    featureBuckets.regionalEffects.length ? {
      id: 'regional-effects',
      title: 'Regional Effects',
      content: <AuthoredDetailItemList empty='No regional effects have been added.' items={featureBuckets.regionalEffects} />
    } : null,
    profileItems.length ? {
      id: 'profile',
      title: 'Profile',
      content: <AuthoredDetailItemList empty='No profile details have been added.' items={profileItems} />
    } : null,
    traitItems.length ? {
      id: 'traits',
      title: 'Traits',
      content: <AuthoredDetailItemList empty='No traits have been added.' items={traitItems} />
    } : null
  ])
}

function CreatureStats({
  creature,
  references
}: {
  creature: CreatureAuthoredDto
  references: Pick<AuthoredContentReferenceData, 'speeds'>
}) {
  return (
    <div className={styles.statBlock}>
      <div className={styles.abilityGrid}>
        {abilityOrder.map((ability) => {
          const value = creature.abilityScores[ability]

          return (
            <div className={styles.abilityCell} key={ability}>
              <span className={styles.abilityLabel}>{formatAbilityAbbreviation(ability)}</span>
              <strong className={styles.abilityScore}>{formatNumber(value)}</strong>
              <span className={styles.abilityModifier}>{formatAbilityModifier(value)}</span>
            </div>
          )
        })}
      </div>
      {creature.speeds.length ? (
        <div className={styles.speedGrid} aria-label='Speeds'>
          {creature.speeds.map((speed, index) => (
            <span className={styles.speedPill} key={`${speed.speedId}-${index}`}>
              <span>{formatReferenceLabel(speed.speedId, 'Speed', references.speeds)}</span>
              <strong>{speed.amount} {formatEnumLabel(speed.unit)}</strong>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function formatAbilityAbbreviation(ability: typeof abilityOrder[number]): string {
  switch (ability) {
    case 'STRENGTH':
      return 'STR'
    case 'DEXTERITY':
      return 'DEX'
    case 'CONSTITUTION':
      return 'CON'
    case 'INTELLIGENCE':
      return 'INT'
    case 'WISDOM':
      return 'WIS'
    case 'CHARISMA':
      return 'CHA'
  }
}

function formatAbilityModifier(score: number): string {
  const modifier = Math.floor((score - 10) / 2)
  return modifier >= 0 ? `+${modifier}` : String(modifier)
}

function isLegendaryActionFeature(feature: CreatureFeature) {
  return feature.section === 'LEGENDARY_ACTION'
}

function LegendaryActionsContent({
  feature
}: {
  feature: CreatureFeature
}) {
  const options = toDetailItems(feature.options).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description
  }))

  return (
    <Stack gap='md'>
      <AuthoredDetailProse html={feature.description} fallback='' />
      <AuthoredDetailItemList
        empty='No legendary action options have been added.'
        items={options}
      />
    </Stack>
  )
}

function getCreatureFeatureBuckets(
  features: CreatureAuthoredDto['features'],
  legendaryActionFeature: CreatureFeature | undefined
) {
  const buckets = {
    traits: [] as ReturnType<typeof toCreatureFeatureItem>[],
    actions: [] as ReturnType<typeof toCreatureFeatureItem>[],
    bonusActions: [] as ReturnType<typeof toCreatureFeatureItem>[],
    reactions: [] as ReturnType<typeof toCreatureFeatureItem>[],
    lairActions: [] as ReturnType<typeof toCreatureFeatureItem>[],
    regionalEffects: [] as ReturnType<typeof toCreatureFeatureItem>[]
  }

  for (const feature of features ?? []) {
    if (feature.id === legendaryActionFeature?.id) continue

    const item = toCreatureFeatureItem(feature)
    const section = getCreatureFeatureSection(feature)

    if (section === 'actions') {
      buckets.actions.push(item)
    } else if (section === 'bonusActions') {
      buckets.bonusActions.push(item)
    } else if (section === 'reactions') {
      buckets.reactions.push(item)
    } else if (section === 'lairActions') {
      buckets.lairActions.push(item)
    } else if (section === 'regionalEffects') {
      buckets.regionalEffects.push(item)
    } else {
      buckets.traits.push(item)
    }
  }

  return buckets
}

function toCreatureFeatureItem(feature: CreatureFeature) {
  return {
    id: feature.id,
    title: feature.label,
    description: feature.description
  }
}

function getCreatureFeatureSection(feature: CreatureFeature): 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'lairActions' | 'regionalEffects' {
  if (feature.section === 'ACTION') return 'actions'
  if (feature.section === 'BONUS_ACTION') return 'bonusActions'
  if (feature.section === 'REACTION') return 'reactions'
  if (feature.section === 'LAIR_ACTION') return 'lairActions'
  if (feature.section === 'REGIONAL_EFFECT') return 'regionalEffects'
  if (hasFeatureActivation(feature, 'REACTION')) return 'reactions'
  if (hasFeatureActivation(feature, 'BONUS_ACTION')) return 'bonusActions'
  if (hasFeatureActivation(feature, 'ACTION') || feature.label.toLowerCase() === 'multiattack') return 'actions'

  return 'traits'
}

function hasFeatureActivation(feature: CreatureFeature, activationCode: 'ACTION' | 'BONUS_ACTION' | 'REACTION') {
  return (feature.effects ?? []).some((effect) => (
    'activation' in effect.invocation && effect.invocation.activation.code === activationCode
  ))
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
