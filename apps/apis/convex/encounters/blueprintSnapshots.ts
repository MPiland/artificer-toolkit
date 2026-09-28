import {
  encounterBlueprintDtoSchema,
  type CreateEncounterBlueprintInputDto
} from '@artificer-toolkit/schema/api/encounterData'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { AUTHORED_LIMITS } from '@artificer-toolkit/shared/utils/authoringLimits'
import { compileInstalledCreatureRuleFacts } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { pinCreatureEquipmentSources } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readPublishedDocument
} from '../content/documents'
import { ensureSystemVocabularySnapshot } from '../content/systemVocabulary'

export async function readEncounterSource(
  ctx: QueryCtx,
  userId: string,
  systemId: string,
  id: string,
  kind: 'CREATURE' | 'EQUIPMENT'
) {
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', id))
    .unique()
  if (
    !root ||
    root.subjectKind !== kind ||
    root.systemId !== systemId ||
    !(await canReadAuthoredRoot(ctx, root, userId))
  ) {
    throw new Error('Encounter source is unavailable in the selected Game System.')
  }
  const version = await readAuthoredVersion(ctx, root)
  return {
    document: await readPublishedDocument(ctx, root, version),
    checksum: version.checksum,
    version: version.version,
    versionId: version.versionId
  }
}

export async function snapshotBlueprintEnemies(
  ctx: MutationCtx,
  userId: string,
  input: Pick<CreateEncounterBlueprintInputDto, 'gameSystemId' | 'enemies'>
) {
  const vocabulary = await ensureSystemVocabularySnapshot(ctx, input.gameSystemId)
  const enemies = []
  for (const enemy of input.enemies) {
    if (enemy.kind === 'CUSTOM') {
      const snapshot = { ...enemy, systemId: input.gameSystemId }
      enemies.push({ ...snapshot, sourceId: null, sourceRevision: null, snapshot })
      continue
    }
    const source = await readEncounterSource(
      ctx,
      userId,
      input.gameSystemId,
      enemy.sourceId,
      'CREATURE'
    )
    const parsed = creatureAuthoredDtoSchema.parse(source.document)
    // The validated DTO has the same conditional grant bridge as authored publication.
    const creature = {
      ...parsed,
      damageVulnerabilities: parsed.damageVulnerabilities ?? [],
      damageResistances: parsed.damageResistances ?? [],
      damageImmunities: parsed.damageImmunities ?? [],
      conditionImmunities: parsed.conditionImmunities ?? []
    } as CreatureAuthored
    const equipment = new Map<
      string,
      { authored: Awaited<ReturnType<typeof readEncounterSource>> }
    >()
    for (const id of new Set((creature.equipmentLoadout ?? []).map((entry) => entry.equipmentId))) {
      equipment.set(id, {
        authored: await readEncounterSource(ctx, userId, input.gameSystemId, id, 'EQUIPMENT')
      })
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
