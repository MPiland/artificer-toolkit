import {
  encounterBlueprintDtoSchema,
  type CreateEncounterBlueprintInputDto,
  type EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounterData'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { jsonValueSchema, type JsonValue } from '@artificer-toolkit/schema/projections/identity'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { compileInstalledCreatureRuleFacts } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { pinCreatureEquipmentSources } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { readCreatureEquipmentRecords } from './creatureEquipmentRecords.js'
import type { EncounterAuthoredSource } from './ports.js'

export type BlueprintSetup = Pick<EncounterBlueprintDto, 'enemies' | 'snapshots'>

/** Pins each distinct Creature source once; enemies of one source share its snapshot. */
export async function buildEncounterBlueprintEnemies({
  input,
  vocabulary,
  readSource
}: {
  input: Pick<CreateEncounterBlueprintInputDto, 'gameSystemId' | 'enemies'>
  vocabulary: SystemVocabularySnapshot
  readSource(id: string, kind: 'CREATURE' | 'EQUIPMENT'): Promise<EncounterAuthoredSource>
}): Promise<BlueprintSetup> {
  const enemies: BlueprintSetup['enemies'] = []
  const snapshots: BlueprintSetup['snapshots'] = []
  const creatureEnemies = new Map<string, BlueprintSetup['enemies'][number]>()
  for (const enemy of input.enemies) {
    if (enemy.kind === 'CUSTOM') {
      const snapshot = { ...enemy, systemId: input.gameSystemId }
      enemies.push({
        ...snapshot,
        sourceId: null,
        sourceRevision: null,
        snapshotIndex: snapshots.push(snapshot) - 1
      })
      continue
    }
    const shared = creatureEnemies.get(enemy.sourceId)
    if (shared) {
      enemies.push(shared)
      continue
    }
    const source = await readSource(enemy.sourceId, 'CREATURE')
    const creature: CreatureAuthored = creatureAuthoredDtoSchema.parse(source.document)
    const equipmentSources = pinCreatureEquipmentSources({
      creature,
      equipment: await readCreatureEquipmentRecords(
        (id) => readSource(id, 'EQUIPMENT'),
        (creature.equipmentLoadout ?? []).map((entry) => entry.equipmentId)
      )
    })
    const maxHitPoints = Math.max(creature.hitPoints, 0)
    const creatureEnemy = {
      kind: 'CREATURE' as const,
      sourceId: creature.id,
      sourceRevision: source.version,
      label: creature.label,
      systemId: creature.systemId,
      maxHitPoints,
      snapshotIndex:
        snapshots.push(
          jsonValueSchema.parse({
            kind: 'CREATURE',
            id: creature.id,
            label: creature.label,
            systemId: creature.systemId,
            sourceRevision: source.version,
            sourceVersionId: source.versionId,
            sourceChecksum: source.checksum,
            maxHitPoints,
            payload: creature,
            ruleFacts: compileInstalledCreatureRuleFacts({ creature, vocabulary }),
            ...(equipmentSources.length > 0 ? { equipmentSources } : {})
          })
        ) - 1
    }
    creatureEnemies.set(enemy.sourceId, creatureEnemy)
    enemies.push(creatureEnemy)
  }
  if (
    new TextEncoder().encode(JSON.stringify({ enemies, snapshots })).byteLength >
    AUTHORED_LIMITS.mutationPayloadBytes
  ) {
    throw new Error('Encounter Blueprint snapshots are too large.')
  }
  return {
    enemies: encounterBlueprintDtoSchema.shape.enemies.parse(enemies),
    snapshots
  }
}

/** The snapshot a Blueprint enemy points at. */
export function blueprintEnemySnapshot(
  setup: BlueprintSetup,
  enemy: BlueprintSetup['enemies'][number]
): JsonValue {
  const snapshot = setup.snapshots[enemy.snapshotIndex]
  if (snapshot === undefined) throw new Error('Encounter Blueprint enemy snapshot is missing.')
  return snapshot
}
