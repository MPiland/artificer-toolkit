import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  measureSceneTokenFootprintDistance,
  type SceneGrid,
  type SceneToken
} from '@artificer-toolkit/shared/vtt'
import { ROLL_MODE_RULE_SOURCE_IDS } from '@artificer-toolkit/shared/rules'
import {
  encounterActorRelationship,
  encounterFacingArcs,
  type EncounterActionSceneContext
} from './encounterActionTargetPolicy.js'
import { activeEffectCapabilitySuppressions } from './encounterActionEconomy.js'
import { heldConditionIds } from './encounterInnateConditions.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { EncounterRelationshipD20Contributor } from './encounterRelationshipActionFacts.js'
import {
  ENCOUNTER_FACING_CONTRIBUTOR_SOURCE_ID,
  encounterRuleContributorSource
} from './encounterRollModeReasons.js'
import type { FacingRule, FlankingInput } from './optionalCombatPolicyCapability.js'
import { optionalCombatPolicyCapabilityRegistry } from './platformEncounterPolicy.js'
import {
  resolveRuleCapabilityState,
  type CurrentReusableDefinitionSource
} from './ruleCapabilityStateService.js'

/**
 * The roll-mode contributors an attack takes from where its attacker and its allies stand relative
 * to its target: one per arc of the target's facing that the Facing rule gives an influence to
 * (ATTACK-12), each naming the arc, and the System's Flanking contributor when its policy finds an
 * ally opposite the attacker. Facing needs a Scene to measure on; Flanking its loaded facts.
 */
export function encounterActionPositionalContributors(input: {
  facing: Pick<FacingRule, 'arcs' | 'attackerInTargetArc'> | null
  sceneContext: EncounterActionSceneContext | null
  flanking: FlankingInput | null
}): EncounterRelationshipD20Contributor[] {
  const arc =
    input.facing && input.sceneContext
      ? encounterFacingArcs(input.facing.arcs, input.sceneContext)?.targetToSource
      : undefined
  const flanked =
    input.flanking &&
    optionalCombatPolicyCapabilityRegistry
      .find(input.flanking.gameSystemId)
      ?.resolveFlanking(input.flanking)
  return [
    ...(input.facing?.attackerInTargetArc ?? [])
      .filter((entry) => entry.arc === arc)
      .map((entry) => ({
        sourceId: ENCOUNTER_FACING_CONTRIBUTOR_SOURCE_ID,
        grantId: null,
        domainKey: ENCOUNTER_FACING_CONTRIBUTOR_SOURCE_ID,
        influence: entry.influence,
        source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.FACING),
        positional: { arc: entry.arc }
      })),
    ...(flanked ? [flanked] : [])
  ]
}

/** The Scene and creature facts a System's Flanking policy judges a melee attack by. */
export type EncounterFlankingFacts = Pick<
  FlankingInput,
  'grid' | 'attacker' | 'target' | 'alliedCandidates'
>

type PlacedToken = { actorId: string; tokenId: string } & Pick<
  SceneToken,
  'position' | 'height' | 'width'
>

/**
 * The Flanking facts of a melee attack, from the Scene tokens the attack is made among: each
 * creature in contact with the target (within one square) that is the attacker's ally and the
 * target's enemy, whether it holds the participant capability, and whether it sees the target.
 * Each site supplies its own tokens and perception (`observersSeeing`), so a reaction made at a
 * contact point is judged there. Every candidate is loaded through `loadTarget`, so its revision
 * joins the commit's read fence.
 */
export async function loadEncounterFlankingFacts(input: {
  gameSystemId: string
  actors: readonly EncounterRunActorState[]
  attacker: MovementTarget
  target: MovementTarget
  grid: SceneGrid
  tokens: readonly PlacedToken[]
  capabilityDefinitionId: string
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTarget>
  definitions: CurrentReusableDefinitionSource
  observersSeeing: (input: {
    subject: MovementTarget
    observers: readonly MovementTarget[]
  }) => Promise<ReadonlySet<string>>
}): Promise<EncounterFlankingFacts> {
  const { attacker, target, grid } = input
  const tokenOf = (actorId: string) => {
    const token = input.tokens.find((entry) => entry.actorId === actorId)
    if (!token) throw new Error('Encounter action facts are stale.')
    return { id: token.tokenId, position: token.position, height: token.height, width: token.width }
  }
  const targetToken = tokenOf(target.actor.id)
  const candidates = await Promise.all(
    input.actors
      .filter((actor) => {
        if (actor.id === attacker.actor.id || actor.id === target.actor.id) return false
        const token = input.tokens.find((entry) => entry.actorId === actor.id)
        return (
          token !== undefined &&
          encounterActorRelationship(attacker.actor.disposition, actor.disposition) === 'ALLIED' &&
          encounterActorRelationship(target.actor.disposition, actor.disposition) === 'HOSTILE' &&
          grid.kind === 'SQUARE' &&
          measureSceneTokenFootprintDistance(grid, targetToken, token) <= grid.distancePerCell
        )
      })
      .map((actor) => input.loadTarget(actor))
  )
  const participantCapability = async (participant: MovementTarget) =>
    (
      await resolveRuleCapabilityState({
        definitions: input.definitions,
        gameSystemId: input.gameSystemId,
        activeConditionDefinitionIds: heldConditionIds(participant),
        capabilityDefinitionIds: [input.capabilityDefinitionId],
        activeEffectSuppressions: activeEffectCapabilitySuppressions(
          input.gameSystemId,
          participant.activeEffects
        )
      })
    ).capabilities[0] ?? null
  const [seeing, attackerCapability, candidateCapabilities] = await Promise.all([
    input.observersSeeing({ subject: target, observers: [attacker, ...candidates] }),
    participantCapability(attacker),
    Promise.all(candidates.map(participantCapability))
  ])
  return {
    grid,
    attacker: {
      actorId: attacker.actor.id,
      token: tokenOf(attacker.actor.id),
      participantCapability: attackerCapability,
      canSeeTarget: seeing.has(attacker.actor.id),
      targetRelationship: encounterActorRelationship(
        attacker.actor.disposition,
        target.actor.disposition
      )
    },
    target: { actorId: target.actor.id, token: targetToken },
    alliedCandidates: candidates.map((candidate, index) => ({
      actorId: candidate.actor.id,
      token: tokenOf(candidate.actor.id),
      participantCapability: candidateCapabilities[index] ?? null,
      canSeeTarget: seeing.has(candidate.actor.id),
      attackerRelationship: encounterActorRelationship(
        attacker.actor.disposition,
        candidate.actor.disposition
      ),
      targetRelationship: encounterActorRelationship(
        target.actor.disposition,
        candidate.actor.disposition
      )
    }))
  }
}
