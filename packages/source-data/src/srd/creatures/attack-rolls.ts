import type { CreatureAuthored, FeatureBaseAuthored } from '@artificer-toolkit/shared'
import { v5 as uuidv5 } from 'uuid'
import { SRD_CREATURE_ATTACK_BONUSES } from './attack-bonuses.js'

const SRD_ATTACK_ROLL_NAMESPACE = '86ddb419-e8bf-42ab-bc2d-efb8878a4f97'

export function creatureAttackRollId(sourceId: string) {
  return uuidv5(`${sourceId}:attack-roll`, SRD_ATTACK_ROLL_NAMESPACE)
}

function withAttackRoll<TSource extends FeatureBaseAuthored>(source: TSource): TSource {
  const attackBonus = SRD_CREATURE_ATTACK_BONUSES.get(source.id)
  if (attackBonus === undefined) return source
  return {
    ...source,
    rollDefinitions: [
      ...(source.rollDefinitions ?? []),
      {
        id: creatureAttackRollId(source.id),
        label: `${source.label} attack`,
        kind: 'ATTACK',
        expression: { count: 1, die: 20, modifier: attackBonus },
        rollMode: 'NORMAL',
        chargeCost: null,
        order: (source.rollDefinitions?.length ?? 0) + 1
      }
    ]
  }
}

/** Adds each Feature's or option's authored ATTACK roll from its printed SRD attack bonus. */
export function applyCreatureAttackRolls(creature: CreatureAuthored): CreatureAuthored {
  return {
    ...creature,
    features: creature.features.map((feature) => {
      const withRoll = withAttackRoll(feature)
      return feature.options
        ? { ...withRoll, options: feature.options.map(withAttackRoll) }
        : withRoll
    })
  }
}
