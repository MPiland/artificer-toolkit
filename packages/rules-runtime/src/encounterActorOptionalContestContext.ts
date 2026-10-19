import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { sizeCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { isHandSlot, type HandSlotCode } from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources,
  type EncounterCreatureEquipmentSource
} from './encounterCreatureEquipmentSources.js'
import { EncounterConflictError } from './encounterErrors.js'

type EncounterActorOptionalContestActor = {
  id: string
  kind: string
  systemId: string | null
  snapshot: unknown
}

type EncounterActorOptionalContestContext = {
  readonly actorId: string
  readonly equipment: {
    readonly equipmentId: string
    readonly loadoutEntryId: string
    readonly properties: readonly string[]
    readonly sourceChecksum: string
    readonly sourceRevision: number
    readonly sourceVersionId: string
    /** The hand the item is held in; Disarm moves the item to CARRIED and undo restores this hand. */
    readonly state: HandSlotCode
  }
  readonly ruleFacts: {
    readonly checkTotals: Readonly<Record<string, number>>
    readonly vocabularySnapshot: {
      readonly checksum: string
      readonly id: string
      readonly version: number
    }
  }
  readonly size: string
  readonly stateChecksum: string
}

type EncounterActorOptionalContestFacts = Pick<
  EncounterActorOptionalContestContext,
  'actorId' | 'ruleFacts' | 'size'
>

function snapshotRecord(actor: EncounterActorOptionalContestActor): Record<string, unknown> | null {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    return null
  }
  return actor.snapshot as Record<string, unknown>
}

/** Reads normalized actor-level contest facts before a held item is selected. */
export function readEncounterActorOptionalContestFacts(
  actor: EncounterActorOptionalContestActor
): EncounterActorOptionalContestFacts | null {
  const snapshot = snapshotRecord(actor)
  if (!snapshot || !actor.systemId) return null
  const ruleFacts = encounterCreatureRuleFactsSnapshotSchema.safeParse(snapshot.ruleFacts)
  const payload = snapshot.payload
  const size =
    typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? sizeCodeSchema.safeParse((payload as Record<string, unknown>).size)
      : null
  if (!ruleFacts.success || ruleFacts.data.gameSystemId !== actor.systemId || !size?.success)
    return null
  return {
    actorId: actor.id,
    ruleFacts: {
      checkTotals: ruleFacts.data.checkTotals ?? {},
      vocabularySnapshot: {
        checksum: ruleFacts.data.vocabularySnapshotChecksum,
        id: ruleFacts.data.vocabularySnapshotId,
        version: ruleFacts.data.vocabularySnapshotVersion
      }
    },
    size: size.data
  }
}

export function readEncounterActorOptionalContestContext(input: {
  actor: EncounterActorOptionalContestActor
  loadoutEntryId: string
}): EncounterActorOptionalContestContext | null {
  const actorFacts = readEncounterActorOptionalContestFacts(input.actor)
  if (!actorFacts) return null

  let loadout: ReturnType<typeof snapshotCreatureEquipmentLoadout>
  let sources: readonly EncounterCreatureEquipmentSource[]
  try {
    loadout = snapshotCreatureEquipmentLoadout(input.actor)
    sources = snapshotCreatureEquipmentSources(input.actor)
  } catch {
    return null
  }
  const entry = loadout.find((candidate) => candidate.id === input.loadoutEntryId)
  if (!entry || !isHandSlot(entry.useState)) return null
  const source = sources.find(
    (candidate) =>
      candidate.loadoutEntryId === input.loadoutEntryId &&
      candidate.equipmentId === entry.equipmentId
  )
  if (!source) return null

  const context = {
    ...actorFacts,
    equipment: {
      equipmentId: source.equipmentId,
      loadoutEntryId: source.loadoutEntryId,
      properties: source.compiled.properties,
      sourceChecksum: source.sourceChecksum,
      sourceRevision: source.sourceRevision,
      sourceVersionId: source.sourceVersionId,
      state: entry.useState
    }
  } as const
  return { ...context, stateChecksum: checksumRuleDocument(context) }
}

/** Applies the only actor-owned Disarm transition. */
export function applyEncounterActorOptionalContestSuccess<
  TActor extends EncounterActorOptionalContestActor
>(input: {
  context: EncounterActorOptionalContestContext
  actor: TActor
}): {
  readonly actor: TActor
  readonly afterStateChecksum: string
  readonly beforeStateChecksum: string
} {
  const current = readEncounterActorOptionalContestContext({
    actor: input.actor,
    loadoutEntryId: input.context.equipment.loadoutEntryId
  })
  if (
    !current ||
    current.actorId !== input.context.actorId ||
    current.stateChecksum !== input.context.stateChecksum ||
    current.equipment.equipmentId !== input.context.equipment.equipmentId ||
    current.equipment.sourceRevision !== input.context.equipment.sourceRevision ||
    current.equipment.sourceVersionId !== input.context.equipment.sourceVersionId ||
    current.equipment.sourceChecksum !== input.context.equipment.sourceChecksum
  ) {
    throw new EncounterConflictError('Creature contest equipment changed before application.')
  }
  const snapshot = snapshotRecord(input.actor)
  if (!snapshot) throw new EncounterConflictError('Creature contest target is unavailable.')
  const loadout = snapshotCreatureEquipmentLoadout(input.actor)
  const nextLoadout = loadout.map((entry) =>
    entry.id === current.equipment.loadoutEntryId
      ? { ...entry, useState: 'CARRIED' as const }
      : entry
  )
  const nextActor = {
    ...input.actor,
    snapshot: {
      ...snapshot,
      equipmentLoadoutOverride: nextLoadout
    }
  }
  const next = readEncounterActorOptionalContestContext({
    actor: nextActor,
    loadoutEntryId: current.equipment.loadoutEntryId
  })
  if (next !== null) {
    throw new EncounterConflictError('Creature contest equipment transition is invalid.')
  }
  const afterStateChecksum = checksumRuleDocument({
    actorId: current.actorId,
    equipment: { ...current.equipment, state: 'CARRIED' },
    ruleFacts: current.ruleFacts,
    size: current.size
  })
  return {
    actor: nextActor,
    afterStateChecksum,
    beforeStateChecksum: current.stateChecksum
  }
}

/**
 * Puts a dropped item back in the hand it left (the undo of a release), or null when the loadout
 * entry no longer reproduces the held state the transition recorded.
 */
export function revertEncounterActorItemRelease<
  TActor extends EncounterActorOptionalContestActor
>(input: {
  actor: TActor
  transition: {
    loadoutEntryId: string
    equipmentId: string
    fromState: HandSlotCode
    beforeStateChecksum: string
  }
}): TActor | null {
  const { actor, transition } = input
  const snapshot = snapshotRecord(actor)
  if (!snapshot) return null
  const loadout = snapshotCreatureEquipmentLoadout(actor)
  const entry = loadout.find((candidate) => candidate.id === transition.loadoutEntryId)
  if (entry?.useState !== 'CARRIED' || entry.equipmentId !== transition.equipmentId) return null
  const nextActor = {
    ...actor,
    snapshot: {
      ...snapshot,
      equipmentLoadoutOverride: loadout.map((candidate) =>
        candidate.id === transition.loadoutEntryId
          ? { ...candidate, useState: transition.fromState }
          : candidate
      )
    }
  }
  const restored = readEncounterActorOptionalContestContext({
    actor: nextActor,
    loadoutEntryId: transition.loadoutEntryId
  })
  return restored?.stateChecksum === transition.beforeStateChecksum ? nextActor : null
}
