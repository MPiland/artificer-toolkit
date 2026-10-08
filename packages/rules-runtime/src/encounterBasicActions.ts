import {
  basicActionReusableDefinitionDocumentDtoSchema,
  encounterBasicActionEffectsDtoSchema,
  type BasicActionReusableDefinitionDocumentDto,
  type EncounterAllyAdvantageUseDto,
  type EncounterBasicActionEffectDto
} from '@artificer-toolkit/schema/shared/basicActions'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'
import { actionEconomyCapabilityRegistry } from './actionEconomyCapabilityRegistry.default.js'
import { lengthInFeet } from './character/characterSceneVision.js'
import { activeEffectCapabilitySuppressions } from './encounterActionEconomy.js'
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import { encounterConditionSpeed } from './encounterConditionMechanics.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { snapshotStatBlock } from './encounterProjection.js'
import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from './ruleCapabilityStateService.js'
import { speedDtoSchema } from '@artificer-toolkit/schema/shared/speed'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import type { EncounterD20RollMode } from './encounterEvidenceAnswer.js'

type ActorResources = Pick<EncounterRunActorState, 'resources'>
type TurnPosition = Pick<EncounterRunState, 'turnSequence' | 'currentActorId'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The basic-action effects an actor's Run resources hold (Q11). */
export function encounterBasicActionEffects(
  actor: ActorResources
): EncounterBasicActionEffectDto[] {
  const resources = isRecord(actor.resources) ? actor.resources : null
  return resources?.basicActionEffects === undefined
    ? []
    : encounterBasicActionEffectsDtoSchema.parse(resources.basicActionEffects)
}

/** Replaces an actor's basic-action effects; an actor with none keeps no entry. */
export function withEncounterBasicActionEffects(
  actor: EncounterRunActorState,
  effects: readonly EncounterBasicActionEffectDto[]
): EncounterRunActorState {
  const { basicActionEffects: _replaced, ...resources } = isRecord(actor.resources)
    ? actor.resources
    : {}
  return encounterRunActorStateSchema.parse({
    ...actor,
    resources: effects.length
      ? { ...resources, basicActionEffects: encounterBasicActionEffectsDtoSchema.parse(effects) }
      : resources
  })
}

/**
 * Whether an effect held by `holderId` applies now. Every effect lasts until the holder's next
 * turn starts, when that turn clears it; `NO_OPPORTUNITY_ATTACKS` also ends with the turn it was
 * taken in, which a later return of the turn to the holder does not revive.
 */
function applies(state: TurnPosition, holderId: string, effect: EncounterBasicActionEffectDto) {
  return (
    effect.mechanic !== 'NO_OPPORTUNITY_ATTACKS' ||
    (effect.turnSequence === state.turnSequence && state.currentActorId === holderId)
  )
}

/** Disengage: the actor's movement provokes no opportunity attacks this turn. */
export function suppressesEncounterOpportunityAttacks(
  state: TurnPosition,
  actor: EncounterRunActorState
): boolean {
  return encounterBasicActionEffects(actor).some(
    (effect) => effect.mechanic === 'NO_OPPORTUNITY_ATTACKS' && applies(state, actor.id, effect)
  )
}

/**
 * The basic action's d20 contributor: its source id names the catalogue entry, so the derived-mode
 * reason reads the entry's label (Dodge, Help).
 */
function basicActionContributor(
  definitionId: string,
  holderId: string,
  influence: EncounterRelationshipD20Contributor['influence']
): EncounterRelationshipD20Contributor {
  return {
    sourceId: `basic-action:${definitionId}`,
    grantId: null,
    domainKey: `basic-action:${holderId}`,
    influence
  }
}

/**
 * Whether an actor can't act (its System's actor-action capability is suppressed) or every speed it
 * has is 0 after its condition mechanics.
 */
async function unableToActOrMove(input: {
  target: MovementTarget
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
}) {
  const { target } = input
  const speeds =
    target.actor.kind === 'CHARACTER'
      ? (target.characterFacts?.ruleEvaluation.output.movement.speeds ?? [])
      : target.actor.kind === 'CREATURE'
        ? (snapshotStatBlock(target.actor)?.speeds ?? [])
        : []
  const feet = speeds.flatMap((entry: unknown) => {
    const speed = speedDtoSchema.safeParse(entry)
    return speed.success
      ? [
          encounterConditionSpeed({
            mechanics: target.conditionMechanics,
            speed: lengthInFeet(speed.data) ?? 0
          })
        ]
      : []
  })
  if (feet.length && feet.every((value) => value === 0)) return true
  const capabilityDefinitionId =
    actionEconomyCapabilityRegistry.requireActorActionCapabilityDefinitionId(input.gameSystemId)
  const state = await resolveRuleCapabilityState({
    definitions: input.definitions,
    gameSystemId: input.gameSystemId,
    activeConditionDefinitionIds: target.state.conditions,
    capabilityDefinitionIds: [capabilityDefinitionId],
    activeEffectSuppressions: activeEffectCapabilitySuppressions(target.activeEffects)
  })
  return state.capabilities[0]?.available === false
}

