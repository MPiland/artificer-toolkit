import { baseEquipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { creatureEquipmentLoadoutDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  compileEquipment,
  type CompiledEquipment
} from '@artificer-toolkit/shared/subjects/compilers'
import {
  EQUIPMENT_PROPERTY_CODE,
  HAND_CONFLICT_MESSAGE,
  resolveHandOccupancy,
  type EquipmentSlotCode
} from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { z } from 'zod'

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const positiveRevisionSchema = z.number().int().positive()

const equipmentSourceDtoSchema = z
  .strictObject({
    loadoutEntryId: postgresUuidSchema,
    equipmentId: postgresUuidSchema,
    sourceRevision: positiveRevisionSchema,
    sourceVersionId: postgresUuidSchema,
    sourceChecksum: checksumSchema,
    payload: baseEquipmentAuthoredDtoSchema
  })
  .superRefine((source, context) => {
    if (source.payload.id !== source.equipmentId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payload', 'id'],
        message: 'Pinned Equipment source payload must match its Equipment identity.'
      })
    }
  })

export type EncounterCreatureEquipmentSource = z.infer<typeof equipmentSourceDtoSchema> & {
  compiled: CompiledEquipment
}

type SerializedEncounterCreatureEquipmentSource = z.infer<typeof equipmentSourceDtoSchema>

type CreatureSnapshotActor = {
  kind: string
  systemId: string | null
  snapshot: unknown
}

function requireCanonicalUuid(value: string, label: string): string {
  const parsed = postgresUuidSchema.safeParse(value)
  if (!parsed.success || parsed.data !== value) {
    throw new Error(`${label} must be a canonical PostgreSQL UUID.`)
  }
  return parsed.data
}

function parseEquipmentSource(value: unknown): EncounterCreatureEquipmentSource {
  const parsed = equipmentSourceDtoSchema.safeParse(value)
  if (!parsed.success) throw new Error('Creature Equipment source snapshot is invalid.')
  if (checksumRuleDocument(parsed.data.payload) !== parsed.data.sourceChecksum) {
    throw new Error('Creature Equipment source snapshot checksum does not match its payload.')
  }
  // The strict transport document has just been parsed; this cast crosses to
  // the shared authored-domain compiler without accepting unvalidated JSON.
  const compiled = compileEquipment(parsed.data.payload as unknown as EquipmentAuthored)
  if (compiled.category === 'VARIANT') {
    throw new Error('Creature Equipment source must remain a base Equipment document.')
  }
  return { ...parsed.data, compiled }
}

function snapshotRecord(actor: CreatureSnapshotActor): Record<string, unknown> {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    throw new Error('Creature Equipment sources require an immutable Creature snapshot.')
  }
  return actor.snapshot as Record<string, unknown>
}

/**
 * Returns the Encounter-owned effective loadout. The immutable Creature
 * payload remains the admission source; a replacement command may pin a
 * server-only overlay for one Encounter actor without rewriting that payload.
 */
export function snapshotCreatureEquipmentLoadout(
  actor: CreatureSnapshotActor
): readonly z.infer<typeof creatureEquipmentLoadoutDtoSchema>[number][] {
  const snapshot = snapshotRecord(actor)
  const payload = snapshot.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('Creature Equipment sources require an immutable Creature payload.')
  }
  const rawLoadout =
    snapshot.equipmentLoadoutOverride ?? (payload as Record<string, unknown>).equipmentLoadout
  if (rawLoadout === undefined) return []
  const parsed = creatureEquipmentLoadoutDtoSchema.safeParse(rawLoadout)
  if (!parsed.success) throw new Error('Creature Equipment source snapshot has an invalid loadout.')
  return parsed.data
}

/**
 * Parses the frozen, server-only Equipment sources that belong to the locked
 * Creature snapshot. The authored loadout remains the sole binding owner.
 */
