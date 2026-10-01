import type { CreateEncounterBlueprintInputDto } from '@artificer-toolkit/schema/api/encounterData'
import { buildEncounterBlueprintEnemies } from '@artificer-toolkit/encounter-persistence/blueprintSnapshots'
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
  return buildEncounterBlueprintEnemies({
    input,
    vocabulary,
    readSource: (id, kind) => readEncounterSource(ctx, userId, input.gameSystemId, id, kind)
  })
}