/** Adds one contributor to a d20's canonical contributors and derives the resulting roll mode. */
export function withEncounterD20Contributor(
  contributors: readonly EncounterRelationshipD20Contributor[],
  contributor: EncounterRelationshipD20Contributor
): { contributors: EncounterRelationshipD20Contributor[]; rollMode: EncounterD20RollMode } {
  const merged = [...contributors, contributor].sort(compareCanonicalD20Contributors)
  const advantage = merged.some((entry) => entry.influence === 'ADVANTAGE')
  const disadvantage = merged.some((entry) => entry.influence === 'DISADVANTAGE')
  return {
    contributors: merged,
    rollMode: advantage === disadvantage ? 'NORMAL' : advantage ? 'ADVANTAGE' : 'DISADVANTAGE'
  }
}

/**
 * Applies the actor's own defensive basic-action effects (Dodge) to its target facts: attack rolls
 * against it gain a disadvantage contributor, and its saving throws of the effect's abilities an
 * advantage contributor, both labelled by the entry. A suspended effect applies nothing while the
 * actor can't act or its speed is 0. Whether the actor sees its attacker is not checked:
 * no Encounter flow computes that perception fact yet.
 */
export async function withEncounterBasicActionDefense<T extends MovementTarget>(input: {
  target: T
  gameSystemId: string
  definitions: CurrentReusableDefinitionSource
}): Promise<T> {
  const { target } = input
  const effects = encounterBasicActionEffects(target.actor).filter(
    (effect) =>
      effect.mechanic === 'DISADVANTAGE_ON_ATTACKS_AGAINST' || effect.mechanic === 'SAVE_ADVANTAGE'
  )
  if (!effects.length) return target
  const suspended =
    effects.some((effect) => effect.suspendedWhileUnableToActOrMove) &&
    (await unableToActOrMove(input))
  const applying = effects.filter((effect) => !suspended || !effect.suspendedWhileUnableToActOrMove)
  const attackDefinitionIds = [
    ...new Set(
      applying.flatMap((effect) =>
        effect.mechanic === 'DISADVANTAGE_ON_ATTACKS_AGAINST' ? [effect.definitionId] : []
      )
    )
  ].sort()
  const saves = applying.filter((effect) => effect.mechanic === 'SAVE_ADVANTAGE')
  const savingThrowDefinitions = target.targetDerivedFacts.savingThrowDefinitions
  return {
    ...target,
    basicActionAttackContributors: attackDefinitionIds.map((definitionId) =>
      basicActionContributor(definitionId, target.actor.id, 'DISADVANTAGE')
    ),
    targetDerivedFacts: {
      ...target.targetDerivedFacts,
      ...(Array.isArray(savingThrowDefinitions) && saves.length
        ? {
            savingThrowDefinitions: savingThrowDefinitions.map((definition: unknown) => {
              if (!isRecord(definition) || !Array.isArray(definition.contributors))
                return definition
              const effect = saves.find((candidate) =>
                candidate.saveAbilityIds.includes(String(definition.abilityDefinitionId))
              )
              return effect
                ? {
                    ...definition,
                    ...withEncounterD20Contributor(
                      definition.contributors as EncounterRelationshipD20Contributor[],
                      basicActionContributor(effect.definitionId, target.actor.id, 'ADVANTAGE')
                    )
                  }
                : definition
            })
          }
        : {})
    }
  }
}
/**
 * Help: the ally advantage the attacker's next attack roll uses, from the helper with the lowest id
 * when several helped. The attack's commit removes it from that helper (`withoutAllyAdvantage`).
 */
