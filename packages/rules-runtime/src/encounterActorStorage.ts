import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import {
  encounterStoredRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterStoredRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectEncounterActorFacts } from './encounterProjection.js'

type ActorSnapshot = EncounterRunActorState['snapshot']

const snapshotChecksums = new WeakMap<object, string>()

/**
 * The checksum of an actor's source snapshot. An actor copied with `{ ...actor }` keeps the same
 * snapshot object, so a command that never touches the snapshot hashes it once, not once per write.
 */
export function checksumActorSnapshot(snapshot: ActorSnapshot) {
  if (typeof snapshot !== 'object' || snapshot === null) return checksumCanonicalJson(snapshot)
  const known = snapshotChecksums.get(snapshot)
  if (known !== undefined) return known
  const checksum = checksumCanonicalJson(snapshot)
  snapshotChecksums.set(snapshot, checksum)
  return checksum
}

/**
 * The actor without its source snapshot, from its stored state (ADR 0035 Amendment 29). Its
 * checksum is the stored row's `stateChecksum`, so a guard on the actor never hashes the snapshot.
 */
export function runActorPlayState(stored: EncounterStoredRunActorState) {
  if (stored.kind === 'CHARACTER') {
    const { snapshotChecksum: _snapshotChecksum, ...play } = stored
    return play
  }
  const {
    snapshotChecksum: _snapshotChecksum,
    sourceFactsChecksum: _sourceFactsChecksum,
    featureResources: _featureResources,
    ...play
  } = stored
  return play
}

export function checksumRunActorPlayState(actor: EncounterRunActorState) {
  const { snapshot: _snapshot, ...play } = actor
  return checksumCanonicalJson(play)
}

/** The one place a stored actor and its snapshot become the full actor again. */
export function composeRunActorState(
  stored: EncounterStoredRunActorState,
  snapshot: ActorSnapshot
): EncounterRunActorState {
  return { ...runActorPlayState(stored), snapshot }
}

/**
 * Splits an actor into the stored record and the shared rows it names. The record carries the
 * projection facts, with the actor's rules already evaluated, so a projection reads it alone.
 */
export function splitRunActorState(
  actor: EncounterRunActorState,
  actorRules: EncounterActorRuleOutput
) {
  const { facts, source } = projectEncounterActorFacts(actor, actorRules)
  const { snapshot, ...play } = actor
  const snapshotChecksum = checksumActorSnapshot(snapshot)
  const stored = encounterStoredRunActorStateSchema.parse(
    facts.kind === 'CHARACTER'
      ? { ...play, snapshotChecksum }
      : {
          ...play,
          snapshotChecksum,
          sourceFactsChecksum: facts.sourceFactsChecksum,
          featureResources: facts.featureResources
        }
  )
  return {
    stored,
    snapshot,
    snapshotChecksum,
    source,
    sourceFactsChecksum: stored.kind === 'CHARACTER' ? null : stored.sourceFactsChecksum
  }
}
