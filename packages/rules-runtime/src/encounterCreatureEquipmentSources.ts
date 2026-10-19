import {
  baseEquipmentAuthoredDtoSchema,
  equipmentAuthoredDtoSchema,
  type BaseEquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
import { creatureEquipmentLoadoutDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  compileResolvedEquipment,
  resolveEquipmentAuthored,
  type CompiledEquipment,
  type ResolvedEquipment
} from '@artificer-toolkit/shared/subjects/compilers'
import {
  EQUIPMENT_PROPERTY_CODE,
  HAND_CONFLICT_MESSAGE,
  resolveHandOccupancy,
  type EquipmentSlotCode
} from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  EquipmentAuthored,
  VariantEquipmentAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { z } from 'zod'

import { resolveDnd5eCreatureArmorClass } from './systems/dnd5e/armorClass.js'

const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const positiveRevisionSchema = z.number().int().positive()

type SerializedEncounterCreatureEquipmentSource = {
  loadoutEntryId: string
  equipmentId: string
  sourceRevision: number
  sourceVersionId: string
  sourceChecksum: string
  payload: BaseEquipmentAuthoredDto
}

const equipmentSourceDtoSchema: z.ZodType<SerializedEncounterCreatureEquipmentSource> = z
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

export type EncounterCreatureEquipmentSource = SerializedEncounterCreatureEquipmentSource & {
  compiled: CompiledEquipment
}

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
  return { ...parsed.data, compiled: compilePinnedPayload(parsed.data.payload) }
}

/**
 * The strict transport document has already been parsed; this cast crosses to the shared
 * authored-domain compiler without accepting unvalidated JSON.
 */
function compilePinnedPayload(
  payload: SerializedEncounterCreatureEquipmentSource['payload']
): CompiledEquipment {
  return compileResolvedEquipment(payload as unknown as ResolvedEquipment)
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
  return snapshotCreatureEquipmentItems(actor).map(({ source }) => source)
}

/** The effective loadout's entries with their pinned, compiled Equipment, in loadout order. */
export function snapshotCreatureEquipmentItems(actor: CreatureSnapshotActor): readonly {
  entry: z.infer<typeof creatureEquipmentLoadoutDtoSchema>[number]
  source: EncounterCreatureEquipmentSource
}[] {
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
    return { entry, source }
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

const creatureArmorClassInputsSchema = z.object({
  abilityScores: z.object({ DEXTERITY: z.number() }),
  naturalArmorBonus: z.number().int().nonnegative()
})

/** The armor class inputs of an immutable Creature payload. */
export function parseCreatureArmorClassInputs(payload: unknown) {
  const parsed = creatureArmorClassInputsSchema.safeParse(payload)
  if (!parsed.success) throw new Error('Creature armor class inputs are invalid.')
  return parsed.data
}

/**
 * Refuses a loadout whose pinned Equipment has no armor class a Creature can evaluate, so the
 * Encounter projection (which computes it strictly) can never throw.
 */
export function assertCreatureLoadoutArmorClass(
  inputs: z.infer<typeof creatureArmorClassInputsSchema>,
  loadout: readonly { id: string; useState: EquipmentSlotCode }[],
  sources: readonly SerializedEncounterCreatureEquipmentSource[]
): void {
  const sourceByEntryId = new Map(sources.map((source) => [source.loadoutEntryId, source]))
  const result = resolveDnd5eCreatureArmorClass({
    dexterityScore: inputs.abilityScores.DEXTERITY,
    naturalArmorBonus: inputs.naturalArmorBonus,
    equipment: loadout.map((entry) => {
      const source = sourceByEntryId.get(entry.id)
      if (!source) throw new Error('Creature Equipment source is unavailable.')
      return {
        id: entry.id,
        useState: entry.useState,
        compiled: compilePinnedPayload(source.payload)
      }
    })
  })
  if (!result.ok) throw new Error(result.reason)
}

/**
 * Turns a stored Equipment record into the one a Creature pins. Base Equipment pins as authored;
 * a variant pins as its resolved, base-shaped document under the variant's own identity, so the
 * pinned payload (and the checksum taken of it) is self-contained. Provenance stays in the
 * record's version fields.
 */
export function resolveEquipmentSourceRecord(
  record: { document: unknown; checksum: string; version: number; versionId: string },
  lookupParent: (id: string) => unknown
): { document: unknown; checksum: string; version: number; versionId: string } {
  const stored = equipmentAuthoredDtoSchema.parse(record.document)
  if (stored.category !== 'VARIANT') return record
  const resolved = resolveEquipmentAuthored(
    stored as unknown as EquipmentAuthored | VariantEquipmentAuthored,
    (id) => {
      const parent = lookupParent(id)
      return parent === undefined || parent === null
        ? null
        : (equipmentAuthoredDtoSchema.parse(parent) as unknown as
            | EquipmentAuthored
            | VariantEquipmentAuthored)
    }
  )
  // Resolution leaves absent fields as explicit undefined, which a checksummed JSON document
  // cannot hold; the round trip drops them.
  const document = baseEquipmentAuthoredDtoSchema.parse(JSON.parse(JSON.stringify(resolved)))
  return { ...record, document, checksum: checksumRuleDocument(document) }
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
    abilityScores: { DEXTERITY: number }
    naturalArmorBonus: number
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
  assertCreatureLoadoutArmorClass(input.creature, loadout, sources)
  return sources
}
