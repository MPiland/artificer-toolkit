import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterCreatureEquipmentReplacementSchema } from '@artificer-toolkit/schema/projections/encounterCreatureEquipment'
import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import {
  assertCreatureLoadoutHands,
  parseCreatureArmorClassInputs,
  pinCreatureEquipmentSources,
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources
} from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import {
  assertEncounterCreatureEquipmentLoadoutCapabilities,
  equipmentReplacementKeepsDamageTypes
} from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscovery'
import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import { requireSnapshotIdentity } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { readCreatureEquipmentRecords } from './creatureEquipmentRecords.js'
import type { EncounterPersistenceTransaction } from './ports.js'

export async function replaceActorEquipment(
  ctx: EncounterPersistenceTransaction,
  userId: string,
  actor: EncounterRunActorState,
  input: Extract<EncounterExecuteInput['command'], { type: 'REPLACE_CREATURE_EQUIPMENT' }>,
  updatedAt: string
) {
  if (
    actor.kind !== 'CREATURE' ||
    !actor.systemId ||
    !actor.sourceId ||
    actor.sourceRevision === null
  )
    throw new Error('Only a Creature with a frozen source can replace Equipment.')
  const loadout = snapshotCreatureEquipmentLoadout(actor)
  const entry = loadout.find((candidate) => candidate.id === input.loadoutEntryId)
  if (!entry) throw new Error('Creature Equipment loadout entry was not found.')
  const currentSources = snapshotCreatureEquipmentSources(actor)
  const systemId = actor.systemId
  const snapshot = requireSnapshotIdentity(actor)
  const armorClassInputs = parseCreatureArmorClassInputs(snapshot.payload)
  const [source] = pinCreatureEquipmentSources({
    creature: {
      systemId,
      ...armorClassInputs,
      equipmentLoadout: [{ ...entry, equipmentId: input.equipmentId }]
    },
    equipmentRecords: await readCreatureEquipmentRecords(
      (id) => ctx.ports.readEncounterSource(userId, systemId, id, 'EQUIPMENT'),
      [input.equipmentId]
    )
  })
  if (!source) throw new Error('Creature Equipment source is unavailable.')
  const equipmentLoadoutOverride = loadout.map((current) =>
    current.id === entry.id ? { ...current, equipmentId: input.equipmentId } : current
  )
  const equipmentSources = currentSources.map(({ compiled: _compiled, ...current }) =>
    current.loadoutEntryId === entry.id ? source : current
  )
  // The replacement may be two-handed, so the whole loadout's hands are checked again.
  assertCreatureLoadoutHands(equipmentLoadoutOverride, equipmentSources)
  const next = encounterRunActorStateSchema.parse({
    ...actor,
    snapshot: { ...snapshot, equipmentLoadoutOverride, equipmentSources },
    updatedAt
  })
  const incompatible = new Error(
    'Replacement Equipment is incompatible with the Creature Feature actions.'
  )
  try {
    assertEncounterCreatureEquipmentLoadoutCapabilities(next)
  } catch {
    throw incompatible
  }
  const replaced = currentSources.find((current) => current.loadoutEntryId === entry.id)
  const replacement = snapshotCreatureEquipmentSources(next).find(
    (current) => current.loadoutEntryId === entry.id
  )
  if (
    entry.actionFeatureIds.length > 0 &&
    (!replaced || !replacement || !equipmentReplacementKeepsDamageTypes(replaced, replacement))
  )
    throw incompatible
  if (
    new TextEncoder().encode(JSON.stringify(next.snapshot)).byteLength >
    AUTHORED_LIMITS.mutationPayloadBytes
  )
    throw new Error('Creature Equipment snapshot is too large.')
  return {
    actor: next,
    provenance: encounterCreatureEquipmentReplacementSchema.parse({
      actorId: actor.id,
      loadoutEntryId: source.loadoutEntryId,
      equipmentId: source.equipmentId,
      sourceRevision: source.sourceRevision,
      sourceVersionId: source.sourceVersionId,
      sourceChecksum: source.sourceChecksum
    })
  }
}
