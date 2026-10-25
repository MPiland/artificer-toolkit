import {
  formatEnumLabel,
  formatNumber,
  formatReference,
  formatReferenceLabel,
  formatReferenceLabelList,
  toDetailItems,
  type AuthoredDetailFact
} from '#components/AuthoredDetail'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { abilityScoreCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import type { CreatureAuthoredDto } from '@artificer-toolkit/schema/subjects/creature'

type CreatureFeature = NonNullable<CreatureAuthoredDto['features']>[number]
type CreatureReferences = Pick<
  AuthoredContentReferenceData,
  'challengeRatings' | 'conditionTypes' | 'creatureTypes' | 'damageTypes' | 'equipment' | 'speeds'
> & { abilities: Array<{ value: string; short: string }> }

export function buildCreatureDetailModel(
  creature: CreatureAuthoredDto,
  references: CreatureReferences,
  armorClass: number | null | undefined
) {
  const legendaryActionFeature = creature.features.find(isLegendaryActionFeature)
  const featureBuckets = getCreatureFeatureBuckets(creature.features, legendaryActionFeature)
  const { abilityModifier } = abilityScoreCapabilityRegistry.require(creature.systemId)

  return {
    actionItems: featureBuckets.actions,
    bonusActionItems: featureBuckets.bonusActions,
    defenseItems: [
      {
        id: 'damage-vulnerabilities',
        title: 'Damage Vulnerabilities',
        description: formatReferenceLabelList(
          creature.damageVulnerabilities,
          'damage type',
          references.damageTypes
        )
      },
      {
        id: 'damage-resistances',
        title: 'Damage Resistances',
        description: formatReferenceLabelList(
          creature.damageResistances,
          'damage type',
          references.damageTypes
        )
      },
      {
        id: 'damage-immunities',
        title: 'Damage Immunities',
        description: formatReferenceLabelList(
          creature.damageImmunities,
          'damage type',
          references.damageTypes
        )
      },
      {
        id: 'condition-immunities',
        title: 'Condition Immunities',
        description: formatReferenceLabelList(
          creature.conditionImmunities,
          'condition',
          references.conditionTypes
        )
      }
    ].filter((item) => item.description !== 'None'),
    description: creature.description,
    facts: getCreatureFacts(creature, references, armorClass),
    lairActionItems: featureBuckets.lairActions,
    legendaryActions: legendaryActionFeature
      ? {
          description: legendaryActionFeature.description,
          options: toDetailItems(legendaryActionFeature.options).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description
          }))
        }
      : null,
    profileItems: getCreatureProfileItems(creature, references),
    reactionItems: featureBuckets.reactions,
    regionalEffectItems: featureBuckets.regionalEffects,
    stats: {
      abilities: references.abilities.map((ability) => {
        const score = creature.abilityScores[ability.value] ?? 0

        return {
          abbreviation: ability.short,
          modifier: formatAbilityModifier(abilityModifier(score)),
          score: formatNumber(score)
        }
      }),
      speeds: creature.speeds.map((speed, index) => ({
        id: `${speed.speedId}-${index}`,
        amount: speed.amount,
        label: formatReferenceLabel(speed.speedId, 'Speed', references.speeds),
        unit: formatEnumLabel(speed.unit)
      }))
    },
    traitItems: [...toDetailItems(creature.details), ...featureBuckets.traits]
  }
}

export type CreatureDetailModel = ReturnType<typeof buildCreatureDetailModel>

function getCreatureFacts(
  creature: CreatureAuthoredDto,
  references: Pick<AuthoredContentReferenceData, 'challengeRatings' | 'creatureTypes'>,
  armorClass: number | null | undefined
): AuthoredDetailFact[] {
  return [
    { label: 'Category', value: formatEnumLabel(creature.category) },
    {
      label: 'Type',
      value: formatReferenceLabel(
        creature.creatureTypeId,
        'Creature type selected',
        references.creatureTypes
      )
    },
    { label: 'Size', value: formatReference(creature.size, 'Size selected') },
    { label: 'Armor Class', value: formatNumber(armorClass) },
    { label: 'Natural Armor Bonus', value: formatNumber(creature.naturalArmorBonus) },
    { label: 'Hit Points', value: formatNumber(creature.hitPoints) },
    {
      label: 'Challenge',
      value: formatReferenceLabel(
        creature.challengeRatingId,
        'Challenge selected',
        references.challengeRatings
      )
    }
  ]
}

function isLegendaryActionFeature(feature: CreatureFeature) {
  return feature.section === 'LEGENDARY_ACTION'
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

function getCreatureFeatureSection(
  feature: CreatureFeature
): 'traits' | 'actions' | 'bonusActions' | 'reactions' | 'lairActions' | 'regionalEffects' {
  if (feature.section === 'ACTION') return 'actions'
  if (feature.section === 'BONUS_ACTION') return 'bonusActions'
  if (feature.section === 'REACTION') return 'reactions'
  if (feature.section === 'LAIR_ACTION') return 'lairActions'
  if (feature.section === 'REGIONAL_EFFECT') return 'regionalEffects'
  if (hasFeatureActivation(feature, 'REACTION')) return 'reactions'
  if (hasFeatureActivation(feature, 'BONUS_ACTION')) return 'bonusActions'
  if (hasFeatureActivation(feature, 'ACTION') || feature.label.toLowerCase() === 'multiattack')
    return 'actions'

  return 'traits'
}

function hasFeatureActivation(
  feature: CreatureFeature,
  activationCode: 'ACTION' | 'BONUS_ACTION' | 'REACTION'
) {
  return (feature.effects ?? []).some(
    (effect) =>
      'activation' in effect.invocation && effect.invocation.activation.code === activationCode
  )
}

function getCreatureProfileItems(creature: CreatureAuthoredDto, references: CreatureReferences) {
  const featureLabels = new Map(creature.features.map((feature) => [feature.id, feature.label]))

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
    })),
    ...(creature.equipmentLoadout ?? []).map((entry) => ({
      id: `equipment-loadout-${entry.id}`,
      title: formatReferenceLabel(entry.equipmentId, 'Equipment', references.equipment),
      meta: [formatEnumLabel(entry.useState), entry.attuned ? 'Attuned' : null]
        .filter((value): value is string => value !== null)
        .join(' · '),
      description:
        entry.actionFeatureIds.length > 0
          ? `Bound actions: ${entry.actionFeatureIds
              .map((featureId) => featureLabels.get(featureId) ?? 'Action feature')
              .join(', ')}`
          : `${entry.quantity} item${entry.quantity === 1 ? '' : 's'}`
    }))
  ]
}

function formatAbilityModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : String(modifier)
}
