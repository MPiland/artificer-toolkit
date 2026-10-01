import {
  encounterBlueprintDtoSchema,
  type CreateEncounterBlueprintInputDto,
  type EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounterData'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { compileInstalledCreatureRuleFacts } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { pinCreatureEquipmentSources } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import type { EncounterAuthoredSource } from './ports.js'

export async function buildEncounterBlueprintEnemies({
  input,
  vocabulary,
  readSource
}: {
  input: Pick<CreateEncounterBlueprintInputDto, 'gameSystemId' | 'enemies'>
  vocabulary: SystemVocabularySnapshot
  readSource(id: string, kind: 'CREATURE' | 'EQUIPMENT'): Promise<EncounterAuthoredSource>
}): Promise<EncounterBlueprintDto['enemies']> {
  const enemies = []
  for (const enemy of input.enemies) {
    if (enemy.kind === 'CUSTOM') {
      const snapshot = { ...enemy, systemId: input.gameSystemId }
      enemies.push({ ...snapshot, sourceId: null, sourceRevision: null, snapshot })
      continue
    }
    const source = await readSource(enemy.sourceId, 'CREATURE')
    const parsed = creatureAuthoredDtoSchema.parse(source.document)
    // The validated DTO has the same conditional grant bridge as authored publication.
    const creature = {
      ...parsed,
      damageVulnerabilities: parsed.damageVulnerabilities ?? [],
      damageResistances: parsed.damageResistances ?? [],
      damageImmunities: parsed.damageImmunities ?? [],
      conditionImmunities: parsed.conditionImmunities ?? []
    } as CreatureAuthored
    const equipment = new Map<string, { authored: EncounterAuthoredSource }>()
    for (const id of new Set((creature.equipmentLoadout ?? []).map((entry) => entry.equipmentId))) {
      equipment.set(id, { authored: await readSource(id, 'EQUIPMENT') })
    }
    const equipmentSources = pinCreatureEquipmentSources({ creature, equipmentRecords: equipment })
    const maxHitPoints = Math.max(creature.hitPoints, 0)
    enemies.push({
      kind: 'CREATURE',
      sourceId: creature.id,
      sourceRevision: source.version,
      label: creature.label,
      systemId: creature.systemId,
      maxHitPoints,
      snapshot: jsonValueSchema.parse({
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
    })
  }
  if (
    new TextEncoder().encode(JSON.stringify(enemies)).byteLength >
    AUTHORED_LIMITS.mutationPayloadBytes
  ) {
    throw new Error('Encounter Blueprint snapshots are too large.')
  }
  return encounterBlueprintDtoSchema.shape.enemies.parse(enemies)
}
