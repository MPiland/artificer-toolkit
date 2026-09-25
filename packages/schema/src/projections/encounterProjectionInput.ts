import type { EncounterGmProjectionDto } from '../api/encounters.js'
import type { EncounterInitiativePolicySnapshotDto } from '../shared/initiativePolicySnapshot.js'
import type {
  EncounterInitiativeParticipantDto,
  EncounterInitiativeRoundDto
} from '../shared/initiativeState.js'
import type { EncounterOptionalCombatSnapshotDto } from '../shared/optionalCombat.js'
import type { EncounterRunActorState } from './encounterRunState.js'

type ProjectionActor<TActor> = TActor extends unknown
  ? Omit<TActor, 'conditions' | 'resources' | 'snapshot' | 'sideId' | 'createdAt' | 'updatedAt'> & {
      resources: unknown
      snapshot: unknown
    } & (TActor extends { conditions: unknown } ? { conditions: unknown } : unknown)
  : never

export type EncounterProjectionActorInput = ProjectionActor<EncounterRunActorState>

/**
 * Current Character hit points and conditions, with the Character's stored effective maximum, by
 * Character ID; the Run keeps no copy of them.
 */
export type EncounterProjectionCharacterStates = ReadonlyMap<
  string,
  { current: number; temporary: number; maximum: number; conditions: unknown }
>

export type EncounterProjectionInitiativeRoundStateInput = {
  round: Pick<EncounterInitiativeRoundDto, 'round' | 'status'>
  participants: ReadonlyArray<
    Pick<EncounterInitiativeParticipantDto, 'actorId' | 'status' | 'turnOrderOrdinal'>
  >
}

export type EncounterProjectionInput = Omit<
  EncounterGmProjectionDto,
  'actors' | 'initiativePolicy' | 'optionalCombatRules'
> & {
  actors: ReadonlyArray<EncounterProjectionActorInput>
  initiativePolicySnapshot?: EncounterInitiativePolicySnapshotDto | null
  initiativeRoundState?: EncounterProjectionInitiativeRoundStateInput | null
  optionalCombatSnapshot?: EncounterOptionalCombatSnapshotDto | null
}
