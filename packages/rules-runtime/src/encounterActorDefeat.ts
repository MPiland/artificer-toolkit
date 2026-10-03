type DefeatableActor = { kind: 'CHARACTER' } | { kind: 'CREATURE' | 'CUSTOM'; defeated: boolean }

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

/** A Character at 0 hit points is unconscious and dying, never defeated. */
export function isEncounterActorDefeated(actor: DefeatableActor): boolean {
  return actor.kind !== 'CHARACTER' && actor.defeated
}

/** The actors that are defeated (D63). */
export function defeatedEncounterActorIds(
  actors: readonly (DefeatableActor & { id: string })[]
): ReadonlySet<string> {
  return new Set(actors.filter(isEncounterActorDefeated).map((actor) => actor.id))
}

/**
 * The actors whose turns initiative skips: the defeated (D63) and the Characters the GM took out of
 * initiative (D82). Both keep their place in the round.
 */
export function skippedEncounterActorIds(
  actors: readonly ({ id: string } & (
    | { kind: 'CHARACTER'; outOfInitiative: boolean }
    | { kind: 'CREATURE' | 'CUSTOM'; defeated: boolean }
  ))[]
): ReadonlySet<string> {
  return new Set(
    actors
      .filter((actor) => (actor.kind === 'CHARACTER' ? actor.outOfInitiative : actor.defeated))
      .map((actor) => actor.id)
  )
}
