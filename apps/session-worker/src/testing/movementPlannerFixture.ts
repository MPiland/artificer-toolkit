import type { EncounterMaintainedEffectDescriptorDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import {
  createDnd5eReactionChoiceDefinition,
  DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  createDnd5eOpportunityReactionEligibilityDefinition,
  DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import {
  createSrdRulesRuntime,
  creatureFeature,
  currentSrdDefinition,
  srdDefinitions,
  testUuid
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { buildSpatialDamageEffect } from '@artificer-toolkit/rules-runtime/testing/spatialDamageEffectFixture'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { adultBlackDragon } from '@artificer-toolkit/source-data/srd/creatures/adult-black-dragon.js'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'

/** The SRD rule definition the Legendary Resistance Feature names. */
const LEGENDARY_RESISTANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000000e4'

/** The SRD Wolf as the corpus seeds it. */
const srdWolf = (() => {
  const record = srdCreatureRecords.find((candidate) => candidate.id === wolf.id)
  if (!record) throw new Error('The SRD Wolf is missing.')
  return record
})()

/** A plain SRD Wolf: nothing it carries reacts to movement. */
export const plainWolf: CreatureAuthored = srdWolf

/** An SRD Wolf whose Bite is an opportunity attack, ending the mover's walk where it hits when `stopOnHit`. */
function opportunityWolf(stopOnHit: boolean): CreatureAuthored {
  const bite = creatureFeature(srdWolf, 'Bite')
  const biteEffect = bite.effects?.[0]
  if (
    !biteEffect ||
    biteEffect.invocation.kind !== 'ACTION' ||
    biteEffect.invocation.triggerCode === 'CHECK'
  )
    throw new Error('The SRD Wolf Bite is missing.')
  return {
    ...srdWolf,
    features: [
      {
        ...bite,
        effects: [
          {
            ...biteEffect,
            invocation: {
              ...biteEffect.invocation,
              activation: { code: 'REACTION' as const, amount: 1 },
              reactionTrigger: {
                kind: 'MOVEMENT' as const,
                stage: 'BEFORE_LEAVE_REACH' as const,
                perceptionRequirement: null,
                eligibilityDefinitionId: DND5E_OPPORTUNITY_REACTION_ELIGIBILITY_DEFINITION_ID,
                movementInterruption: stopOnHit
                  ? { kind: 'STOP' as const, whenResultPath: 'ON_HIT' as const }
                  : null
              }
            },
            paths: biteEffect.paths.slice(0, 1)
          }
        ]
      }
    ]
  }
}

/** An SRD Wolf whose Bite is an opportunity attack: a Reaction taken when a creature leaves its reach. */
export const reactionWolf = opportunityWolf(false)

/** The `reactionWolf` whose hit also stops the mover's walk at the contact. */
export const stopReactionWolf = opportunityWolf(true)

/**
 * The `reactionWolf` whose Bite makes its target save (DC 30 Dexterity, so a failed save is the
 * ordinary case) and stops the mover's walk at the contact on a failed save.
 */
export const saveStopWolf: CreatureAuthored = (() => {
  const bite = creatureFeature(reactionWolf, 'Bite')
  const effect = bite.effects?.[0]
  const trigger = effect?.invocation.kind === 'ACTION' ? effect.invocation.reactionTrigger : null
  const damagePath = effect?.paths.find(
    (path) =>
      'resultBlock' in path &&
      path.resultBlock.outcomes.some((entry) => entry.effectKind === 'DAMAGE')
  )
  if (!effect || effect.invocation.kind !== 'ACTION' || !trigger || !damagePath)
    throw new Error('The reaction Wolf Bite is missing.')
  return {
    ...reactionWolf,
    features: [
      {
        ...bite,
        effects: [
          {
            ...effect,
            invocation: {
              ...effect.invocation,
              activation: { code: 'REACTION' as const, amount: 1 },
              triggerCode: 'SAVING_THROW' as const,
              savingThrow: {
                id: testUuid(0x7001),
                dcMethod: 'FIXED_DC' as const,
                baseDc: 30,
                abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.DEXTERITY
              },
              reactionTrigger: {
                ...trigger,
                movementInterruption: {
                  kind: 'STOP' as const,
                  whenResultPath: 'ON_SAVE_FAIL' as const
                }
              }
            },
            paths: [{ ...damagePath, pathCode: 'ON_SAVE_FAIL' as const }]
          }
        ]
      }
    ]
  }
})()

/**
 * The `reactionWolf` whose hit deals no damage but leaves a state effect that suppresses the
 * target's actor-action capability, as a non-condition source of "can't act" would.
 */
export const incapacitatingReactionWolf: CreatureAuthored = (() => {
  const bite = creatureFeature(reactionWolf, 'Bite')
  const effect = bite.effects?.[0]
  const hit = effect?.paths[0]
  if (!effect || !hit || !('resultBlock' in hit))
    throw new Error('The reaction Wolf Bite is missing.')
  return {
    ...reactionWolf,
    features: [
      {
        ...bite,
        effects: [
          {
            ...effect,
            paths: [
              {
                ...hit,
                resultBlock: {
                  ...hit.resultBlock,
                  outcomes: [
                    {
                      id: testUuid(0x7101),
                      effectKind: 'ACTOR_RELATIONSHIP' as const,
                      heldAtOnce: 1,
                      modules: [
                        {
                          id: testUuid(0x7102),
                          order: 1,
                          kind: 'TARGET_CAPABILITY_SUPPRESSION' as const,
                          capabilityDefinitionIds: [DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID]
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  }
})()

/** A Wolf that carries the Dragon's Legendary Resistance (its saves may be turned into successes). */
export const legendaryWolf: CreatureAuthored = (() => {
  const resistance = adultBlackDragon.features?.find((feature) =>
    feature.ruleDefinitionIds?.includes(LEGENDARY_RESISTANCE_DEFINITION_ID)
  )
  if (!resistance) throw new Error('SRD Legendary Resistance is missing.')
  return {
    ...plainWolf,
    id: testUuid(0x7101),
    features: [...(plainWolf.features ?? []), resistance]
  }
})()

/** The policy definitions a movement reaction names; the SRD reusable set does not publish them. */
export const reactionPolicyDefinitions = [
  createDnd5eOpportunityReactionEligibilityDefinition(),
  createDnd5eReactionChoiceDefinition()
].map((published) =>
  currentSrdDefinition({
    id: published.id,
    definitionFamilyKey: published.definitionFamilyKey,
    label: 'Movement reaction policy',
    description: 'Current D&D movement reaction policy.',
    document: published.definition,
    checksum: published.checksum
  })
)

/**
 * The Encounter-store input of a spatial effect (see `buildSpatialDamageEffect`) lasting 3 ticks,
 * its graph frozen by the installed rules runtime, as casting freezes it.
 */
export async function spatialDamageEffect(input: {
  encounterId: string
  targetActorId: string
  center: ScenePoint
  radius: number
  /** Distinguishes several effects in one Scene: each carries its own identities and ordinal. */
  variant?: number
  /** Deals the damage only on a failed save, which the room rolls or asks for as d20 evidence. */
  save?: boolean
  /** Applies this condition instead of dealing damage. */
  condition?: { conditionId: string }
  /** Anchors the effect to a token instead of the Scene, so it travels with that token. */
  moving?: {
    sourceTokenId: string
    activation: 'ONE_SHOT' | 'REPEATABLE'
    hidden: boolean
  }
  /** Makes a Scene-fixed effect a hidden, unrevealed field that allows passage at half speed. */
  hiddenHalfSpeedField?: boolean
  /** The kinds of movement that trigger the effect; a voluntary move alone unless it says more. */
  movementKinds?: ('VOLUNTARY' | 'FORCED' | 'TELEPORT')[]
  /** What triggers the effect; crossing the circle alone unless it says more. */
  triggerModes?: ('ENTER' | 'EXIT' | 'CROSS')[]
  /** Whether a Scene-fixed effect is spent by its first trigger; one-shot unless it says otherwise. */
  activation?: 'ONE_SHOT' | 'REPEATABLE'
}) {
  const offset = (input.variant ?? 0) * 0x10
  return buildSpatialDamageEffect({
    runtime: createSrdRulesRuntime(),
    encounterId: input.encounterId,
    targetActorId: input.targetActorId,
    targetHitPoints: 1,
    center: input.center,
    radius: input.radius,
    ids: {
      definitionId: testUuid(0x6001 + offset),
      entryId: testUuid(0x6002 + offset),
      occurrenceId: testUuid(0x6003 + offset),
      rootCommandId: testUuid(0x6004 + offset),
      effectId: testUuid(0x6005 + offset)
    },
    save: input.save ?? false,
    condition: input.condition,
    remainingTicks: 3,
    moving: input.moving,
    hiddenHalfSpeedField: input.hiddenHalfSpeedField,
    movementKinds: input.movementKinds,
    triggerModes: input.triggerModes,
    activation: input.activation
  })
}

/** A Character's maintained Concentration, matching the SRD maintenance definition. */
export async function concentrationDescriptor(
  actorId: string
): Promise<EncounterMaintainedEffectDescriptorDto> {
  const definition = await srdDefinitions.requireCurrent(
    DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
  )
  return {
    schemaVersion: 2,
    maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
    definitionChecksum: definition.checksum,
    provenance: {
      kind: 'ACTION',
      sourceActionId: 'maintained-source-action',
      sourceOccurrenceId: testUuid(0x4001)
    },
    sourceActorId: actorId,
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
  }
}
