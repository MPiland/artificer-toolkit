import { srdWolf as wolf } from './srdCreatures'
import { reactionBinding } from './reactionBinding'

export const automaticChargedCreatureId = '00000000-0000-4000-8000-0000000008a0'
export const automaticChargedBiteFeatureId = '00000000-0000-4000-8000-0000000008a1'
export const automaticChargedBiteEffectId = '00000000-0000-4000-8000-0000000008a2'
const chargeId = '00000000-0000-4000-8000-0000000008a3'
export const cutoverWorkloadActionFeatureId = '00000000-0000-4000-8000-0000000008b1'
export const cutoverWorkloadActionEffectId = '00000000-0000-4000-8000-0000000008b2'
export const cutoverWorkloadBonusActionFeatureId = '00000000-0000-4000-8000-0000000008b3'
export const cutoverWorkloadBonusActionEffectId = '00000000-0000-4000-8000-0000000008b4'
export const cutoverWorkloadReactionFeatureId = '00000000-0000-4000-8000-0000000008b5'
export const cutoverWorkloadReactionEffectId = '00000000-0000-4000-8000-0000000008b6'
const cutoverWorkloadReactionRollId = '00000000-0000-4000-8000-0000000008b7'

const bite = (() => {
  const feature = wolf.features?.find((candidate) => candidate.label === 'Bite')
  if (!feature) throw new Error('The V14 action fixture requires the SRD Wolf Bite Feature.')
  return feature
})()

export const automaticChargedCreature = {
  ...wolf,
  id: automaticChargedCreatureId,
  label: 'V14 action creature',
  features: wolf.features?.map((feature) =>
    feature.id !== bite.id
      ? feature
      : {
          ...feature,
          id: automaticChargedBiteFeatureId,
          charges: {
            id: chargeId,
            limitKind: 'FIXED_AMOUNT' as const,
            scalingKind: 'NONE' as const,
            resetKind: 'MANUAL' as const,
            amount: 1
          },
          effects: feature.effects?.slice(0, 1).map((effect) => ({
            ...effect,
            id: automaticChargedBiteEffectId,
            invocation: {
              ...effect.invocation,
              triggerCode: 'ACTIVATED' as const,
              range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const
              },
              resourceUse: { chargeId, cost: 1 }
            },
            paths: effect.paths?.slice(0, 1).map((path) =>
              'resultBlock' in path
                ? {
                    ...path,
                    pathCode: 'ON_USE' as const,
                    resultBlock: {
                      ...path.resultBlock,
                      outcomes: path.resultBlock.outcomes.map((outcome) =>
                        outcome.effectKind === 'DAMAGE' && outcome.damageTypeId !== undefined
                          ? {
                              id: outcome.id,
                              effectKind: 'DAMAGE' as const,
                              damageTypeId: outcome.damageTypeId,
                              valueKind: 'FIXED' as const,
                              scalingKind: 'NONE' as const,
                              amount: 1
                            }
                          : outcome
                      )
                    }
                  }
                : path
            )
          }))
        }
  )
}
function fixedDamagePaths(pathCode: 'ON_USE' | 'ON_HIT' | 'ON_MISS' | 'ON_CRIT') {
  return bite.effects?.[0]?.paths
    ?.filter(
      (path) =>
        'resultBlock' in path &&
        path.resultBlock.outcomes.some((outcome) => outcome.effectKind === 'DAMAGE')
    )
    .slice(0, 1)
    .map((path) =>
      'resultBlock' in path
        ? {
            ...path,
            id: crypto.randomUUID(),
            pathCode,
            resultBlock: {
              ...path.resultBlock,
              id: crypto.randomUUID(),
              outcomes: path.resultBlock.outcomes.flatMap((outcome) =>
                outcome.effectKind === 'DAMAGE' && outcome.damageTypeId !== undefined
                  ? [
                      {
                        id: crypto.randomUUID(),
                        effectKind: 'DAMAGE' as const,
                        damageTypeId: outcome.damageTypeId,
                        valueKind: 'FIXED' as const,
                        scalingKind: 'NONE' as const,
                        amount: 1
                      }
                    ]
                  : []
              )
            }
          }
        : path
    )
}

export function createCutoverWorkloadCreature(eligibilityDefinitionId: string) {
  const biteEffect = bite.effects?.[0]
  if (!biteEffect) throw new Error('The V15 workload requires the SRD Wolf Bite Effect.')
  const activatedFeature = (
    featureId: string,
    effectId: string,
    label: string,
    activation: 'ACTION' | 'BONUS_ACTION'
  ) => ({
    ...bite,
    id: featureId,
    label,
    charges: undefined,
    rollDefinitions: undefined,
    effects: [
      {
        ...biteEffect,
        id: effectId,
        invocation: {
          ...biteEffect.invocation,
          triggerCode: 'ACTIVATED' as const,
          activation: { code: activation, amount: 1 },
          range: { id: crypto.randomUUID(), rangeKind: 'UNLIMITED' as const },
          targeting: {
            selectionKind: 'SINGLE_TARGET' as const,
            dispositionKind: 'ANY' as const
          }
        },
        paths: fixedDamagePaths('ON_USE')
      }
    ]
  })
  return {
    ...wolf,
    label: 'V15 workload creature',
    hitPoints: 10_000,
    features: [
      activatedFeature(
        cutoverWorkloadActionFeatureId,
        cutoverWorkloadActionEffectId,
        'V15 fixed action',
        'ACTION'
      ),
      activatedFeature(
        cutoverWorkloadBonusActionFeatureId,
        cutoverWorkloadBonusActionEffectId,
        'V15 fixed bonus action',
        'BONUS_ACTION'
      ),
      {
        ...bite,
        id: cutoverWorkloadReactionFeatureId,
        label: 'V15 fixed movement reaction',
        charges: undefined,
        rollDefinitions: [
          {
            id: cutoverWorkloadReactionRollId,
            label: 'V15 reaction attack',
            kind: 'ATTACK' as const,
            expression: { count: 1, die: 20, modifier: 4 },
            rollMode: 'NORMAL' as const,
            chargeCost: null,
            order: 1
          }
        ],
        effects: [
          {
            ...biteEffect,
            id: cutoverWorkloadReactionEffectId,
            invocation: {
              ...biteEffect.invocation,
              triggerCode: 'MELEE_WEAPON_ATTACK' as const,
              activation: { code: 'REACTION' as const, amount: 1 },
              reactionTrigger: { ...reactionBinding, eligibilityDefinitionId }
            },
            paths: [
              ...(fixedDamagePaths('ON_HIT') ?? []),
              ...(fixedDamagePaths('ON_MISS') ?? []),
              ...(fixedDamagePaths('ON_CRIT') ?? [])
            ]
          }
        ]
      }
    ]
  }
}
