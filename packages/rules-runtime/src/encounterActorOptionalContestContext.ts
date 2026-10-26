import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { systemCoreCodeSchema } from '@artificer-toolkit/schema/shared/systemCoreCode'
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
      ? systemCoreCodeSchema.safeParse((payload as Record<string, unknown>).size)
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

/** Moves a carried loadout item into a hand: the draw an attack makes (D107). */
export function applyEncounterActorItemDraw<
  TActor extends EncounterActorOptionalContestActor
>(input: {
  actor: TActor
  loadoutEntryId: string
  slot: HandSlotCode
}): {
  readonly actor: TActor
  readonly equipmentId: string
  readonly beforeStateChecksum: string
  readonly afterStateChecksum: string
} {
  const { actor, loadoutEntryId, slot } = input
  const snapshot = snapshotRecord(actor)
  if (!snapshot) throw new EncounterConflictError('Creature weapon to draw is unavailable.')
  const loadout = snapshotCreatureEquipmentLoadout(actor)
  if (loadout.find((entry) => entry.id === loadoutEntryId)?.useState !== 'CARRIED')
    throw new EncounterConflictError('Creature weapon to draw is no longer carried.')
  const nextActor = {
    ...actor,
    snapshot: {
      ...snapshot,
      equipmentLoadoutOverride: loadout.map((entry) =>
        entry.id === loadoutEntryId ? { ...entry, useState: slot } : entry
      )
    }
  }
  const drawn = readEncounterActorOptionalContestContext({ actor: nextActor, loadoutEntryId })
  if (!drawn) throw new EncounterConflictError('Creature weapon draw is invalid.')
  return {
    actor: nextActor,
    equipmentId: drawn.equipment.equipmentId,
    beforeStateChecksum: checksumRuleDocument({
      actorId: drawn.actorId,
      equipment: { ...drawn.equipment, state: 'CARRIED' },
      ruleFacts: drawn.ruleFacts,
      size: drawn.size
    }),
    afterStateChecksum: drawn.stateChecksum
  }
}

/** Moves a held loadout item to carried: the throw an attack makes (D107), the inverse of a draw. */
export function applyEncounterActorItemThrow<
  TActor extends EncounterActorOptionalContestActor
>(input: {
  actor: TActor
  loadoutEntryId: string
}): {
  readonly actor: TActor
  readonly equipmentId: string
  readonly beforeStateChecksum: string
  readonly afterStateChecksum: string
} {
  const { actor, loadoutEntryId } = input
  const snapshot = snapshotRecord(actor)
  if (!snapshot) throw new EncounterConflictError('Creature weapon to throw is unavailable.')
  const held = readEncounterActorOptionalContestContext({ actor, loadoutEntryId })
  if (!held) throw new EncounterConflictError('Creature weapon to throw is no longer held.')
  const nextActor = {
    ...actor,
    snapshot: {
      ...snapshot,
      equipmentLoadoutOverride: snapshotCreatureEquipmentLoadout(actor).map((entry) =>
        entry.id === loadoutEntryId ? { ...entry, useState: 'CARRIED' as const } : entry
      )
    }
  }
  return {
    actor: nextActor,
    equipmentId: held.equipment.equipmentId,
    beforeStateChecksum: held.stateChecksum,
    afterStateChecksum: checksumRuleDocument({
      actorId: held.actorId,
      equipment: { ...held.equipment, state: 'CARRIED' },
      ruleFacts: held.ruleFacts,
      size: held.size
    })
  }
}

/**
 * Puts a drawn item back to carried (the undo of a draw), or null when the loadout entry no
 * longer reproduces the held state the transition recorded.
 */
export function revertEncounterActorItemDraw<
  TActor extends EncounterActorOptionalContestActor
>(input: {
  actor: TActor
  transition: {
    loadoutEntryId: string
    equipmentId: string
    slot: HandSlotCode
    beforeStateChecksum: string
    afterStateChecksum: string
  }
}): TActor | null {
  const { actor, transition } = input
  const snapshot = snapshotRecord(actor)
  const drawn = readEncounterActorOptionalContestContext({
    actor,
    loadoutEntryId: transition.loadoutEntryId
  })
  if (
    !snapshot ||
    drawn?.equipment.state !== transition.slot ||
    drawn.equipment.equipmentId !== transition.equipmentId ||
    drawn.stateChecksum !== transition.afterStateChecksum
  )
    return null
  return {
    ...actor,
    snapshot: {
      ...snapshot,
      equipmentLoadoutOverride: snapshotCreatureEquipmentLoadout(actor).map((entry) =>
        entry.id === transition.loadoutEntryId ? { ...entry, useState: 'CARRIED' as const } : entry
      )
    }
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
