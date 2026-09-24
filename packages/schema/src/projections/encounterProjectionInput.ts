import type { EncounterGmActorDto, EncounterGmProjectionDto } from '../api/encounters.js'
import type { EncounterInitiativePolicySnapshotDto } from '../shared/initiativePolicySnapshot.js'
import type {
  EncounterInitiativeParticipantDto,
  EncounterInitiativeRoundDto
} from '../shared/initiativeState.js'
import type { EncounterOptionalCombatSnapshotDto } from '../shared/optionalCombat.js'

export type EncounterProjectionActorInput = Omit<
  EncounterGmActorDto,
  'conditions' | 'features' | 'healthBand' | 'resources' | 'statBlock'
> & {
  conditions: unknown
  resources: unknown
  snapshot: unknown
}

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
