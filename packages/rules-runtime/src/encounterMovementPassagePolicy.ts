import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { MovementPassageOption } from '@artificer-toolkit/shared/core'

import { encounterActorEffectiveSize } from './encounterActionEffects.js'
import { modifierScopeCapabilityRegistry } from './platformEncounterPolicy.js'
import { sizeRank } from './systemSizes.js'

type PassageRelation = MovementPassageOption['creatures']

/**
 * What an actor's `MOVEMENT_PASSAGE` grants let it move through, combined as one union: the widest
 * creature relation, ending inside only where a grant allows it, barriers when any grant passes
 * them, and the highest cost multiplier (D154 then takes the highest of it, terrain and zones).
 */
export type EncounterMovementPassage = {
  readonly throughCreatures: PassageRelation
  readonly endInCreatures: PassageRelation
  readonly throughBarriers: boolean
  readonly costMultiplier: number
}

const RELATION_RANK: Readonly<Record<PassageRelation, number>> = {
  NONE: 0,
  LARGER_THAN_SELF: 1,
  ANY: 2
}

const wider = (left: PassageRelation, right: PassageRelation): PassageRelation =>
  RELATION_RANK[right] > RELATION_RANK[left] ? right : left

const NO_PASSAGE: EncounterMovementPassage = {
  throughCreatures: 'NONE',
  endInCreatures: 'NONE',
  throughBarriers: false,
  costMultiplier: 1
}

/** The passage an actor's accepted grant-fold modifiers give it. */
export function movementPassageOfModifiers(
  gameSystemId: string,
  modifiers: readonly CharacterGrantFoldOutput['modifiers'][number][]
): EncounterMovementPassage {
  const scope = modifierScopeCapabilityRegistry.require(gameSystemId)
  let passage = NO_PASSAGE
  for (const modifier of modifiers) {
    const { payload } = modifier
    if (
      modifier.valueDomainCode !== 'MOVEMENT_PASSAGE' ||
      modifier.modifierKind !== 'ADD_OPTION' ||
      payload === undefined ||
      !('creatures' in payload) ||
      !scope.appliesCharacterWide(modifier)
    )
      continue
    passage = {
      throughCreatures: wider(passage.throughCreatures, payload.creatures),
      endInCreatures: payload.mayEndInCreature
        ? wider(passage.endInCreatures, payload.creatures)
        : passage.endInCreatures,
      throughBarriers: passage.throughBarriers || payload.blockingBarriers,
      costMultiplier: Math.max(passage.costMultiplier, payload.costMultiplier)
    }
  }
  return passage
}

/**
 * The accepted grant-fold modifiers an Encounter actor has now. A Character has its policy's grants
 * unless it wears a creature form, which, like its actions (SPELLS-28.T4d), comes from the form's
 * stat block; a Creature has its folded feature grants.
 */
function encounterActorGrantModifiers(
  actor: EncounterRunActorState,
  characterPolicy: CharacterRulePolicyOutput | null
): readonly CharacterGrantFoldOutput['modifiers'][number][] {
  if (actor.kind === 'CHARACTER' && actor.form === null)
    return characterPolicy?.grantFold.modifiers ?? []
  const snapshot = actor.kind === 'CHARACTER' ? actor.form?.snapshot : actor.snapshot
  const ruleFacts =
    snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? encounterCreatureRuleFactsSnapshotSchema.safeParse(snapshot.ruleFacts)
      : null
  return ruleFacts?.success ? ruleFacts.data.modifiers : []
}

/** The passage an Encounter actor has now. */
export function encounterActorMovementPassage(
  gameSystemId: string,
  actor: EncounterRunActorState,
  characterPolicy: CharacterRulePolicyOutput | null
): EncounterMovementPassage {
  return movementPassageOfModifiers(
    gameSystemId,
    encounterActorGrantModifiers(actor, characterPolicy)
  )
}

/** Whether an actor's own grants (Flyby) make its movement provoke no opportunity attacks. */
export function encounterActorMovementProvokesNoOpportunityAttacks(
  gameSystemId: string,
  actor: EncounterRunActorState,
  characterPolicy: CharacterRulePolicyOutput | null
): boolean {
  const scope = modifierScopeCapabilityRegistry.require(gameSystemId)
  return encounterActorGrantModifiers(actor, characterPolicy).some(
    (modifier) =>
      modifier.valueDomainCode === 'OPPORTUNITY_ATTACK_IMMUNITY' &&
      modifier.modifierKind === 'ENABLE' &&
      scope.appliesCharacterWide(modifier)
  )
}

/** Whether a passage relation lets a mover of one size into a creature of another. */
export function movementPassageAdmits(
  gameSystemId: string,
  relation: PassageRelation,
  moverSize: string | null,
  blockerSize: string | null
): boolean {
  if (relation === 'ANY') return true
  if (relation === 'NONE') return false
  const mover = sizeRank(gameSystemId, moverSize)
  const blocker = sizeRank(gameSystemId, blockerSize)
  return mover !== null && blocker !== null && blocker > mover
}

/**
 * The mover's passage and every actor's size from the movement targets the move settles with;
 * a mover without a target (Manual automation) passes nothing.
 */
export function encounterMovementPassageFacts(
  targets: ReadonlyMap<string, Parameters<typeof encounterActorEffectiveSize>[0]>,
  moverActorId: string | undefined
): { mover: EncounterMovementPassage; sizeOf: (actorId: string) => string | null } {
  const mover = moverActorId === undefined ? undefined : targets.get(moverActorId)
  return {
    mover: mover?.movementPassage ?? NO_PASSAGE,
    sizeOf: (actorId) => {
      const target = targets.get(actorId)
      return target ? encounterActorEffectiveSize(target) : null
    }
  }
}
