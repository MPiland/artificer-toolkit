import type { AuthoredStoredCompilation } from '@artificer-toolkit/schema/api/authoredPublication'
import {
  encounterCreatureEquipmentSourceSchema,
  type EncounterCreatureEquipmentSourceDto
} from '@artificer-toolkit/schema/projections/encounterCreatureEquipment'
import { creatureEquipmentLoadoutDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import type { CompiledEquipment } from '@artificer-toolkit/shared/subjects/compilers'
import {
  EQUIPMENT_PROPERTY_CODE,
  HAND_CONFLICT_MESSAGE,
  resolveHandOccupancy,
  type EquipmentSlotCode
} from '@artificer-toolkit/shared/core'
import { z } from 'zod'

import { hydrateStoredCompilation } from './authoredPublicationHydrate.js'
import { armorClassCapabilityRegistry } from './platformEncounterPolicy.js'

export type EncounterCreatureEquipmentSource = EncounterCreatureEquipmentSourceDto & {
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

/** Fails closed on another compiler version, a compilation of another version or a corrupt one. */
function hydrateEquipmentSource(source: EncounterCreatureEquipmentSourceDto) {
  return hydrateStoredCompilation(
    'EQUIPMENT',
    { id: source.equipmentId, checksum: source.sourceChecksum },
    source.compilation
  )
}

function parseEquipmentSource(value: unknown): EncounterCreatureEquipmentSource {
  const parsed = encounterCreatureEquipmentSourceSchema.safeParse(value)
  if (!parsed.success) throw new Error('Creature Equipment source snapshot is invalid.')
  return { ...parsed.data, compiled: hydrateEquipmentSource(parsed.data) }
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
  sources: readonly EncounterCreatureEquipmentSourceDto[]
): void {
  const twoHandedEntryIds = new Set(
    sources
      .filter((source) =>
        hydrateEquipmentSource(source).properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
      )
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
  abilityScores: z.record(z.string(), z.number()),
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
  gameSystemId: string,
  inputs: z.infer<typeof creatureArmorClassInputsSchema>,
  loadout: readonly { id: string; useState: EquipmentSlotCode }[],
  sources: readonly EncounterCreatureEquipmentSourceDto[]
): void {
  const sourceByEntryId = new Map(sources.map((source) => [source.loadoutEntryId, source]))
  const result = armorClassCapabilityRegistry.require(gameSystemId).creatureArmorClass({
    abilityScores: inputs.abilityScores,
    naturalArmorBonus: inputs.naturalArmorBonus,
    equipment: loadout.map((entry) => {
      const source = sourceByEntryId.get(entry.id)
      if (!source) throw new Error('Creature Equipment source is unavailable.')
      return {
        id: entry.id,
        useState: entry.useState,
        compiled: hydrateEquipmentSource(source)
      }
    })
  })
  if (!result) throw new Error('Creature armor class inputs are invalid.')
  if (!result.ok) throw new Error(result.reason)
}

/**
 * Builds the persisted source arm while the active sources are authorized. The caller's reader
 * enforces the Creature's Game System and read access; a variant arrives as its own stored,
 * resolved compilation.
 */
export function pinCreatureEquipmentSources(input: {
  creature: {
    equipmentLoadout?: readonly {
      id: string
      equipmentId: string
      useState: EquipmentSlotCode
      actionFeatureIds: readonly string[]
    }[]
    systemId: string
    abilityScores: Readonly<Record<string, number>>
    naturalArmorBonus: number
  }
  equipment: ReadonlyMap<
    string,
    {
      checksum: string
      version: number
      versionId: string
      compilation: AuthoredStoredCompilation
    }
  >
}): readonly EncounterCreatureEquipmentSourceDto[] {
  const loadout = input.creature.equipmentLoadout ?? []
  const seenLoadoutIds = new Set<string>()
  const sources: EncounterCreatureEquipmentSourceDto[] = []
  for (const entry of loadout) {
    requireCanonicalUuid(entry.id, 'Creature Equipment loadout identity')
    requireCanonicalUuid(entry.equipmentId, 'Creature Equipment identity')
    if (seenLoadoutIds.has(entry.id)) {
      throw new Error('Creature Equipment loadout contains duplicate bindings.')
    }
    seenLoadoutIds.add(entry.id)
    const record = input.equipment.get(entry.equipmentId)
    if (!record) throw new Error('Creature Equipment source is unavailable.')
    const source = encounterCreatureEquipmentSourceSchema.parse({
      loadoutEntryId: entry.id,
      equipmentId: entry.equipmentId,
      sourceRevision: record.version,
      sourceVersionId: record.versionId,
      sourceChecksum: record.checksum,
      compilation: record.compilation
    })
    sources.push(source)
  }
  assertCreatureLoadoutHands(loadout, sources)
  assertCreatureLoadoutArmorClass(input.creature.systemId, input.creature, loadout, sources)
  return sources
}
