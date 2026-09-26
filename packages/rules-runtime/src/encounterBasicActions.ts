import {
  basicActionReusableDefinitionDocumentDtoSchema,
  encounterBasicActionEffectsDtoSchema,
  type BasicActionReusableDefinitionDocumentDto,
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
import { encounterActorRelationship } from './encounterActionTargetPolicy.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'

type ActorResources = Pick<EncounterRunActorState, 'resources'>
type TurnPosition = Pick<EncounterRunState, 'round' | 'currentActorId'>

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
 * turn starts, when that turn clears it; `NO_OPPORTUNITY_ATTACKS` also ends with its own turn.
 */
function applies(state: TurnPosition, holderId: string, effect: EncounterBasicActionEffectDto) {
  return (
    effect.mechanic !== 'NO_OPPORTUNITY_ATTACKS' ||
    (effect.round === state.round && state.currentActorId === holderId)
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

/** Dodge: attack rolls against the target have disadvantage. */
export function encounterBasicActionDefenseContributors(
  target: EncounterRunActorState
): EncounterRelationshipD20Contributor[] {
  const definitionIds = new Set(
    encounterBasicActionEffects(target).flatMap((effect) =>
      effect.mechanic === 'DISADVANTAGE_ON_ATTACKS_AGAINST' ? [effect.definitionId] : []
    )
  )
  return [...definitionIds]
    .sort()
    .map((definitionId) => basicActionContributor(definitionId, target.id, 'DISADVANTAGE'))
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
  state: EncounterRunState
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
            round: state.round,
            allyActorId: mechanic === 'ALLY_ADVANTAGE' ? ally!.id : null
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