export function snapshotCreatureEquipmentSources(
  actor: CreatureSnapshotActor
): readonly EncounterCreatureEquipmentSource[] {
  const snapshot = snapshotRecord(actor)
  const loadout = snapshotCreatureEquipmentLoadout(actor)
  const rawSources = snapshot.equipmentSources
  if (loadout.length === 0 && rawSources === undefined) return []
  if (!Array.isArray(rawSources)) {
    throw new Error('Creature Equipment source snapshot does not match its loadout.')
  }
  const byLoadoutId = new Map<string, EncounterCreatureEquipmentSource>()
  for (const rawSource of rawSources) {
    const source = parseEquipmentSource(rawSource)
    if (byLoadoutId.has(source.loadoutEntryId)) {
      throw new Error('Creature Equipment source snapshot contains duplicate loadout bindings.')
    }
    if (source.payload.systemId !== actor.systemId) {
      throw new Error('Creature Equipment source snapshot belongs to another Game System.')
    }
    byLoadoutId.set(source.loadoutEntryId, source)
  }
  if (byLoadoutId.size !== loadout.length) {
    throw new Error('Creature Equipment source snapshot is missing a loadout binding.')
  }
  return loadout.map((entry) => {
    const source = byLoadoutId.get(entry.id)
    if (!source || source.equipmentId !== entry.equipmentId) {
      throw new Error(
        'Creature Equipment source snapshot does not match a loadout Equipment binding.'
      )
    }
    return source
  })
}

/**
 * Refuses a loadout whose hands conflict once its pinned Equipment is known: a two-handed item
 * belongs in the main hand, where it blocks the off hand (D107).
 */
export function assertCreatureLoadoutHands(
  loadout: readonly { id: string; useState: EquipmentSlotCode }[],
  sources: readonly SerializedEncounterCreatureEquipmentSource[]
): void {
  const twoHandedEntryIds = new Set(
    sources
      .filter((source) => source.payload.properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED))
      .map((source) => source.loadoutEntryId)
  )
  const [conflict] = resolveHandOccupancy(
    loadout.map((entry) => ({
      id: entry.id,
      slot: entry.useState,
      twoHanded: twoHandedEntryIds.has(entry.id)
    }))
  ).conflicts
  if (conflict) throw new Error(HAND_CONFLICT_MESSAGE[conflict.code])
}

/** Builds the persisted source arm while the active sources are authorized. */
export function pinCreatureEquipmentSources(input: {
  creature: {
    equipmentLoadout?: readonly {
      id: string
      equipmentId: string
      useState: EquipmentSlotCode
      actionFeatureIds: readonly string[]
    }[]
    systemId: string
  }
  equipmentRecords: ReadonlyMap<
    string,
    {
      authored: { document: unknown; checksum: string; version: number; versionId: string }
    }
  >
}): readonly SerializedEncounterCreatureEquipmentSource[] {
  const loadout = input.creature.equipmentLoadout ?? []
  const seenLoadoutIds = new Set<string>()
  const sources: SerializedEncounterCreatureEquipmentSource[] = []
  for (const entry of loadout) {
    requireCanonicalUuid(entry.id, 'Creature Equipment loadout identity')
    requireCanonicalUuid(entry.equipmentId, 'Creature Equipment identity')
    if (seenLoadoutIds.has(entry.id)) {
      throw new Error('Creature Equipment loadout contains duplicate bindings.')
    }
    seenLoadoutIds.add(entry.id)
    const record = input.equipmentRecords.get(entry.equipmentId)
    if (!record) throw new Error('Creature Equipment source is unavailable.')
    const payload = baseEquipmentAuthoredDtoSchema.safeParse(record.authored.document)
    if (!payload.success || payload.data.id !== entry.equipmentId) {
      throw new Error('Creature Equipment source must be a valid base Equipment document.')
    }
    if (payload.data.systemId !== input.creature.systemId) {
      throw new Error('Creature Equipment source belongs to another Game System.')
    }
    if (checksumRuleDocument(payload.data) !== record.authored.checksum) {
      throw new Error('Creature Equipment source checksum does not match its authored payload.')
    }
    sources.push(
      equipmentSourceDtoSchema.parse({
        loadoutEntryId: entry.id,
        equipmentId: entry.equipmentId,
        sourceRevision: record.authored.version,
        sourceVersionId: record.authored.versionId,
        sourceChecksum: record.authored.checksum,
        payload: payload.data
      })
    )
  }
  assertCreatureLoadoutHands(loadout, sources)
  return sources
}
