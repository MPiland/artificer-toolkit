import {
  encounterInitiativeRoundStateDtoSchema,
  type EncounterInitiativeRoundStateDto
} from '@artificer-toolkit/schema/shared/initiativeState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

/** The stored fields a Run command keeps for the round's initiative it left behind, or neither. */
export function storedInitiativeReceipt(initiative: EncounterInitiativeRoundStateDto | null) {
  return {
    initiativeStateJson: initiative === null ? null : JSON.stringify(initiative),
    initiativeStateChecksum: initiative === null ? null : checksumCanonicalJson(initiative)
  }
}

/**
 * Reads back what `storedInitiativeReceipt` wrote, refusing a record whose fields disagree, whose
 * checksum does not match, or that belongs to another Encounter. Returns null when none was stored.
 */
export function readStoredInitiativeReceipt(
  stored: { initiativeStateJson: string | null; initiativeStateChecksum: string | null },
  encounterId: string
): EncounterInitiativeRoundStateDto | null {
  if ((stored.initiativeStateJson === null) !== (stored.initiativeStateChecksum === null))
    throw new Error('Stored Encounter initiative receipt mismatch.')
  if (stored.initiativeStateJson === null) return null
  const initiative = encounterInitiativeRoundStateDtoSchema.parse(
    JSON.parse(stored.initiativeStateJson)
  )
  if (
    checksumCanonicalJson(initiative) !== stored.initiativeStateChecksum ||
    initiative.round.encounterId !== encounterId
  )
    throw new Error('Stored Encounter initiative receipt mismatch.')
  return initiative
}
