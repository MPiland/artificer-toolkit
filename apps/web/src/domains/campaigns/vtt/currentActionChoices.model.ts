import type { EncounterActionChoicesDto } from '@artificer-toolkit/schema/api/encounterActionChoices'

/** The loaded action choices when they belong to exactly the Run version and actor in scope, else none. */
export function selectCurrentActionChoices(
  loaded: EncounterActionChoicesDto | null | undefined,
  scope: { encounterId: string; expectedVersion: number; actorId: string } | false | null
): EncounterActionChoicesDto | null {
  return scope &&
    loaded?.encounterId === scope.encounterId &&
    loaded.encounterVersion === scope.expectedVersion &&
    loaded.actorId === scope.actorId
    ? loaded
    : null
}
