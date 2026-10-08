import {
  isCharacterDead,
  type CharacterDeathSaves
} from '@artificer-toolkit/schema/shared/characterDeathSaves'

type DefeatableActor =
  | { kind: 'CHARACTER'; sourceId: string }
  | { kind: 'CREATURE' | 'CUSTOM'; defeated: boolean }

/**
 * The Characters that are dead (D96), by Character ID. A Character's death lives in its own play
 * state (ADR 0034); readers pass the fact in rather than the Run keeping a copy.
 */
export type DeadCharacterIds = ReadonlySet<string>

/**
 * The dead Characters once loaded targets are taken into account: each Character target carries its
 * live (or staged) state, which overrides what `known` recorded for it.
 */
export function deadCharacterIdsOfTargets(
  targets: Iterable<{
    actor: { kind: 'CHARACTER'; sourceId: string } | { kind: 'CREATURE' | 'CUSTOM' }
    state: { deathSaves: CharacterDeathSaves | null }
  }>,
  known: DeadCharacterIds = new Set()
): DeadCharacterIds {
  const dead = new Set(known)
  for (const { actor, state } of targets) {
    if (actor.kind !== 'CHARACTER' || !state.deathSaves) continue
    if (isCharacterDead(state.deathSaves)) dead.add(actor.sourceId)
    else dead.delete(actor.sourceId)
  }
  return dead
}

/**
 * A Creature or custom actor is defeated (D63) once a change takes it from above 0 hit points to 0,
 * and stays so until it regains hit points. An actor that never had hit points (a lair or hazard at
 * 0 of 0) is never defeated.
 */
export function nextEncounterActorDefeated(
  before: { currentHitPoints: number; defeated: boolean },
  afterCurrentHitPoints: number
): boolean {
  return afterCurrentHitPoints === 0 && (before.defeated || before.currentHitPoints > 0)
}

/**
 * A Creature or custom actor is defeated by 0 hit points (D63); a Character at 0 hit points is
 * unconscious and dying, and defeated only once dead (D96).
 */
export function isEncounterActorDefeated(
  actor: DefeatableActor,
  deadCharacterIds: DeadCharacterIds
): boolean {
  return actor.kind === 'CHARACTER' ? deadCharacterIds.has(actor.sourceId) : actor.defeated
}

/** The actors that are defeated (D63, D96). */
export function defeatedEncounterActorIds(
  actors: readonly (DefeatableActor & { id: string })[],
  deadCharacterIds: DeadCharacterIds
): ReadonlySet<string> {
  return new Set(
    actors
      .filter((actor) => isEncounterActorDefeated(actor, deadCharacterIds))
      .map((actor) => actor.id)
  )
}

/**
 * The actors whose turns initiative skips: the defeated (D63, D96) and the Characters the GM took
 * out of initiative (D82). Both keep their place in the round.
 */
export function skippedEncounterActorIds(
  actors: readonly ({ id: string } & (
    | { kind: 'CHARACTER'; sourceId: string; outOfInitiative: boolean }
    | { kind: 'CREATURE' | 'CUSTOM'; defeated: boolean }
  ))[],
  deadCharacterIds: DeadCharacterIds
): ReadonlySet<string> {
  return new Set(
    actors
      .filter((actor) =>
        actor.kind === 'CHARACTER'
          ? actor.outOfInitiative || deadCharacterIds.has(actor.sourceId)
          : actor.defeated
      )
      .map((actor) => actor.id)
  )
}