export function encounterBasicActionAllyAdvantage(input: {
  actors: readonly EncounterRunActorState[]
  attackerId: string
}) {
  for (const helper of [...input.actors].sort((left, right) => left.id.localeCompare(right.id))) {
    const effect = encounterBasicActionEffects(helper).find(
      (candidate) =>
        candidate.mechanic === 'ALLY_ADVANTAGE' && candidate.allyActorId === input.attackerId
    )
    if (effect)
      return {
        helperActorId: helper.id,
        effect,
        contributor: basicActionContributor(effect.definitionId, helper.id, 'ADVANTAGE')
      }
  }
  return null
}

/**
 * The Helps a settled roll's participants used: each participant whose contributors include its
 * current ally advantage. Their commit removes them from the helpers.
 */
export function encounterAllyAdvantageUses(input: {
  actors: readonly EncounterRunActorState[]
  participants: readonly {
    actorId: string
    contributors: readonly EncounterRelationshipD20Contributor[]
  }[]
}): EncounterAllyAdvantageUseDto[] {
  return input.participants.flatMap((participant) => {
    const help = encounterBasicActionAllyAdvantage({
      actors: input.actors,
      attackerId: participant.actorId
    })
    return help &&
      participant.contributors.some(
        (contributor) =>
          checksumCanonicalJson(contributor) === checksumCanonicalJson(help.contributor)
      )
      ? [{ helperActorId: help.helperActorId, effect: help.effect }]
      : []
  })
}
/** Removes the one ally advantage an attack used from its helper. */
export function withoutEncounterAllyAdvantage(
  helper: EncounterRunActorState,
  used: EncounterBasicActionEffectDto
): EncounterRunActorState {
  const effects = encounterBasicActionEffects(helper)
  const index = effects.findIndex(
    (effect) => checksumCanonicalJson(effect) === checksumCanonicalJson(used)
  )
  if (index < 0) throw new Error('The ally advantage was already used.')
  return withEncounterBasicActionEffects(
    helper,
    effects.filter((_effect, position) => position !== index)
  )
}

/** A published basic-action catalogue entry of the Run's System. */
export function requireEncounterBasicActionDefinition(
  state: Pick<EncounterRunState, 'gameSystemId'>,
  definition: ReusableDefinitionCurrentDto | null
): {
  definition: ReusableDefinitionCurrentDto
  document: BasicActionReusableDefinitionDocumentDto
} {
  const document = basicActionReusableDefinitionDocumentDtoSchema.safeParse(definition?.document)
  if (
    !definition ||
    !document.success ||
    definition.definitionFamilyKey !== BASIC_ACTION_DEFINITION_FAMILY_KEY ||
    definition.gameSystemId !== state.gameSystemId ||
    document.data.id !== definition.id
  )
    throw new Error("The basic action is not in this Encounter's System.")
  return { definition, document: document.data }
}

/**
 * Plans one basic action for the current actor: the effects it gains, its movement bonus and the
 * Assisted warnings of its target choice. Its allowance is evaluated by the caller.
 */
export function planEncounterBasicAction(input: {
  state: Pick<EncounterRunState, 'turnSequence'>
  actor: EncounterRunActorState
  ally: EncounterRunActorState | null
  document: BasicActionReusableDefinitionDocumentDto
}) {
  const { state, actor, ally, document } = input
  const needsAlly = document.mechanics.includes('ALLY_ADVANTAGE')
  if (needsAlly !== (ally !== null) || ally?.id === actor.id)
    throw new Error(needsAlly ? 'Choose an ally to help.' : 'This basic action has no target.')
  const effects = document.mechanics.flatMap((mechanic): EncounterBasicActionEffectDto[] =>
    mechanic === 'SPEED_MOVEMENT_BONUS'
      ? []
      : [
          {
            definitionId: document.id,
            mechanic,
            turnSequence: state.turnSequence,
            allyActorId: mechanic === 'ALLY_ADVANTAGE' ? ally!.id : null,
            saveAbilityIds: mechanic === 'SAVE_ADVANTAGE' ? document.saveAbilityIds : [],
            suspendedWhileUnableToActOrMove: document.suspendedWhileUnableToActOrMove
          }
        ]
  )
  const warnings: EncounterRuleWarningDto[] =
    ally && encounterActorRelationship(actor.disposition, ally.disposition) === 'HOSTILE'
      ? [{ code: 'TARGET_DISPOSITION', message: 'This helps an enemy.' }]
      : []
  return {
    effects,
    speedMovementBonus: document.mechanics.includes('SPEED_MOVEMENT_BONUS'),
    warnings,
    actor: withEncounterBasicActionEffects(actor, [
      ...encounterBasicActionEffects(actor),
      ...effects
    ])
  }
}
