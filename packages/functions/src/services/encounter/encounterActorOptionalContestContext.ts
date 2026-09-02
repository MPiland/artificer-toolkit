import type { EncounterActorRecord } from '@artificer-toolkit/db'
import { encounterCreatureRuleFactsSnapshotSchema } from '@artificer-toolkit/schema/api/encounterActorRules'
import { sizeCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources,
  type EncounterCreatureEquipmentSource
} from '../rules/encounterCreatureEquipmentSources.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import { EncounterConflictError } from './encounterErrors.js'

export type EncounterActorOptionalContestContext = {
  readonly actorId: string
  readonly equipment: {
    readonly equipmentId: string
    readonly loadoutEntryId: string
    readonly properties: readonly string[]
    readonly sourceChecksum: string
    readonly sourceRevision: number
    readonly sourceVersionId: string
    readonly state: 'HELD'
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

export type EncounterActorOptionalContestFacts = Pick<
  EncounterActorOptionalContestContext,
  'actorId' | 'ruleFacts' | 'size'
>

function snapshotRecord(actor: EncounterActorRecord): Record<string, unknown> | null {
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

function readActorFacts(actor: EncounterActorRecord): EncounterActorOptionalContestFacts | null {
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

function readContext(input: {
  actor: EncounterActorRecord
  loadoutEntryId: string
}): EncounterActorOptionalContestContext | null {
  const actorFacts = readActorFacts(input.actor)
  if (!actorFacts) return null

  let loadout: ReturnType<typeof snapshotCreatureEquipmentLoadout>
  let sources: readonly EncounterCreatureEquipmentSource[]
  try {
    loadout = snapshotCreatureEquipmentLoadout(input.actor)
    sources = snapshotCreatureEquipmentSources(input.actor)
  } catch {
    return null
  }
  const entry = loadout.find(
    (candidate) => candidate.id === input.loadoutEntryId && candidate.useState === 'HELD'
  )
  const source = sources.find(
    (candidate) =>
      candidate.loadoutEntryId === input.loadoutEntryId &&
      candidate.equipmentId === entry?.equipmentId
  )
  if (!entry || !source) return null

  const context = {
    ...actorFacts,
    equipment: {
      equipmentId: source.equipmentId,
      loadoutEntryId: source.loadoutEntryId,
      properties: source.compiled.properties,
      sourceChecksum: source.sourceChecksum,
      sourceRevision: source.sourceRevision,
      sourceVersionId: source.sourceVersionId,
      state: 'HELD'
    }
  } as const
  return { ...context, stateChecksum: checksumRuleDocument(context) }
}

/** Reads normalized actor-level contest facts before a held item is selected. */
export function prepareEncounterActorOptionalContestFacts(input: {
  targets: LockedEncounterActiveEffectTargets
  targetActorId: string
}): EncounterActorOptionalContestFacts | null {
  const actor = input.targets.encounterActors.get(input.targetActorId)
  if (!actor || actor.id !== input.targetActorId) {
    throw new EncounterConflictError('Creature contest target changed before preparation.')
  }
  return readActorFacts(actor)
}

/**
 * Reads only a locked Creature actor's normalized contest facts. Custom actors
 * and incomplete Creature snapshots deliberately return null so the caller can
 * produce its bounded JUDGMENT_REQUIRED path rather than infer system facts.
 */
export function prepareEncounterActorOptionalContestContext(input: {
  /** The caller has acquired this bundle through lockEncounterActiveEffectTargets. */
  targets: LockedEncounterActiveEffectTargets
  loadoutEntryId: string
  targetActorId: string
}): EncounterActorOptionalContestContext | null {
  const actor = input.targets.encounterActors.get(input.targetActorId)
  if (!actor || actor.id !== input.targetActorId) {
    throw new EncounterConflictError('Creature contest target changed before preparation.')
  }
  return readContext({ actor, loadoutEntryId: input.loadoutEntryId })
}

/**
 * Applies the only actor-owned Disarm transition. The coordinator must call
 * this while it still owns the Encounter/actor lock, then persist the returned
 * actor through its existing aggregate repository transaction.
 */
export function applyEncounterActorOptionalContestSuccess(input: {
  context: EncounterActorOptionalContestContext
  actor: EncounterActorRecord
}): {
  readonly actor: EncounterActorRecord
  readonly afterStateChecksum: string
  readonly beforeStateChecksum: string
} {
  const current = readContext({
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
  const nextActor: EncounterActorRecord = {
    ...input.actor,
    snapshot: {
      ...snapshot,
      equipmentLoadoutOverride: nextLoadout
    }
  }
  const next = readContext({
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
