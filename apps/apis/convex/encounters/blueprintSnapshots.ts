import type { CreateEncounterBlueprintInputDto } from '@artificer-toolkit/schema/api/encounterData'
import { buildEncounterBlueprintEnemies } from '@artificer-toolkit/encounter-persistence/blueprintSnapshots'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readAuthoredVersionCompilation,
  readPublishedDocument
} from '../content/documents'
import { readStoredEquipment } from '../content/storedEquipment'
import { ensureSystemVocabularySnapshot } from '../content/systemVocabulary'

export async function readEncounterSource(
  ctx: QueryCtx,
  userId: string,
  systemId: string,
  id: string,
  kind: 'CREATURE' | 'EQUIPMENT' | 'SPELL'
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
  if (kind === 'EQUIPMENT') {
    const { version, document, compilation } = await readStoredEquipment(ctx, root, userId)
    return {
      document,
      compilation,
      checksum: version.checksum,
      version: version.version,
      versionId: version.versionId
    }
  }
  const version = await readAuthoredVersion(ctx, root)
  const compilation = await readAuthoredVersionCompilation(ctx, version)
  if (!compilation || compilation.authoredChecksum !== version.checksum)
    throw new Error('Encounter source compilation is missing or stale.')
  return {
    document: await readPublishedDocument(ctx, root, version),
    compilation,
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
  return buildEncounterBlueprintEnemies({
    input,
    vocabulary,
    readSource: (id, kind) => readEncounterSource(ctx, userId, input.gameSystemId, id, kind)
  })
}
